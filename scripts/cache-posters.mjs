/**
 * 将影视海报缓存到 public/posters/movies，并把本地路径写回 generated 数据。
 *
 * 来源顺序：已有本地缓存 → 手动 URL → 豆瓣多规格图片 → 已声明代理
 * → 可选 TMDB → TVmaze → 可选 Fanart.tv → 可选 OMDb。
 *
 * 可选凭据：TMDB_API_READ_ACCESS_TOKEN / TMDB_API_KEY、FANART_API_KEY /
 * FANART_CLIENT_KEY、OMDB_API_KEY。TVmaze 无需密钥。
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_PATH = resolve(ROOT, "data/generated/movies.json");
const PUBLIC_DIR = resolve(ROOT, "public");
const CACHE_DIR = resolve(PUBLIC_DIR, "posters/movies");
const MANIFEST_PATH = resolve(CACHE_DIR, "manifest.json");
const CONCURRENCY = Math.max(1, Number(process.env.POSTER_CACHE_CONCURRENCY) || 5);
const STRICT = process.env.POSTER_CACHE_STRICT === "1";

const USER_AGENT =
  "Mozilla/5.0 (compatible; FilmWallPosterCache/1.0; +https://github.com/vexpaer/film_wall)";

function unique(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))];
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function isDoubanUrl(url) {
  return /(^|\.)doubanio\.com$/i.test(hostOf(url));
}

function safeFilename(id) {
  const simple = id.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 72);
  if (simple === id && simple) return simple;
  const hash = createHash("sha256").update(id).digest("hex").slice(0, 10);
  return `${simple || "poster"}-${hash}`;
}

async function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    console.warn(`  [WARN] 无法读取 ${path}: ${error.message}`);
    return fallback;
  }
}

async function isUsableFile(path) {
  try {
    return (await stat(path)).size > 512;
  } catch {
    return false;
  }
}

function imageExtension(contentType, url) {
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("gif")) return ".gif";
  const suffix = extname(new URL(url).pathname).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(suffix)
    ? suffix.replace(".jpeg", ".jpg")
    : ".jpg";
}

function isImage(bytes) {
  if (bytes.length < 512) return false;
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const gif = bytes.subarray(0, 3).toString("ascii") === "GIF";
  const webp = bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP";
  return jpeg || png || gif || webp;
}

async function download(url, movie) {
  const isDouban = isDoubanUrl(url);
  const headers = { "user-agent": USER_AGENT, accept: "image/avif,image/webp,image/*,*/*;q=0.8" };
  if (isDouban) {
    headers.referer = movie.doubanUrl || `https://movie.douban.com/subject/${movie.id}/`;
  }

  const response = await fetch(url, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const contentType = response.headers.get("content-type") || "";
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!contentType.startsWith("image/") || !isImage(bytes)) {
    throw new Error(`响应不是有效图片 (${contentType || "unknown"}, ${bytes.length} bytes)`);
  }

  return { bytes, extension: imageExtension(contentType, url) };
}

function expandDoubanVariants(url) {
  if (!isDoubanUrl(url)) return [url];
  if (!/[slm]_ratio_poster/.test(url)) return [url];
  return unique([
    url.replace(/[slm]_ratio_poster/, "m_ratio_poster"),
    url.replace(/[slm]_ratio_poster/, "l_ratio_poster"),
    url.replace(/[slm]_ratio_poster/, "s_ratio_poster"),
    url,
  ]);
}

function sourceCandidates(movie) {
  const declared = unique([
    movie.poster,
    ...(Array.isArray(movie.posterSources) ? movie.posterSources : []),
    movie.posterFallback,
  ]).filter((url) => hostOf(url));
  const manualPoster = movie.poster && !movie.posterSources?.includes(movie.poster)
    ? [movie.poster]
    : [];
  const douban = declared
    .filter(isDoubanUrl)
    .flatMap(expandDoubanVariants);
  const proxies = declared.filter((url) => !isDoubanUrl(url));
  return unique([...manualPoster, ...douban, ...proxies]);
}

function normalizeTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/第[零〇一二两三四五六七八九十百\d]+季/g, "")
    .replace(/season\s*\d+|s\d+/gi, "")
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

function stripSeason(value) {
  return String(value || "")
    .replace(/\s*(?:[·:：\-–—]\s*)?第\s*[零〇一二两三四五六七八九十百\d]+\s*季(?:\s*[·:：\-–—].*)?$/i, "")
    .replace(/\s*(?:[·:：\-–—]\s*)?(?:season\s*|s)\d{1,3}(?:\b.*)?$/i, "")
    .trim();
}

