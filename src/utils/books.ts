/** 构建期读取与查询书籍数据。 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import type { Book } from "../types/book.js";

const DATA_PATH = resolve(process.cwd(), "data/generated/books.json");
let cache: Book[] | null = null;

export async function getAllBooks(): Promise<Book[]> {
  if (cache) return cache;
  if (!existsSync(DATA_PATH)) return [];

  try {
    const books = JSON.parse(readFileSync(DATA_PATH, "utf-8")) as Book[];
    cache = books.filter((book) => !book.hidden);
    return cache;
  } catch (error) {
    console.error(`[utils/books] 无法加载书籍数据: ${(error as Error).message}`);
    return [];
  }
}

export function bookPath(id: string, base = "/film_wall"): string {
  return `${base}/books/${id}/`;
}
