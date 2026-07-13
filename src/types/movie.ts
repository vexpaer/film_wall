/**
 * 统一电影数据模型
 * 所有最终网页数据基于此类型，原始豆瓣数据经标准化后转为此类型
 */

export interface Movie {
  /** 电影唯一 ID，豆瓣 ID 或手动指定 */
  id: string;

  /** 中文名 */
  title: string;

  /** 影视类型 */
  mediaType: "movie" | "tv";

  /** 原文名 */
  originalTitle?: string;

  /** 上映年份 */
  year?: number;

  /** 上映日期（YYYY-MM-DD 或不完整日期字符串） */
  releaseDate?: string;

  /** 海报图片 URL */
  poster?: string;

  /** 海报备用 URL */
  posterFallback?: string;

  /** 背景图片 URL */
  backdrop?: string;

  /** 导演列表 */
  directors: string[];

  /** 主要演员列表 */
  actors: string[];

  /** 类型标签列表 */
  genres: string[];

  /** 国家/地区列表 */
  countries: string[];

  /** 语言列表 */
  languages: string[];

  /** 豆瓣页面 URL */
  doubanUrl?: string;

  /** 豆瓣评分（0–10） */
  doubanRating?: number;

  /** 个人评分（1–5，对应豆瓣星级；或自定义 1–10） */
  personalRating?: number;

  /** 观看/标记时间（ISO 8601） */
  watchedAt?: string;

  /** 添加到数据集的时间（ISO 8601） */
  addedAt?: string;

  /** 个人短评 */
  shortComment?: string;

  /** 个人长评（支持 Markdown） */
  review?: string;

  /** 影片金句或引用 */
  quote?: string;

  /** 用户自定义标签 */
  tags: string[];

  /** 是否隐藏（不在公开列表显示） */
  hidden: boolean;

  /** 观影状态 */
  status: "watched" | "watching" | "planned";

  /** 数据来源 */
  source: "douban" | "manual" | "merged";

  /** 豆瓣原始 star 值（1–5），保留用于精确映射 */
  doubanStar?: number;

  /** 电影时长（分钟） */
  runtime?: number;

  /** IMDb ID */
  imdbId?: string;

  /** 豆瓣原始数据备注（无法解析的字段） */
  rawNote?: string;
}

/**
 * 豆瓣原始数据字段（doumark-action 导出格式）
 * 字段可能缺失或格式不一致，需兼容处理
 */
export interface DoubanRawMovie {
  id?: string | number;
  title?: string;
  intro?: string;
  poster?: string;
  pubdate?: string | string[];
  url?: string;
  rating?: number | string | DoubanRawRating | null;
  genres?: string | string[];
  star?: number | string;
  comment?: string;
  tags?: string | string[];
  star_time?: string;
  /** 新版导出中的标记时间 */
  create_time?: string;
  /** 新版导出将电影详情放在 subject 中 */
  subject?: DoubanRawSubject;
  /** card 字段包含电影基础信息的混合文本，尝试解析 */
  card?: string;
  /** 可能包含原名 */
  original_title?: string;
  /** 其他未知字段 */
  [key: string]: unknown;
}

export interface DoubanRawRating {
  value?: number | string;
  star_count?: number | string;
}

export interface DoubanRawPerson {
  name?: string;
}

export interface DoubanRawSubject {
  id?: string | number;
  title?: string;
  original_title?: string;
  subtype?: string;
  type?: string;
  year?: string | number;
  pubdate?: string | string[];
  url?: string;
  rating?: DoubanRawRating | null;
  genres?: string | string[];
  cover_url?: string;
  pic?: {
    normal?: string;
    large?: string;
  };
  directors?: DoubanRawPerson[];
  actors?: DoubanRawPerson[];
  card_subtitle?: string;
  [key: string]: unknown;
}

/**
 * 手动维护数据格式
 * key 为电影 ID，value 为可覆盖/补充的字段
 */
export type ManualMoviesData = Record<string, ManualMovieOverride>;

/**
 * 手动覆盖数据，所有字段可选
 * 手动字段优先级高于豆瓣导入字段
 */
export type ManualMovieOverride = Partial<Omit<Movie, "id" | "source">> & {
  /** 如果完全手动录入（非豆瓣），需填写 title */
  title?: string;
};

/**
 * 数据标准化结果
 */
export interface NormalizeResult {
  movies: Movie[];
  warnings: string[];
  errors: string[];
  stats: {
    total: number;
    fromDouban: number;
    fromManual: number;
    merged: number;
    skipped: number;
  };
}
