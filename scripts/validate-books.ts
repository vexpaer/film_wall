/** 校验 data/generated/books.json。 */

import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BOOKS_PATH = resolve(ROOT, "data/generated/books.json");

function main(): void {
  console.log("\n🔍 Bookshelf — 数据校验");
  console.log("─".repeat(50));
  if (!existsSync(BOOKS_PATH)) {
    console.error(`❌ 生成文件不存在: ${BOOKS_PATH}`);
    process.exit(1);
  }

  const books = JSON.parse(readFileSync(BOOKS_PATH, "utf-8")) as unknown;
  if (!Array.isArray(books)) {
    console.error("❌ books.json 根节点应为数组");
    process.exit(1);
  }

  const errors: string[] = [];
  const ids = new Set<string>();
  let withCover = 0;

  books.forEach((value, index) => {
    if (!value || typeof value !== "object") {
      errors.push(`[${index}] 条目不是对象`);
      return;
    }
    const book = value as Record<string, unknown>;
    const id = typeof book.id === "string" ? book.id : `#${index}`;
    if (id === `#${index}` || !id) errors.push(`[${id}] 缺少有效 id`);
    if (ids.has(id)) errors.push(`[${id}] ID 重复`);
    ids.add(id);
    if (typeof book.title !== "string" || !book.title) errors.push(`[${id}] 缺少有效 title`);
    if (!Array.isArray(book.authors)) errors.push(`[${id}] authors 应为数组`);
    if (!Array.isArray(book.tags)) errors.push(`[${id}] tags 应为数组`);
    if (typeof book.hidden !== "boolean") errors.push(`[${id}] hidden 应为布尔值`);
    if (book.status !== "read") errors.push(`[${id}] status 应为 read`);
    if (!["douban", "manual", "merged"].includes(book.source as string)) {
      errors.push(`[${id}] source 值无效`);
    }
    if (book.doubanRating !== undefined) {
      const rating = book.doubanRating as number;
      if (typeof rating !== "number" || rating < 0 || rating > 10) {
        errors.push(`[${id}] doubanRating 应在 0–10 之间`);
      }
    }
    if (book.personalRating !== undefined) {
      const rating = book.personalRating as number;
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        errors.push(`[${id}] personalRating 应为 1–5 的整数`);
      }
    }
    if (book.cover) withCover++;
  });

  console.log(`  总数: ${books.length}`);
  console.log(`  有封面: ${withCover}`);
  console.log(`  无封面: ${books.length - withCover}`);
  if (errors.length > 0) {
    errors.forEach((error) => console.error(`  [ERROR] ${error}`));
    process.exit(1);
  }
  console.log("✅ 书籍数据校验通过！");
}

main();