function searchTitles(movie) {
  return unique([
    stripSeason(movie.originalTitle),
    movie.series,
    stripSeason(movie.title),
  ]);
}

function titleScore(value, expectedTitles) {
  const candidate = normalizeTitle(value);
  if (!candidate) return 0;
  return expectedTitles.reduce((best, expected) => {
    if (!expected) return best;
    if (candidate === expected) return Math.max(best, 100);
    if (candidate.includes(expected) || expected.includes(candidate)) return Math.max(best, 55);
    return best;
  }, 0);
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function fetchJson(url, headers = {}, attempts = 3) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/json", ...headers },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.ok) return response.json();

    if (response.status === 429 && attempt + 1 < attempts) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await delay(Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 2_000 * (attempt + 1));
      continue;
    }
    throw new Error(`HTTP ${response.status}`);
  }
  throw new Error("API 请求重试次数已用尽");
}

async function findTmdbPoster(movie) {
  const bearer = process.env.TMDB_API_READ_ACCESS_TOKEN?.trim();
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!bearer && !apiKey) return undefined;

  const media = movie.mediaType === "tv" ? "tv" : "movie";
  const headers = bearer ? { authorization: `Bearer ${bearer}` } : {};
  const expectedTitles = searchTitles(movie).map(normalizeTitle).filter(Boolean);
  let best;

  for (const query of searchTitles(movie)) {
    const params = new URLSearchParams({ query, language: "zh-CN", include_adult: "false" });
    if (movie.mediaType === "movie" && movie.year) params.set("year", String(movie.year));
    if (apiKey) params.set("api_key", apiKey);
    const data = await fetchJson(`https://api.themoviedb.org/3/search/${media}?${params}`, headers);
    const results = Array.isArray(data.results) ? data.results : [];
    for (const result of results) {
      if (!result) continue;
      const nameScore = Math.max(
        titleScore(result.title || result.name, expectedTitles),
        titleScore(result.original_title || result.original_name, expectedTitles)
      );
      const resultYear = Number(String(result.release_date || result.first_air_date || "").slice(0, 4));
      const yearScore = movie.mediaType === "movie" && movie.year && resultYear
        ? Math.max(0, 10 - Math.abs(movie.year - resultYear))
        : 0;
      const score = nameScore + yearScore + Math.min(5, Number(result.popularity || 0) / 100);
      if (!best || score > best.score) best = { result, score };
    }
    if (best?.score >= 105) break;
  }

  const match = best && best.score >= 50 ? best.result : undefined;
  if (!match) return undefined;

  let posterPath = match.poster_path;
  if (movie.mediaType === "tv" && movie.seasonNumber) {
    try {
      const seasonParams = new URLSearchParams({ language: "zh-CN" });
      if (apiKey) seasonParams.set("api_key", apiKey);
      const season = await fetchJson(
        `https://api.themoviedb.org/3/tv/${match.id}/season/${movie.seasonNumber}?${seasonParams}`,
        headers
      );
      posterPath = season.poster_path || posterPath;
    } catch {
      // 系列级海报仍可作为季海报的最后备用。
    }
  }

  return {
    url: posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : undefined,
    id: match.id,
    media,
  };
}

async function findTvmazePoster(movie) {
  if (movie.mediaType !== "tv") return undefined;

  const expectedTitles = searchTitles(movie).map(normalizeTitle).filter(Boolean);
  let best;
  for (const query of searchTitles(movie)) {
    const results = await fetchJson(
      `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`
    );
    for (const entry of Array.isArray(results) ? results : []) {
      const show = entry?.show;
      if (!show) continue;
      const score = titleScore(show.name, expectedTitles) + Math.min(5, Number(entry.score || 0) * 5);
      if (!best || score > best.score) best = { show, score };
    }
    if (best?.score >= 100) break;
  }

  const show = best && best.score >= 50 ? best.show : undefined;
  if (!show) return undefined;

  let url = show.image?.original || show.image?.medium;
  if (movie.seasonNumber) {
    try {
      const seasons = await fetchJson(`https://api.tvmaze.com/shows/${show.id}/seasons`);
      const season = Array.isArray(seasons)
        ? seasons.find((item) => Number(item?.number) === movie.seasonNumber)
        : undefined;
      url = season?.image?.original || season?.image?.medium || url;
    } catch {
      // 剧集主海报仍可作为最后备用。
    }
  }

  return {
    url,
    tvdbId: show.externals?.thetvdb,
    imdbId: show.externals?.imdb,
  };
}

