/**
 * 数据标准化脚本
 * 将豆瓣原始数据与手动数据合并，生成统一的 movies.json
 *
 * 运行方式：npm run data:normalize
 * 或：npx tsx scripts/normalize-movies.ts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type {
  Movie,
  DoubanRawMovie,
  DoubanRawPerson,
  DoubanRawRating,
  ManualMoviesData,
  ManualMovieOverride,
  NormalizeResult,
} from "../src/types/movie.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ─── 路径配置 ──────────────────────────────────────────────────────────────
const DOUBAN_RAW_PATH = resolve(ROOT, "data/raw/douban/movie.json");
const MANUAL_PATH = resolve(ROOT, "data/manual/movies.json");
const OUTPUT_PATH = resolve(ROOT, "data/generated/movies.json");

// ─── 辅助函数 ──────────────────────────────────────────────────────────────

/**
 * 安全解析 JSON 文件，出错返回 null 并记录警告
 */
function readJsonSafe<T>(path: string, label: string): T | null {
  if (!existsSync(path)) {
    console.warn(`  [WARN] 文件不存在: ${path}`);
    return null;
  }
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error(`  [ERROR] 解析 ${label} 失败: ${(e as Error).message}`);
    return null;
  }
}

/**
 * 将字符串或数组统一为数组，过滤空值
 */
