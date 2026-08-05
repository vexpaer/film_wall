# 🎬 Film Wall

> 个人观影与阅读记录 · 自动同步豆瓣 · 部署到 GitHub Pages

![Film Wall](https://img.shields.io/badge/Astro-7.x-orange?logo=astro)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)
![GitHub Pages](https://img.shields.io/badge/部署-GitHub%20Pages-green?logo=github)

一个由 Astro 构建的静态个人电影墙、电视剧墙与书架，支持豆瓣影视和书籍数据自动同步，部署在 GitHub Pages 上。

**演示地址：** `https://<your-username>.github.io/film_wall/`

---

## 📸 页面截图

> 首次构建后，可在此处添加截图。

---

## 🛠 技术栈

| 技术 | 用途 |
|------|------|
| Astro 7.x | 静态站点生成器 |
| TypeScript (strict) | 类型安全 |
| 原生 CSS | 样式（无框架依赖） |
| tsx | 数据处理脚本运行时 |
| GitHub Actions | 自动化流程 |
| GitHub Pages | 静态托管 |
| doumark-action | 豆瓣数据同步 |

---

## 📂 项目结构

```text
film_wall/
├─ .github/
│  └─ workflows/
│     ├─ sync-douban.yml        # 豆瓣数据同步工作流
│     └─ deploy-pages.yml       # GitHub Pages 部署工作流
├─ data/
│  ├─ raw/douban/               # 豆瓣原始电影与书籍数据（自动更新）
│  ├─ manual/                   # 手动补充/覆盖数据
│  └─ generated/                # 构建时生成（不提交到 Git）
├─ scripts/
│  ├─ normalize-movies.ts       # 影视数据标准化脚本
│  ├─ normalize-books.ts        # 书籍数据标准化脚本
│  ├─ cache-posters.mjs         # 多来源海报下载与本地缓存
│  └─ validate-*.ts             # 数据校验脚本
├─ src/
│  ├─ components/               # Astro 组件
│  ├─ config/site.ts            # 站点配置
│  ├─ layouts/BaseLayout.astro  # 页面布局
│  ├─ pages/                    # 页面（自动路由）
│  ├─ styles/global.css         # 全局样式
│  ├─ types/                    # 影视与书籍 TypeScript 类型
│  └─ utils/                    # 构建期数据工具函数
├─ public/
│  └─ posters/movies/           # 可直接部署的本地影视海报缓存
├─ astro.config.mjs             # Astro 配置
├─ package.json
└─ tsconfig.json
```

---

## 🚀 本地运行

```bash
# 克隆仓库
git clone https://github.com/<username>/film_wall.git
cd film_wall

# 安装依赖
npm install

# 生成数据
npm run data:normalize

# 启动开发服务器（访问 http://localhost:4321/film_wall/）
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

---

## ⚙️ 如何修改站点名称

编辑 [`src/config/site.ts`](./src/config/site.ts)：

```ts
export const siteConfig = {
  title: "Film Wall",          // ← 站点主标题
  subtitle: "A personal cinema archive",
  author: "Vexpaer",           // ← 你的昵称
  description: "记录看过的电影、评分与感受。",
  githubUrl: "https://github.com/vexpaer/film_wall",
  // ...
};
```

---

## 📝 如何填写手动电影数据

### 使用本地 Web 编辑器（推荐）

电脑已安装 Python 3 时，在项目目录运行：

```bash
python scripts/movie_editor.py
```

浏览器会自动打开 `http://127.0.0.1:8765/`。选择电影后即可填写 1–5 星评分、
一句话短评和长评；点击保存后，工具只会更新 `data/manual/movies.json`。
按终端中的 `Ctrl+C` 可停止编辑器。

### 直接编辑 JSON

编辑 [`data/manual/movies.json`](./data/manual/movies.json)：

```json
{
  "26910060": {
    "personalRating": 5,
    "shortComment": "轻松、温暖，很适合慢慢看。",
    "review": "这是一段长评，可以使用 **粗体** 和 *斜体*。\n\n不同段落之间在 JSON 中写 `\\n\\n`。",
    "tags": ["喜剧", "家庭"]
  }
}
```

豆瓣电影 ID 就是详情页网址中的数字。例如
`https://movie.douban.com/subject/26910060/` 的 ID 是 `26910060`。

- `personalRating`：个人评分，只能填写 `1`–`5` 的整数。
- `shortComment`：一句话短评，会显示在电影卡片和详情页。
- `review`：长评，支持 Markdown 粗体和斜体；JSON 中换段请写 `\n\n`。
- 不需要填写的字段可以直接省略。

写完后在本地运行 `npm run data:normalize` 即可预览；如果直接在 GitHub
编辑并提交，Pages 工作流会自动重新生成并部署网站。后续豆瓣同步不会覆盖这里的手动评分和评价。

**添加没有豆瓣 ID 的电影**，使用自定义字符串 ID，并填写 `title`：

```json
{
  "my-custom-film-2024": {
    "title": "电影中文名",
    "originalTitle": "Original Title",
    "year": 2024,
    "directors": ["导演名"],
    "actors": ["演员A", "演员B"],
    "genres": ["剧情"],
    "countries": ["美国"],
    "personalRating": 4,
    "review": "我的评价",
    "status": "watched",
    "watchedAt": "2024-06-01T00:00:00.000Z"
  }
}
```

然后运行：

```bash
npm run data:normalize
```

**数据合并优先级（高 → 低）：**

```
手动填写字段 > 豆瓣导入字段 > 默认值
```

> ⚠️ **不要直接编辑 `data/generated/`**。它是可随时重建且不提交到 Git 的构建产物；
> 自定义内容请写入 `data/manual/`。

### 电视剧系列识别

标准化脚本会从“第一季”“第十二季”“Season 2”“S03”等中英文剧名后缀自动提取
`series` 和 `seasonNumber`。电视剧墙会显示系列标签，并提供系列下拉框和快捷标签筛选。
如自动结果不符合预期，可在 `data/manual/movies.json` 中为对应 ID 手动填写：

```json
{
  "电视剧 ID": {
    "series": "系列名称",
    "seasonNumber": 2
  }
}
```

---

## 🔄 如何同步豆瓣数据

### 1. 配置豆瓣用户 ID

在 GitHub 仓库页面：

1. 进入 **Settings → Secrets and variables → Actions**
2. 点击 **Variables** 标签（不是 Secrets）
3. 点击 **New repository variable**
4. 填写：
   - Name: `DOUBAN_USER_ID`
   - Value: 你的豆瓣用户 ID（纯数字）

**如何找到豆瓣用户 ID？**

登录豆瓣后，访问 `https://www.douban.com/people/<your-id>/`，URL 中的数字即为用户 ID。

### 2. 手动触发同步

在 GitHub 仓库页面：

1. 进入 **Actions** 标签
2. 选择左侧 **Sync Douban Library**
3. 点击右侧 **Run workflow**

### 3. 自动同步

工作流配置为每周一自动执行，同时同步“看过”的电影/电视剧和“读过”的书。
机器人只提交 `data/raw/douban/` 中发生变化的豆瓣原始数据，以及按影视 ID
独立保存的 `public/posters/movies/` 海报缓存；不会提交或修改 `data/manual/`
中的个人笔记。`data/generated/` 会在部署时重新生成，因此不会再和笔记提交发生 Git 冲突。

---

## 📄 如何启用 GitHub Pages

1. 进入仓库 **Settings → Pages**
2. Source 选择 **GitHub Actions**
3. 点击保存

首次推送到 `main` 分支后，部署工作流会自动运行。

**部署地址：**

```
https://<username>.github.io/film_wall/
```

---

## 🏗 如何部署

推送到 `main` 分支即自动触发构建和部署：

```bash
git add .
git commit -m "update movies"
git push origin main
```

也可在 Actions 页面手动触发 **Deploy to GitHub Pages**。

---

## 🗃 数据字段说明

影视数据生成到 `data/generated/movies.json`，并按 `mediaType` 分别显示在电影墙和电视剧墙。
书籍数据生成到 `data/generated/books.json`，包含书名、作者、出版社、出版时间、页数、评分、封面和读完时间等字段。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 电影唯一 ID（豆瓣 subject ID） |
| `title` | string | 中文名 |
| `mediaType` | enum | `movie`（电影）或 `tv`（剧集） |
| `originalTitle` | string? | 原文名 |
| `year` | number? | 上映年份 |
| `poster` | string? | 海报图片 URL |
| `posterSources` | string[]? | 外部海报备用地址列表 |
| `posterPath` | string? | `public/` 下的本地海报缓存路径 |
| `directors` | string[] | 导演列表 |
| `actors` | string[] | 演员列表 |
| `genres` | string[] | 类型标签 |
| `countries` | string[] | 国家/地区 |
| `series` | string? | 自动识别或手动指定的电视剧系列 |
| `seasonNumber` | number? | 自动识别或手动指定的季数 |
| `doubanRating` | number? | 豆瓣评分（0–10） |
| `personalRating` | number? | 个人评分（1–5） |
| `watchedAt` | string? | 观看时间（ISO 8601） |
| `shortComment` | string? | 个人短评 |
| `review` | string? | 个人长评（Markdown） |
| `quote` | string? | 影片金句 |
| `tags` | string[] | 用户标签 |
| `hidden` | boolean | 是否隐藏（不公开显示） |
| `status` | enum | `watched`/`watching`/`planned` |
| `source` | enum | `douban`/`manual`/`merged` |

---

## ❓ 常见问题

### 海报链接失效怎么办？

影视海报不会再直接依赖浏览器访问豆瓣。运行 `npm run data:normalize` 时会按以下
顺序寻找图片并缓存到 `public/posters/movies/`：已有本地缓存、手动 URL、豆瓣大/中/小图、
豆瓣导出的封面代理、TMDB、TVmaze、Fanart.tv 和 OMDb。页面优先加载本地文件，失败时
才按外部来源列表回退。TVmaze 无需密钥，仅用于电视剧；其他第三方 API 都是可选备用源。

需要时可在本地环境或 GitHub Actions Secrets 中配置：

- `TMDB_API_READ_ACCESS_TOKEN`：推荐，TMDB API Read Access Token
- `TMDB_API_KEY`：兼容旧式 API Key
- `FANART_API_KEY`：Fanart.tv Project API Key
- `FANART_CLIENT_KEY`：可选的 Fanart.tv Personal API Key
- `OMDB_API_KEY`：OMDb API Key

不配置任何第三方密钥也可以正常工作：当前缓存会直接使用仓库中的本地海报，新增电视剧
还可在前面来源都失败时自动尝试 TVmaze。

个别图片仍失效时：
- 在 `data/manual/movies.json` 中为对应电影添加 `poster`，也可用 `posterSources` 提供多个自定义备用 URL
- 在 `data/manual/books.json` 中为对应书籍添加 `cover` 字段，指向可访问的图片 URL
- 网站对无海报电影会显示美观的占位符，不会破坏布局

### 如何关闭豆瓣同步，只用手动数据？

1. 在 GitHub Actions 中禁用 `sync-douban.yml` 工作流
2. 或者不配置 `DOUBAN_USER_ID`（工作流会自动跳过同步步骤）
3. 在 `data/manual/movies.json` 和 `data/manual/books.json` 中手动填写数据

### 构建时生成数据不存在？

先运行：

```bash
npm run data:normalize
```

### 豆瓣同步失败？

doumark-action 可能因豆瓣反爬虫机制失败。
- 检查 Actions 日志了解具体错误
- 如需要，可在 Secrets 中添加 `DOUBAN_COOKIE` 并在工作流中启用

### 如何添加没有豆瓣 ID 的电影？

使用任意字符串作为 ID，在 `data/manual/movies.json` 中添加完整的电影信息（必须包含 `title` 字段）。参见上方「如何填写手动电影数据」。

---

## 🗂 数据安全说明

- 没有任何 Token 或 Secret 写入仓库
- 工作流引用 `vars.DOUBAN_USER_ID`，并可选读取 TMDB、Fanart.tv、OMDb Secrets；Secret 不会写入生成数据或网页
- 影视海报优先从本站静态目录加载，客户端不暴露任何 API 密钥
