/**
 * doumark-action 读取 JSON 增量游标时使用 star_time，但新版数据只含 create_time。
 * 只需为最新一条补齐别名，即可让下一次同步继续抓取新增记录。
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";

for (const filename of ["data/raw/douban/movie.json", "data/raw/douban/book.json"]) {
  if (!existsSync(filename)) continue;
  const text = readFileSync(filename, "utf8");
  const records = JSON.parse(text);
  const newest = Array.isArray(records) ? records[0] : undefined;
  if (!newest?.star_time && newest?.create_time) {
    newest.star_time = newest.create_time;
    writeFileSync(filename, `${JSON.stringify(records, null, "\t")}\n`, "utf8");
  } else if (!text.endsWith("\n")) {
    writeFileSync(filename, `${text}\n`, "utf8");
  }
}