async function findOmdbPoster(movie) {
  const apiKey = process.env.OMDB_API_KEY?.trim();
  if (!apiKey) return undefined;

  const expectedTitles = searchTitles(movie).map(normalizeTitle).filter(Boolean);
  for (const query of searchTitles(movie)) {
    const params = new URLSearchParams({
      apikey: apiKey,
      t: query,
      type: movie.mediaType === "tv" ? "series" : "movie",
      r: "json",
    });
    if (movie.mediaType === "movie" && movie.year) params.set("y", String(movie.year));
    const data = await fetchJson(`https://www.omdbapi.com/?${params}`);
    if (data?.Response !== "True" || titleScore(data.Title, expectedTitles) < 50) continue;
    const url = typeof data.Poster === "string" && data.Poster !== "N/A" ? data.Poster : undefined;
    return { url, imdbId: data.imdbID };
  }
  return undefined;
}

async function findTmdbExternalIds(tmdbMatch) {
  if (!tmdbMatch?.id) return undefined;
  const bearer = process.env.TMDB_API_READ_ACCESS_TOKEN?.trim();
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!bearer && !apiKey) return undefined;
  const params = new URLSearchParams();
  if (apiKey) params.set("api_key", apiKey);
  const headers = bearer ? { authorization: `Bearer ${bearer}` } : {};
  return fetchJson(
    `https://api.themoviedb.org/3/${tmdbMatch.media}/${tmdbMatch.id}/external_ids?${params}`,
    headers
  );
}

function pickFanart(entries, seasonNumber) {
  return entries
    .filter((entry) => entry?.item?.url)
    .map((entry) => {
      const season = Number(entry.item.season);
      const seasonScore = seasonNumber && season === seasonNumber ? 200 : entry.kind === "series" ? 50 : 0;
      const languageScore = entry.item.lang === "zh" ? 30 : entry.item.lang === "en" ? 20 : 10;
      return { url: entry.item.url, score: seasonScore + languageScore + Number(entry.item.likes || 0) };
    })
    .sort((a, b) => b.score - a.score)[0]?.url;
}

async function findFanartPoster(movie, tmdbMatch, tvmazeMatch) {
  const projectKey = process.env.FANART_API_KEY?.trim();
  const clientKey = process.env.FANART_CLIENT_KEY?.trim();
  if (!projectKey && !clientKey) return undefined;

  let id;
  let resource;
  if (movie.mediaType === "movie") {
    id = tmdbMatch?.id;
    resource = "movies";
  } else {
    id = tvmazeMatch?.tvdbId;
    if (!id && tmdbMatch) {
      try {
        id = (await findTmdbExternalIds(tmdbMatch))?.tvdb_id;
      } catch {
        // 没有 TVDB ID 时跳过 Fanart.tv。
      }
    }
    resource = "tv";
  }
  if (!id) return undefined;

  const headers = {};
  if (projectKey) headers["api-key"] = projectKey;
  if (clientKey) headers["client-key"] = clientKey;
  const data = await fetchJson(`https://webservice.fanart.tv/v3.2/${resource}/${id}`, headers);
  const entries = movie.mediaType === "movie"
    ? (data.movieposter || []).map((item) => ({ item, kind: "series" }))
    : [
        ...(data.seasonposter || []).map((item) => ({ item, kind: "season" })),
        ...(data.tvposter || []).map((item) => ({ item, kind: "series" })),
      ];
  const url = pickFanart(entries, movie.seasonNumber);
  return url ? { url } : undefined;
}

function providerFor(url, movie) {
  const host = hostOf(url);
  if (host === "image.tmdb.org") return "tmdb";
  if (isDoubanUrl(url)) return "douban";
  if (movie.poster === url && !movie.posterSources?.includes(url)) return "manual";
  return "proxy";
}

