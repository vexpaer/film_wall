/**
 * 数据工具函数
 * 提供加载和查询电影数据的方法
 * 使用 fs.readFileSync 在 Astro SSG 构建时同步读取，避免动态 import 路径问题
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import type { Movie } from "../types/movie.js";

// 数据文件路径（相对于项目根目录）
const DATA_PATH = resolve(process.cwd(), "data/generated/movies.json");

let _cache: Movie[] | null = null;

/**
 * 获取所有电影数据（构建时从生成文件读取）
 * 仅在 Astro SSG 构建期间调用
 */
export async function getAllMovies(): Promise<Movie[]> {
  if (_cache) return _cache;

  if (!existsSync(DATA_PATH)) {
    console.warn(
      `[utils/data] 数据文件不存在: ${DATA_PATH}\n` +
      `  请先运行: npm run data:normalize`
    );
    return [];
  }

  try {
    const raw = readFileSync(DATA_PATH, "utf-8");
    const movies = JSON.parse(raw) as Movie[];
    _cache = movies.filter((m) => !m.hidden);
    return _cache;
  } catch (e) {
    console.error("[utils/data] 无法加载电影数据:", e);
    return [];
  }
}

/**
 * 按 ID 查找单部电影
 */
export async function getMovieById(id: string): Promise<Movie | undefined> {
  const movies = await getAllMovies();
  return movies.find((m) => m.id === id);
}

/**
 * 获取所有标签
 */
export async function getAllTags(): Promise<string[]> {
  const movies = await getAllMovies();
  const tags = new Set<string>();
  for (const m of movies) {
    for (const t of m.tags) tags.add(t);
  }
  return Array.from(tags).sort();
}

/**
 * 获取最近观看的电影
 */
export async function getRecentMovies(count = 6): Promise<Movie[]> {
  const movies = await getAllMovies();
  return [...movies]
    .filter((m) => m.watchedAt)
    .sort((a, b) => {
      const ta = new Date(a.watchedAt!).getTime();
      const tb = new Date(b.watchedAt!).getTime();
      return tb - ta;
    })
    .slice(0, count);
}

/**
 * 计算统计数据
 */
export async function getStats() {
  const movies = await getAllMovies();
  const total = movies.length;

  // 平均个人评分
  const rated = movies.filter((m) => m.personalRating);
  const avgRating =
    rated.length > 0
      ? rated.reduce((sum, m) => sum + (m.personalRating ?? 0), 0) / rated.length
      : 0;

  // 最常见类型
  const genreCount = new Map<string, number>();
  for (const m of movies) {
    for (const g of m.genres) {
      genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
    }
  }
  const topGenres = [...genreCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([genre, count]) => ({ genre, count }));

  // 按年份分组（观看年份）
  const byWatchYear = new Map<number, number>();
  for (const m of movies) {
    if (m.watchedAt) {
      const year = new Date(m.watchedAt).getFullYear();
      byWatchYear.set(year, (byWatchYear.get(year) ?? 0) + 1);
    }
  }

  // 评分分布
  const ratingDist = [1, 2, 3, 4, 5].map((star) => ({
    star,
    count: movies.filter((m) => m.personalRating === star).length,
  }));

  // 最常见导演
  const directorCount = new Map<string, number>();
  for (const m of movies) {
    for (const d of m.directors) {
      directorCount.set(d, (directorCount.get(d) ?? 0) + 1);
    }
  }
  const topDirectors = [...directorCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([director, count]) => ({ director, count }));

  return {
    total,
    ratedCount: rated.length,
    avgRating: Math.round(avgRating * 10) / 10,
    topGenres,
    byWatchYear: [...byWatchYear.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, count]) => ({ year, count })),
    ratingDist,
    topDirectors,
  };
}

/**
 * 格式化评分显示
 */
export function formatRating(rating: number | undefined): string {
  if (!rating) return "—";
  return rating.toFixed(1);
}

/**
 * 格式化个人评分（1–5星）
 */
export function formatStars(rating: number | undefined): string {
  if (!rating) return "";
  return "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));
}

/**
 * 格式化日期
 */
export function formatDate(dateStr: string | undefined, locale = "zh-CN"): string {
  if (!dateStr) return "";
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

/**
 * 格式化年份
 */
export function formatYear(dateStr: string | undefined): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).getFullYear().toString();
  } catch {
    return dateStr;
  }
}

/**
 * 生成电影页面路径（兼容 base path）
 */
export function moviePath(id: string, base = "/film_wall"): string {
  return `${base}/movies/${id}/`;
}
