/**
 * 站点全局配置
 * 修改此文件以自定义站点标题、作者名等信息
 */
export const siteConfig = {
  /** 站点主标题 */
  title: "Film Wall",

  /** 副标题 */
  subtitle: "A personal cinema archive",

  /** 作者/昵称，显示在关于页面等处 */
  author: "Vexpaer",

  /** 站点描述（用于 SEO meta description） */
  description: "记录看过的电影、评分与感受。",

  /** GitHub 仓库地址（可留空） */
  githubUrl: "https://github.com/vexpaer/film_wall",

  /** 默认主题 */
  defaultTheme: "dark" as const,

  /**
   * GitHub Pages 部署的基础路径
   * 与 astro.config.mjs 中的 base 保持一致
   * 例如 "/film_wall"（仓库名，以 / 开头，不含末尾 /）
   * 本地开发时留空字符串 "" 即可（由 astro.config.mjs 控制）
   */
  basePath: "/film_wall",

  /** 每页显示电影数量 */
  moviesPerPage: 24,

  /** 电影墙默认排序 */
  defaultSort: "watchedAt" as const,

  /** 是否显示隐藏电影（hidden: true） */
  showHidden: false,

  /** 网站语言 */
  lang: "zh-CN",

  /** 个人评分最大值 */
  ratingScale: 5 as const,
} as const;

export type SiteConfig = typeof siteConfig;
