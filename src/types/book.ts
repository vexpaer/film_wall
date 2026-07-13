/** 标准化后的书籍数据。 */
export interface Book {
  id: string;
  title: string;
  subtitle?: string;
  authors: string[];
  publisher?: string;
  year?: number;
  publishDate?: string;
  cover?: string;
  coverFallback?: string;
  doubanUrl?: string;
  doubanRating?: number;
  personalRating?: number;
  finishedAt?: string;
  shortComment?: string;
  summary?: string;
  pages?: number;
  tags: string[];
  hidden: boolean;
  status: "read";
  source: "douban" | "manual" | "merged";
}

export interface DoubanRawBookRating {
  value?: number | string;
  star_count?: number | string;
}

export interface DoubanRawBookSubject {
  id?: string | number;
  title?: string;
  book_subtitle?: string;
  author?: string | string[];
  press?: string | string[];
  publisher?: string | string[];
  pubdate?: string | string[];
  cover_url?: string;
  pic?: {
    normal?: string;
    large?: string;
  };
  url?: string;
  rating?: DoubanRawBookRating | null;
  intro?: string;
  pages?: string | number | Array<string | number>;
  card_subtitle?: string;
  [key: string]: unknown;
}

/** doumark-action 的书籍 JSON 兼容格式。 */
export interface DoubanRawBook {
  id?: string | number;
  title?: string;
  intro?: string;
  poster?: string;
  pubdate?: string | string[];
  url?: string;
  rating?: number | string | DoubanRawBookRating | null;
  star?: number | string;
  comment?: string;
  tags?: string | string[];
  star_time?: string;
  create_time?: string;
  subject?: DoubanRawBookSubject;
  [key: string]: unknown;
}

export type ManualBookOverride = Partial<Omit<Book, "id" | "source">> & {
  title?: string;
};

export type ManualBooksData = Record<string, ManualBookOverride>;