async function cacheMovie(movie, manifest) {
  const previous = manifest.posters[movie.id];
  if (previous?.path) {
    const previousFile = resolve(PUBLIC_DIR, previous.path);
    if (previousFile.startsWith(CACHE_DIR) && await isUsableFile(previousFile)) {
      movie.posterPath = previous.path.replace(/\\/g, "/");
      if (previous.source) {
        movie.posterSources = unique([...(movie.posterSources || []), previous.source]);
      }
      return { status: "cached", provider: previous.provider };
    }
  }

  async function cacheUrl(url, provider) {
    if (!url || !hostOf(url)) return undefined;
    try {
      const { bytes, extension } = await download(url, movie);
      const filename = `${safeFilename(movie.id)}${extension}`;
      const targetPath = resolve(CACHE_DIR, filename);
      const tempPath = `${targetPath}.tmp`;
      await writeFile(tempPath, bytes);
      await rename(tempPath, targetPath);
      const publicPath = `posters/movies/${filename}`;
      manifest.posters[movie.id] = { path: publicPath, provider, source: url };
      movie.posterPath = publicPath;
      movie.posterSources = unique([...(movie.posterSources || []), url]);
      return { status: "downloaded", provider };
    } catch (error) {
      if (process.env.POSTER_CACHE_DEBUG === "1") {
        console.warn(`  [WARN] ${movie.id} ${provider} ${url}: ${error.message}`);
      }
      return undefined;
    }
  }

  for (const url of sourceCandidates(movie)) {
    const result = await cacheUrl(url, providerFor(url, movie));
    if (result) return result;
  }

  let tmdbMatch;
  let tvmazeMatch;
  try {
    tmdbMatch = await findTmdbPoster(movie);
    const result = await cacheUrl(tmdbMatch?.url, "tmdb");
    if (result) return result;
  } catch (error) {
    if (process.env.POSTER_CACHE_DEBUG === "1") {
      console.warn(`  [WARN] ${movie.id} TMDB: ${error.message}`);
    }
  }

  try {
    tvmazeMatch = await findTvmazePoster(movie);
    const result = await cacheUrl(tvmazeMatch?.url, "tvmaze");
    if (result) return result;
  } catch (error) {
    if (process.env.POSTER_CACHE_DEBUG === "1") {
      console.warn(`  [WARN] ${movie.id} TVmaze: ${error.message}`);
    }
  }

  try {
    const fanartMatch = await findFanartPoster(movie, tmdbMatch, tvmazeMatch);
    const result = await cacheUrl(fanartMatch?.url, "fanart");
    if (result) return result;
  } catch (error) {
    if (process.env.POSTER_CACHE_DEBUG === "1") {
      console.warn(`  [WARN] ${movie.id} Fanart.tv: ${error.message}`);
    }
  }

  try {
    const omdbMatch = await findOmdbPoster(movie);
    const result = await cacheUrl(omdbMatch?.url, "omdb");
    if (result) return result;
  } catch (error) {
    if (process.env.POSTER_CACHE_DEBUG === "1") {
      console.warn(`  [WARN] ${movie.id} OMDb: ${error.message}`);
    }
  }

  delete movie.posterPath;
  return { status: "missing" };
}

async function mapPool(items, worker) {
  let cursor = 0;
  const results = new Array(items.length);
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, run));
  return results;
}

async function main() {
  console.log("\n🖼️  Film Wall — 海报多源缓存");
  console.log("─".repeat(50));
  const movies = await readJson(DATA_PATH, []);
  if (!Array.isArray(movies)) throw new Error(`${DATA_PATH} 根节点应为数组`);

  await mkdir(CACHE_DIR, { recursive: true });
  const manifest = await readJson(MANIFEST_PATH, { version: 1, posters: {} });
  manifest.version = 1;
  manifest.posters ||= {};

  const results = await mapPool(movies, (movie) => cacheMovie(movie, manifest));
  await writeFile(DATA_PATH, JSON.stringify(movies, null, 2), "utf8");
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const counts = results.reduce((all, result) => {
    all[result.status] = (all[result.status] || 0) + 1;
    if (result.provider) all.providers[result.provider] = (all.providers[result.provider] || 0) + 1;
    return all;
  }, { cached: 0, downloaded: 0, missing: 0, providers: {} });

  console.log(`  已有缓存: ${counts.cached}`);
  console.log(`  新增缓存: ${counts.downloaded}`);
  console.log(`  缺少海报: ${counts.missing}`);
  console.log(`  来源统计: ${JSON.stringify(counts.providers)}`);

  if (counts.missing > 0) {
    const missing = movies.filter((movie) => !movie.posterPath).map((movie) => `${movie.id} ${movie.title}`);
    console.warn(`\n⚠️  未能缓存 ${counts.missing} 张海报:`);
    missing.slice(0, 20).forEach((item) => console.warn(`  ${item}`));
    if (STRICT) process.exitCode = 1;
  } else {
    console.log("\n✅ 所有影视海报均已有本地缓存");
  }
}

main().catch((error) => {
  console.error(`\n❌ 海报缓存失败: ${error.stack || error.message}`);
  process.exit(1);
});