function toArray(val: string | string[] | undefined | null): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean).map((s) => s.trim());
  return val
    .split(/[,，、\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 从 pubdate 字段尽可能提取年份和日期
 * 豆瓣 pubdate 格式多样：
 *   "1994-09-10(美国)"
 *   ["1994-09-10(美国)", "1995-03-03(中国大陆)"]
 *   "2001"
 */
function parsePubdate(
  pubdate: string | string[] | undefined | null
): { year?: number; releaseDate?: string } {
  if (!pubdate) return {};

  const raw = Array.isArray(pubdate) ? pubdate[0] : pubdate;
  if (!raw) return {};

  // 去除括号中的国家信息，提取纯日期
  const cleaned = raw.replace(/\(.*?\)/g, "").trim();

  // 尝试匹配 YYYY-MM-DD
  const fullMatch = cleaned.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (fullMatch) {
    return {
      year: parseInt(fullMatch[1], 10),
      releaseDate: `${fullMatch[1]}-${fullMatch[2]}-${fullMatch[3]}`,
    };
  }

  // 尝试匹配 YYYY-MM
  const monthMatch = cleaned.match(/(\d{4})-(\d{2})/);
  if (monthMatch) {
    return {
      year: parseInt(monthMatch[1], 10),
      releaseDate: `${monthMatch[1]}-${monthMatch[2]}`,
    };
  }

  // 尝试匹配 YYYY
  const yearMatch = cleaned.match(/(\d{4})/);
  if (yearMatch) {
    return { year: parseInt(yearMatch[1], 10) };
  }

  return {};
}

/**
 * 解析豆瓣评分（可能是数字或字符串）
 * 豆瓣评分范围 0–10
 */
function parseDoubanRating(
  rating: number | string | undefined | null
): number | undefined {
  if (rating === null || rating === undefined) return undefined;
  const num = typeof rating === "string" ? parseFloat(rating) : rating;
  if (isNaN(num) || num <= 0) return undefined;
  return Math.min(10, Math.max(0, num));
}

/**
 * 从新版评分对象中读取数值
 */
function getRatingValue(
  rating: number | string | DoubanRawRating | null | undefined
): number | string | undefined {
  if (typeof rating === "number" || typeof rating === "string") return rating;
  return rating?.value;
}

/**
 * 从新版人物对象数组中提取姓名
 */
function getPersonNames(people: DoubanRawPerson[] | undefined): string[] {
  return (people ?? [])
    .map((person) => person.name?.trim())
    .filter((name): name is string => Boolean(name));
}

/**
 * 解析豆瓣星级（1–5）→ 个人评分（原值保留）
 */
function parseStar(star: number | string | undefined | null): number | undefined {
  if (star === null || star === undefined) return undefined;
  const num = typeof star === "string" ? parseInt(star, 10) : Math.round(star);
  if (isNaN(num) || num <= 0) return undefined;
  return Math.min(5, Math.max(1, num));
}

/**
 * 尝试从 card 字段解析额外信息
 * card 示例: "2014 / 美国 英国 / 剧情 科幻 冒险 / 克里斯托弗·诺兰 / 马修·麦康纳 安·海瑟薇"
 */
function parseCard(card: string | undefined): {
  year?: number;
  countries?: string[];
  genres?: string[];
  directors?: string[];
  actors?: string[];
} {
  if (!card) return {};

  try {
    const parts = card.split("/").map((p) => p.trim());
    if (parts.length < 2) return {};

    const result: ReturnType<typeof parseCard> = {};

    // 第一段：年份
    const yearMatch = parts[0]?.match(/\d{4}/);
    if (yearMatch) result.year = parseInt(yearMatch[0], 10);

    // 第二段：国家/地区
    if (parts[1]) {
      result.countries = parts[1]
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    // 第三段：类型
    if (parts[2]) {
      result.genres = parts[2]
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    // 第四段：导演
    if (parts[3]) {
      result.directors = parts[3]
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    // 第五段：演员
    if (parts[4]) {
      result.actors = parts[4]
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    return result;
  } catch {
    return {};
  }
}

/**
 * 将豆瓣原始数据转换为标准 Movie 格式
 */
function normalizeDoubanMovie(
  raw: DoubanRawMovie,
  index: number,
  warnings: string[]
): Movie | null {
  const subject = raw.subject;
  const id = String(subject?.id ?? raw.id ?? "").trim();
  if (!id) {
    warnings.push(`[WARN] 第 ${index + 1} 条豆瓣数据缺少 id，已跳过`);
    return null;
  }

  const title = subject?.title?.trim() || raw.title?.trim();
  if (!title) {
    warnings.push(`[WARN] ID=${id} 的豆瓣数据缺少 title，已跳过`);
    return null;
  }

  const pubdate = subject?.pubdate ?? raw.pubdate;
  const { year, releaseDate } = parsePubdate(pubdate);
  const cardInfo = parseCard(subject?.card_subtitle ?? raw.card);

  // 合并 card 解析的数据（优先级低于直接字段）
  const subjectYear = Number(subject?.year);
  const finalYear = year ??
    (Number.isInteger(subjectYear) ? subjectYear : undefined) ??
    cardInfo.year;
  const rawGenres = subject?.genres ?? raw.genres;
  const genres = rawGenres
    ? toArray(rawGenres)
    : (cardInfo.genres ?? []);
  const countries = cardInfo.countries ?? [];
  const directors = subject?.directors
    ? getPersonNames(subject.directors)
    : (cardInfo.directors ?? []);
  const actors = subject?.actors
    ? getPersonNames(subject.actors)
    : (cardInfo.actors ?? []);
  const personalStar = parseStar(
    subject ? getRatingValue(raw.rating) : raw.star
  );
  const poster = raw.poster?.trim() ||
    subject?.pic?.normal?.trim() ||
    subject?.pic?.large?.trim() ||
    subject?.cover_url?.trim() ||
    undefined;

  const movie: Movie = {
    id,
    title,
    originalTitle: subject?.original_title?.trim() || raw.original_title?.trim() || undefined,
    year: finalYear,
    releaseDate,
    poster,
    backdrop: undefined,
    directors,
    actors,
    genres,
    countries,
    languages: [],
    doubanUrl: subject?.url?.trim() || raw.url?.trim() || `https://movie.douban.com/subject/${id}/`,
    doubanRating: parseDoubanRating(
      subject ? getRatingValue(subject.rating) : getRatingValue(raw.rating)
    ),
    doubanStar: personalStar,
    personalRating: personalStar,
    watchedAt: raw.create_time || raw.star_time
      ? new Date(raw.create_time || raw.star_time!).toISOString()
      : undefined,
    addedAt: new Date().toISOString(),
    shortComment: raw.comment?.trim() || undefined,
    review: undefined,
    quote: undefined,
    tags: toArray(raw.tags),
    favorite: false,
    hidden: false,
    status: "watched",
    source: "douban",
    runtime: undefined,
    imdbId: undefined,
  };

  return movie;
}

/**
 * 合并手动数据到已有 Movie 对象（手动优先）
 * 数组字段策略：手动数组完全覆盖豆瓣数组（如 actors, genres, tags）
 */
function mergeManualOverride(
  movie: Movie,
  override: ManualMovieOverride,
  warnings: string[]
): Movie {
  const merged = { ...movie };

  // 定义允许的覆盖字段（防止注入非法字段）
  const allowedFields: (keyof ManualMovieOverride)[] = [
    "title",
    "originalTitle",
    "year",
    "releaseDate",
    "poster",
    "backdrop",
    "directors",
    "actors",
    "genres",
    "countries",
    "languages",
    "doubanUrl",
    "doubanRating",
    "personalRating",
    "watchedAt",
    "addedAt",
    "shortComment",
    "review",
    "quote",
    "tags",
    "favorite",
    "hidden",
    "status",
    "runtime",
    "imdbId",
  ];

  for (const key of Object.keys(override) as (keyof ManualMovieOverride)[]) {
    if (!allowedFields.includes(key)) {
      warnings.push(
        `[WARN] ID=${movie.id} 手动数据包含未知字段 "${key}"，已忽略`
      );
      continue;
    }

    const val = override[key];
    if (val !== undefined && val !== null) {
      // 类型安全的赋值
      (merged as Record<string, unknown>)[key] = val;
    }
  }

  merged.source = "merged";
  return merged;
}

/**
 * 从手动数据创建纯手动录入电影
 */
function createManualOnlyMovie(
  id: string,
  override: ManualMovieOverride,
  warnings: string[]
): Movie | null {
  if (!override.title) {
    warnings.push(
      `[WARN] 手动条目 ID=${id} 缺少 title，无法创建纯手动电影，已跳过`
    );
    return null;
  }

  const base: Movie = {
    id,
    title: override.title,
    directors: [],
    actors: [],
    genres: [],
    countries: [],
    languages: [],
    tags: [],
    favorite: false,
    hidden: false,
    status: "watched",
    source: "manual",
    addedAt: new Date().toISOString(),
  };

  return mergeManualOverride(base, override, warnings);
}

// ─── 主逻辑 ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\n🎬 Film Wall — 数据标准化");
  console.log("─".repeat(50));

  const result: NormalizeResult = {
    movies: [],
    warnings: [],
    errors: [],
    stats: {
      total: 0,
      fromDouban: 0,
      fromManual: 0,
      merged: 0,
      skipped: 0,
    },
  };

  // 1. 读取豆瓣原始数据
  console.log("\n📥 读取豆瓣原始数据...");
  const doubanRaw =
    readJsonSafe<DoubanRawMovie[]>(DOUBAN_RAW_PATH, "豆瓣原始数据") ?? [];

  // 2. 读取手动数据
  console.log("📥 读取手动数据...");
  const manualData =
    readJsonSafe<ManualMoviesData>(MANUAL_PATH, "手动数据") ?? {};

  // 过滤掉 _comment, _instructions 等注释字段
  const cleanedManual: ManualMoviesData = {};
  for (const [k, v] of Object.entries(manualData)) {
    if (!k.startsWith("_")) {
      cleanedManual[k] = v as ManualMovieOverride;
    }
  }

  // 3. 标准化豆瓣数据
  console.log("\n🔄 标准化豆瓣数据...");
  const doubanMovieMap = new Map<string, Movie>();
  const nestedMovieIds = new Set<string>();

  for (let i = 0; i < doubanRaw.length; i++) {
    try {
      const movie = normalizeDoubanMovie(doubanRaw[i]!, i, result.warnings);
      if (movie) {
        const isNested = Boolean(doubanRaw[i]!.subject);
        const isNewMovie = !doubanMovieMap.has(movie.id);
        const existingIsNested = nestedMovieIds.has(movie.id);

        // 新版嵌套格式信息更完整，不允许同 ID 的旧版数据覆盖它。
        if (!doubanMovieMap.has(movie.id) || isNested || !existingIsNested) {
          doubanMovieMap.set(movie.id, movie);
        }
        if (isNested) nestedMovieIds.add(movie.id);
        if (isNewMovie) result.stats.fromDouban++;
      } else {
        result.stats.skipped++;
      }
    } catch (e) {
      const errMsg = `[ERROR] 处理第 ${i + 1} 条豆瓣数据失败: ${(e as Error).message}`;
      result.errors.push(errMsg);
      console.error(`  ${errMsg}`);
      result.stats.skipped++;
    }
  }

  console.log(`  ✓ 成功解析 ${result.stats.fromDouban} 条豆瓣数据`);

  // 4. 合并手动数据
  console.log("\n🔀 合并手动数据...");
  const processedIds = new Set<string>();

  // 4a. 对豆瓣数据应用手动覆盖
  for (const [id, movie] of doubanMovieMap) {
    if (cleanedManual[id]) {
      const merged = mergeManualOverride(movie, cleanedManual[id]!, result.warnings);
      result.movies.push(merged);
      result.stats.merged++;
    } else {
      result.movies.push(movie);
    }
    processedIds.add(id);
  }

  // 4b. 添加纯手动录入的电影（不在豆瓣数据中的）
  for (const [id, override] of Object.entries(cleanedManual)) {
    if (processedIds.has(id)) continue;

    try {
      const manual = createManualOnlyMovie(id, override, result.warnings);
      if (manual) {
        result.movies.push(manual);
        result.stats.fromManual++;
      } else {
        result.stats.skipped++;
      }
    } catch (e) {
      const errMsg = `[ERROR] 处理手动条目 ID=${id} 失败: ${(e as Error).message}`;
      result.errors.push(errMsg);
      console.error(`  ${errMsg}`);
      result.stats.skipped++;
    }
  }

  // 5. 过滤隐藏（hidden）和无效条目，按观看时间倒序排序
  result.movies.sort((a, b) => {
    const ta = a.watchedAt ? new Date(a.watchedAt).getTime() : 0;
    const tb = b.watchedAt ? new Date(b.watchedAt).getTime() : 0;
    return tb - ta;
  });

  result.stats.total = result.movies.length;

  // 6. 输出
  console.log("\n💾 写入输出文件...");
  const outputDir = resolve(ROOT, "data/generated");
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(result.movies, null, 2), "utf-8");

  // 7. 打印摘要
  console.log("\n✅ 标准化完成！");
  console.log("─".repeat(50));
  console.log(`  总计: ${result.stats.total} 部电影`);
  console.log(`  豆瓣来源: ${result.stats.fromDouban - result.stats.merged + result.stats.merged} 条`);
  console.log(`  纯手动: ${result.stats.fromManual} 条`);
  console.log(`  合并覆盖: ${result.stats.merged} 条`);
  console.log(`  跳过: ${result.stats.skipped} 条`);
  console.log(`  输出路径: ${OUTPUT_PATH}`);

  if (result.warnings.length > 0) {
    console.log(`\n⚠️  警告 (${result.warnings.length} 条):`);
    result.warnings.forEach((w) => console.log(`  ${w}`));
  }

  if (result.errors.length > 0) {
    console.log(`\n❌ 错误 (${result.errors.length} 条):`);
    result.errors.forEach((e) => console.log(`  ${e}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("\n💥 致命错误:", e);
  process.exit(1);
});
