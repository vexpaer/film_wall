// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/**
 * GitHub Pages 部署配置
 *
 * site: 替换为你的 GitHub Pages 地址
 *   格式: https://<username>.github.io
 *
 * base: 仓库名（以 / 开头，不含末尾 /）
 *   如果仓库名不是 film_wall，请修改此处
 *
 * 本地开发时 base 路径同样生效，使用 http://localhost:4321/film_wall/
 *
 * 注意：修改 base 后需同步修改 src/config/site.ts 中的 basePath
 */
export default defineConfig({
  site: 'https://vexpaer.github.io',
  base: '/film_wall',
  output: 'static',
  integrations: [
    sitemap(),
  ],
  build: {
    // 资源文件放在 assets 子目录
    assets: 'assets',
  },
  vite: {
    build: {
      // 提高 chunk 警告阈值
      chunkSizeWarningLimit: 600,
    },
  },
});
