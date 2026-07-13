/**
 * 数据校验脚本
 * 验证 data/generated/movies.json 的完整性和格式正确性
 *
 * 运行方式：npm run data:validate
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type { Movie } from "../src/types/movie.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const GENERATED_PATH = resolve(ROOT, "data/generated/movies.json");

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    total: number;
    withPoster: number;
    withoutPoster: number;
    withRating: number;
    withPersonalRating: number;
    withReview: number;
  };
}

function validateMovie(movie: unknown, index: number): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof movie !== "object" || movie === null) {
    errors.push(`[${index}] 条目不是有效对象`);
    return { errors, warnings };
  }

  const m = movie as Record<string, unknown>;
  const id = m["id"] ?? `#${index}`;

  // 必填字段检查
  if (!m["id"] || typeof m["id"] !== "string") {
    errors.push(`[${id}] 缺少或无效的 id`);
  }
  if (!m["title"] || typeof m["title"] !== "string") {
    errors.push(`[${id}] 缺少或无效的 title`);
  }
  if (!["movie", "tv"].includes(m["mediaType"] as string)) {
    errors.push(`[${id}] 字段 "mediaType" 值无效: ${m["mediaType"]}`);
  }

  // 数组字段检查
  const arrayFields = ["directors", "actors", "genres", "countries", "languages", "tags"];
  for (const field of arrayFields) {
    if (!Array.isArray(m[field])) {
      errors.push(`[${id}] 字段 "${field}" 应为数组`);
    }
  }

  // 布尔字段
  if (typeof m["hidden"] !== "boolean") {
    errors.push(`[${id}] 字段 "hidden" 应为布尔值`);
  }

  // 枚举字段
  if (!["watched", "watching", "planned"].includes(m["status"] as string)) {
    errors.push(`[${id}] 字段 "status" 值无效: ${m["status"]}`);
  }
  if (!["douban", "manual", "merged"].includes(m["source"] as string)) {
    errors.push(`[${id}] 字段 "source" 值无效: ${m["source"]}`);
  }

  // 警告性检查
  if (!m["poster"]) {
    warnings.push(`[${id}] 缺少海报图片`);
  }
  if (!m["year"]) {
    warnings.push(`[${id}] 缺少上映年份`);
  }
  if (!m["doubanRating"]) {
    warnings.push(`[${id}] 缺少豆瓣评分`);
  }
  if (!m["watchedAt"]) {
    warnings.push(`[${id}] 缺少观看时间`);
  }

  // 评分范围
  if (m["doubanRating"] !== undefined && m["doubanRating"] !== null) {
    const r = m["doubanRating"] as number;
    if (r < 0 || r > 10) {
      errors.push(`[${id}] doubanRating 超出范围 (0–10): ${r}`);
    }
  }
  if (m["personalRating"] !== undefined && m["personalRating"] !== null) {
    const r = m["personalRating"] as number;
    if (!Number.isInteger(r) || r < 1 || r > 5) {
      errors.push(`[${id}] personalRating 应为 1–5 的整数: ${r}`);
    }
  }

  return { errors, warnings };
}

function main(): void {
  console.log("\n🔍 Film Wall — 数据校验");
  console.log("─".repeat(50));

  if (!existsSync(GENERATED_PATH)) {
    console.error(
      `\n❌ 生成文件不存在: ${GENERATED_PATH}`
    );
    console.error("   请先运行: npm run data:normalize");
    process.exit(1);
  }

  let movies: unknown[];
  try {
    const raw = readFileSync(GENERATED_PATH, "utf-8");
    movies = JSON.parse(raw) as unknown[];
  } catch (e) {
    console.error(`\n❌ 解析生成文件失败: ${(e as Error).message}`);
    process.exit(1);
  }

  if (!Array.isArray(movies)) {
    console.error("\n❌ 生成文件格式错误：根节点应为数组");
    process.exit(1);
  }

  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    stats: {
      total: movies.length,
      withPoster: 0,
      withoutPoster: 0,
      withRating: 0,
      withPersonalRating: 0,
      withReview: 0,
    },
  };

  // 检查重复 ID
  const idSet = new Set<string>();
  const ids = (movies as Record<string, unknown>[])
    .map((m) => m["id"])
    .filter(Boolean);
  for (const id of ids) {
    if (idSet.has(id as string)) {
      result.errors.push(`[ERROR] 重复的电影 ID: ${id}`);
    }
    idSet.add(id as string);
  }

  // 验证每条电影
  for (let i = 0; i < movies.length; i++) {
    const { errors, warnings } = validateMovie(movies[i], i);
    result.errors.push(...errors);
    result.warnings.push(...warnings);

    const m = movies[i] as Movie;
    if (m.poster) result.stats.withPoster++;
    else result.stats.withoutPoster++;
    if (m.doubanRating) result.stats.withRating++;
    if (m.personalRating) result.stats.withPersonalRating++;
    if (m.review) result.stats.withReview++;
  }

  result.valid = result.errors.length === 0;

  // 输出统计
  console.log(`\n📊 数据统计:`);
  console.log(`  总数: ${result.stats.total}`);
  console.log(`  有海报: ${result.stats.withPoster}`);
  console.log(`  无海报: ${result.stats.withoutPoster}`);
  console.log(`  有豆瓣评分: ${result.stats.withRating}`);
  console.log(`  有个人评分: ${result.stats.withPersonalRating}`);
  console.log(`  有长评: ${result.stats.withReview}`);

  if (result.warnings.length > 0) {
    console.log(`\n⚠️  警告 (${result.warnings.length} 条):`);
    result.warnings.slice(0, 20).forEach((w) => console.log(`  ${w}`));
    if (result.warnings.length > 20) {
      console.log(`  ...还有 ${result.warnings.length - 20} 条警告`);
    }
  }

  if (result.errors.length > 0) {
    console.log(`\n❌ 错误 (${result.errors.length} 条):`);
    result.errors.forEach((e) => console.log(`  ${e}`));
    console.log("\n校验失败，请修复上述错误后重试。");
    process.exit(1);
  }

  console.log("\n✅ 数据校验通过！");
}

main();
