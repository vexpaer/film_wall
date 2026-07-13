/** 将豆瓣书籍原始数据与手动覆盖合并为 books.json。 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import type {
  Book,
  DoubanRawBook,
  DoubanRawBookRating,
  ManualBookOverride,
  ManualBooksData,
} from "../src/types/book.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RAW_PATH = resolve(ROOT, "data/raw/douban/book.json");
const MANUAL_PATH = resolve(ROOT, "data/manual/books.json");
const OUTPUT_PATH = resolve(ROOT, "data/generated/books.json");

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch (error) {
    throw new Error(`无法解析 ${path}: ${(error as Error).message}`);
  }
}

function strings(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : value.split(/[,，、]+/))
    .map((item) => item.trim())
    .filter(Boolean);
}

function first(value: string | string[] | undefined): string | undefined {
  return strings(value)[0];
}

function numberValue(value: number | string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function ratingValue(
  rating: number | string | DoubanRawBookRating | null | undefined
): number | undefined {
  if (rating === null || rating === undefined) return undefined;
  const value = typeof rating === "object" ? rating.value : rating;
  const parsed = numberValue(value);
  return parsed && parsed > 0 ? Math.min(10, parsed) : undefined;
}

function personalRating(
  rating: number | string | DoubanRawBookRating | null | undefined,
  legacyStar?: number | string
): number | undefined {
  const raw = typeof rating === "object" && rating
    ? rating.star_count ?? rating.value
    : legacyStar;
  let parsed = numberValue(raw);
  if (!parsed || parsed <= 0) return undefined;
  if (parsed > 5) parsed /= 2;
  return Math.max(1, Math.min(5, Math.round(parsed)));
}

function publication(value: string | string[] | undefined): {
  year?: number;
  publishDate?: string;
} {
  const publishDate = first(value);
  const match = publishDate?.match(/\b(\d{4})\b/);
  return {
    year: match ? Number.parseInt(match[1]!, 10) : undefined,
    publishDate,
  };
}

function markedAt(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}+08:00`
    : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function pageCount(value: string | number | Array<string | number> | undefined): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = numberValue(raw);
  return parsed && parsed > 0 ? Math.round(parsed) : undefined;
}

function normalizeBook(raw: DoubanRawBook, index: number, warnings: string[]): Book | null {
  const subject = raw.subject;
  const id = String(subject?.id ?? raw.id ?? "").trim();
  const title = subject?.title?.trim() || raw.title?.trim();
  if (!id || !title) {
    warnings.push(`第 ${index + 1} 条书籍数据缺少 ${!id ? "id" : "title"}，已跳过`);
    return null;
  }

  const { year, publishDate } = publication(subject?.pubdate ?? raw.pubdate);
  const cover = raw.poster?.trim() || subject?.cover_url?.trim() ||
    subject?.pic?.normal?.trim() || subject?.pic?.large?.trim() || undefined;
  const coverFallback = subject?.cover_url
    ? subject.pic?.normal?.trim() || subject.pic?.large?.trim() || undefined
    : undefined;

  return {
    id,
    title,
    subtitle: subject?.book_subtitle?.trim() || undefined,
    authors: strings(subject?.author),
    publisher: first(subject?.press ?? subject?.publisher),
    year,
    publishDate,
    cover,
    coverFallback,
    doubanUrl: subject?.url?.trim() || raw.url?.trim() ||
      `https://book.douban.com/subject/${id}/`,
    doubanRating: ratingValue(subject?.rating ?? (subject ? undefined : raw.rating)),
    personalRating: subject
      ? personalRating(raw.rating)
      : personalRating(undefined, raw.star),
    finishedAt: markedAt(raw.create_time || raw.star_time),
    shortComment: raw.comment?.trim() || undefined,
    summary: subject?.intro?.trim() || raw.intro?.trim() || undefined,
    pages: pageCount(subject?.pages),
    tags: strings(raw.tags),
    hidden: false,
    status: "read",
    source: "douban",
  };
}

const allowedFields: (keyof ManualBookOverride)[] = [
  "title", "subtitle", "authors", "publisher", "year", "publishDate",
  "cover", "coverFallback", "doubanUrl", "doubanRating", "personalRating",
  "finishedAt", "shortComment", "summary", "pages", "tags", "hidden", "status",
];

function mergeManual(book: Book, override: ManualBookOverride, warnings: string[]): Book {
  const merged = { ...book };
  for (const key of Object.keys(override) as (keyof ManualBookOverride)[]) {
    if (!allowedFields.includes(key)) {
      warnings.push(`ID=${book.id} 的手动书籍数据包含未知字段 "${key}"，已忽略`);
      continue;
    }
    const value = override[key];
    if (value !== undefined && value !== null) {
      (merged as unknown as Record<string, unknown>)[key] = value;
    }
  }
  merged.source = book.source === "manual" ? "manual" : "merged";
  return merged;
}

function main(): void {
  console.log("\n📚 Bookshelf — 数据标准化");
  console.log("─".repeat(50));

  const rawBooks = readJson<DoubanRawBook[]>(RAW_PATH, []);
  const manual = readJson<ManualBooksData>(MANUAL_PATH, {});
  const warnings: string[] = [];
  const booksById = new Map<string, Book>();
  let skipped = 0;

  rawBooks.forEach((raw, index) => {
    const book = normalizeBook(raw, index, warnings);
    if (!book) {
      skipped++;
      return;
    }
    if (!booksById.has(book.id)) booksById.set(book.id, book);
  });

  let mergedCount = 0;
  let manualCount = 0;
  for (const [id, override] of Object.entries(manual)) {
    if (id.startsWith("_")) continue;
    const existing = booksById.get(id);
    if (existing) {
      booksById.set(id, mergeManual(existing, override, warnings));
      mergedCount++;
    } else if (override.title) {
      const manualBook: Book = {
        id,
        title: override.title,
        authors: [],
        tags: [],
        hidden: false,
        status: "read",
        source: "manual",
      };
      booksById.set(id, mergeManual(manualBook, override, warnings));
      manualCount++;
    } else {
      warnings.push(`手动书籍 ID=${id} 缺少 title，已跳过`);
      skipped++;
    }
  }

  const books = [...booksById.values()].sort((a, b) =>
    (b.finishedAt ? Date.parse(b.finishedAt) : 0) -
    (a.finishedAt ? Date.parse(a.finishedAt) : 0)
  );

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(books, null, 2), "utf-8");

  console.log(`  总计: ${books.length} 本书`);
  console.log(`  豆瓣来源: ${books.length - manualCount} 条`);
  console.log(`  纯手动: ${manualCount} 条`);
  console.log(`  合并覆盖: ${mergedCount} 条`);
  console.log(`  跳过: ${skipped} 条`);
  console.log(`  输出路径: ${OUTPUT_PATH}`);
  warnings.forEach((warning) => console.warn(`  [WARN] ${warning}`));
}

main();
