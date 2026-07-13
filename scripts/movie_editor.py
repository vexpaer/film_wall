#!/usr/bin/env python3
"""本地电影评分与评价编辑器。仅监听本机并写入 data/manual/movies.json。"""

from __future__ import annotations

import argparse
import json
import os
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parents[1]
GENERATED_PATH = ROOT / "data" / "generated" / "movies.json"
MANUAL_PATH = ROOT / "data" / "manual" / "movies.json"
EDITABLE_FIELDS = ("personalRating", "shortComment", "review")


INDEX_HTML = r"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Film Wall · 评分与评价编辑器</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #09090d;
      --panel: #111118;
      --panel-2: #181821;
      --border: #2a2a36;
      --text: #f4f1e9;
      --muted: #9897a6;
      --accent: #f5a623;
      --accent-2: #ffc866;
      --danger: #ff6b6b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: radial-gradient(circle at 70% -20%, #2b2015 0, var(--bg) 42%);
      color: var(--text);
      font-family: Inter, "Microsoft YaHei", system-ui, sans-serif;
    }
    button, input, textarea { font: inherit; }
    button { color: inherit; }
    .app { display: grid; grid-template-columns: 360px 1fr; min-height: 100vh; }
    .sidebar {
      height: 100vh;
      position: sticky;
      top: 0;
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--border);
      background: rgba(13, 13, 18, .94);
      backdrop-filter: blur(16px);
    }
    .sidebar-head { padding: 24px 20px 16px; border-bottom: 1px solid var(--border); }
    h1 { margin: 0; font-size: 20px; letter-spacing: -.02em; }
    .subtitle { margin: 7px 0 16px; color: var(--muted); font-size: 13px; }
    .search {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--panel-2);
      color: var(--text);
      padding: 11px 13px;
      outline: none;
    }
    .search:focus { border-color: var(--accent); box-shadow: 0 0 0 3px #f5a62322; }
    .summary { margin-top: 10px; color: var(--muted); font-size: 12px; }
    .movie-list { overflow-y: auto; padding: 8px; }
    .movie-item {
      width: 100%;
      display: grid;
      grid-template-columns: 44px 1fr auto;
      gap: 11px;
      align-items: center;
      padding: 9px;
      border: 1px solid transparent;
      border-radius: 10px;
      background: transparent;
      text-align: left;
      cursor: pointer;
    }
    .movie-item:hover { background: var(--panel-2); }
    .movie-item.active { border-color: #f5a62366; background: #f5a62312; }
    .thumb {
      width: 44px;
      height: 62px;
      object-fit: cover;
      border-radius: 6px;
      background: var(--panel-2);
    }
    .thumb-placeholder { display: grid; place-items: center; color: var(--muted); font-size: 18px; }
    .movie-name { display: block; font-size: 14px; font-weight: 650; line-height: 1.35; }
    .movie-meta { display: block; margin-top: 4px; color: var(--muted); font-size: 12px; }
    .rating-pill { color: var(--accent-2); font-size: 12px; white-space: nowrap; }
    .editor { padding: 46px clamp(24px, 6vw, 92px); }
    .empty { min-height: 70vh; display: grid; place-items: center; color: var(--muted); }
    .editor-inner { max-width: 860px; margin: 0 auto; }
    .movie-header { display: grid; grid-template-columns: 112px 1fr; gap: 24px; align-items: end; }
    .poster {
      width: 112px;
      aspect-ratio: 2 / 3;
      object-fit: cover;
      border-radius: 12px;
      background: var(--panel-2);
      box-shadow: 0 16px 42px #0008;
    }
    .eyebrow { color: var(--accent); font-size: 12px; font-weight: 700; letter-spacing: .1em; }
    .movie-title { margin: 8px 0; font-size: clamp(28px, 5vw, 48px); line-height: 1.05; letter-spacing: -.04em; }
    .movie-subline { color: var(--muted); font-size: 14px; }
    .form-card {
      margin-top: 30px;
      padding: clamp(20px, 4vw, 32px);
      border: 1px solid var(--border);
      border-radius: 18px;
      background: rgba(17, 17, 24, .92);
      box-shadow: 0 18px 60px #0005;
    }
    .field { margin-bottom: 26px; }
    .field:last-of-type { margin-bottom: 0; }
    .label-row { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 9px; }
    label, .field-label { font-size: 14px; font-weight: 700; }
    .hint { color: var(--muted); font-size: 12px; }
    .stars { display: flex; align-items: center; gap: 7px; }
    .star {
      border: 0;
      background: transparent;
      color: #494854;
      font-size: 32px;
      line-height: 1;
      padding: 2px;
      cursor: pointer;
      transition: color .12s, transform .12s;
    }
    .star:hover { transform: translateY(-2px); }
    .star.on { color: var(--accent); }
    .clear-rating {
      margin-left: 8px;
      border: 0;
      background: transparent;
      color: var(--muted);
      font-size: 12px;
      cursor: pointer;
    }
    textarea {
      width: 100%;
      resize: vertical;
      border: 1px solid var(--border);
      border-radius: 11px;
      background: var(--panel-2);
      color: var(--text);
      padding: 13px 14px;
      line-height: 1.65;
      outline: none;
    }
    textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px #f5a62322; }
    #short-comment { min-height: 88px; }
    #review { min-height: 230px; }
    .actions { display: flex; align-items: center; gap: 14px; margin-top: 28px; }
    .save {
      border: 0;
      border-radius: 10px;
      background: var(--accent);
      color: #1a1207;
      padding: 11px 22px;
      font-weight: 800;
      cursor: pointer;
    }
    .save:hover { background: var(--accent-2); }
    .save:disabled { opacity: .55; cursor: wait; }
    .status { color: var(--muted); font-size: 13px; }
    .status.error { color: var(--danger); }
    .footer-note { margin-top: 18px; color: var(--muted); font-size: 12px; line-height: 1.6; }
    code { color: var(--accent-2); }
    @media (max-width: 760px) {
      .app { grid-template-columns: 1fr; }
      .sidebar { position: static; height: 42vh; border-right: 0; border-bottom: 1px solid var(--border); }
      .editor { padding: 28px 18px 48px; }
      .movie-header { grid-template-columns: 82px 1fr; gap: 16px; }
      .poster { width: 82px; }
    }
  </style>
</head>
<body>
  <main class="app">
    <aside class="sidebar">
      <div class="sidebar-head">
        <h1>Film Wall 编辑器</h1>
        <p class="subtitle">本地评分与评价管理</p>
        <input id="search" class="search" type="search" placeholder="搜索电影名或 ID…" autocomplete="off">
        <div id="summary" class="summary">正在加载电影…</div>
      </div>
      <div id="movie-list" class="movie-list" aria-label="电影列表"></div>
    </aside>

    <section class="editor">
      <div id="empty" class="empty">请从左侧选择一部电影</div>
      <div id="editor-inner" class="editor-inner" hidden>
        <header class="movie-header">
          <div id="poster-wrap"></div>
          <div>
            <div class="eyebrow">PERSONAL NOTES</div>
            <h2 id="movie-title" class="movie-title"></h2>
            <div id="movie-subline" class="movie-subline"></div>
          </div>
        </header>

        <form id="form" class="form-card">
          <div class="field">
            <div class="label-row">
              <span class="field-label">我的评分</span>
              <span id="rating-label" class="hint">未评分</span>
            </div>
            <div id="stars" class="stars" aria-label="个人评分"></div>
          </div>

          <div class="field">
            <div class="label-row">
              <label for="short-comment">一句话短评</label>
              <span class="hint">显示在电影卡片和详情页</span>
            </div>
            <textarea id="short-comment" maxlength="500" placeholder="用一句话记下最直接的感受…"></textarea>
          </div>

          <div class="field">
            <div class="label-row">
              <label for="review">长评</label>
              <span class="hint">支持 **粗体**、*斜体* 和空行分段</span>
            </div>
            <textarea id="review" placeholder="慢慢写下这部电影留给你的东西…"></textarea>
          </div>

          <div class="actions">
            <button id="save" class="save" type="submit">保存到 manual/movies.json</button>
            <span id="status" class="status" role="status"></span>
          </div>
          <p class="footer-note">保存后运行 <code>npm run data:normalize</code> 可更新本地生成数据；推送到 GitHub 后 Pages 会自动构建。</p>
        </form>
      </div>
    </section>
  </main>

  <script>
    const state = { movies: [], selectedId: null, rating: null, dirty: false };
    const list = document.querySelector('#movie-list');
    const search = document.querySelector('#search');
    const summary = document.querySelector('#summary');
    const empty = document.querySelector('#empty');
    const editor = document.querySelector('#editor-inner');
    const form = document.querySelector('#form');
    const stars = document.querySelector('#stars');
    const ratingLabel = document.querySelector('#rating-label');
    const shortComment = document.querySelector('#short-comment');
    const review = document.querySelector('#review');
    const status = document.querySelector('#status');
    const saveButton = document.querySelector('#save');

    function element(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }

    function filteredMovies() {
      const query = search.value.trim().toLocaleLowerCase('zh-CN');
      if (!query) return state.movies;
      return state.movies.filter(movie =>
        movie.id.toLocaleLowerCase().includes(query) ||
        movie.title.toLocaleLowerCase('zh-CN').includes(query) ||
        (movie.originalTitle || '').toLocaleLowerCase().includes(query)
      );
    }

    function poster(movie, className) {
      if (!movie.poster) return element('div', `${className} thumb-placeholder`, '🎬');
      const image = element('img', className);
      image.src = movie.poster;
      image.dataset.fallbackSrc = movie.posterFallback || '';
      image.alt = `${movie.title} 海报`;
      image.referrerPolicy = 'no-referrer';
      image.addEventListener('error', () => {
        const fallback = image.dataset.fallbackSrc;
        if (fallback) {
          delete image.dataset.fallbackSrc;
          image.src = fallback;
        } else {
          image.replaceWith(element('div', `${className} thumb-placeholder`, '🎬'));
        }
      });
      return image;
    }

    function renderList() {
      const movies = filteredMovies();
      list.replaceChildren();
      for (const movie of movies) {
        const button = element('button', `movie-item${movie.id === state.selectedId ? ' active' : ''}`);
        button.type = 'button';
        button.append(poster(movie, 'thumb'));
        const info = element('span');
        info.append(element('span', 'movie-name', movie.title));
        info.append(element('span', 'movie-meta', [movie.mediaType === 'tv' ? '剧集' : '电影', movie.year, movie.id].filter(Boolean).join(' · ')));
        button.append(info);
        button.append(element('span', 'rating-pill', movie.personalRating ? `${'★'.repeat(movie.personalRating)}` : ''));
        button.addEventListener('click', () => selectMovie(movie.id));
        list.append(button);
      }
      const edited = state.movies.filter(movie => movie.hasManualEdit).length;
      summary.textContent = `${movies.length} / ${state.movies.length} 部电影 · ${edited} 部已手动编辑`;
    }

    function renderStars() {
      stars.replaceChildren();
      for (let value = 1; value <= 5; value += 1) {
        const button = element('button', `star${state.rating && value <= state.rating ? ' on' : ''}`, '★');
        button.type = 'button';
        button.setAttribute('aria-label', `${value} 星`);
        button.addEventListener('click', () => {
          state.rating = value;
          state.dirty = true;
          renderStars();
        });
        stars.append(button);
      }
      const clear = element('button', 'clear-rating', '清除评分');
      clear.type = 'button';
      clear.addEventListener('click', () => {
        state.rating = null;
        state.dirty = true;
        renderStars();
      });
      stars.append(clear);
      ratingLabel.textContent = state.rating ? `${state.rating} / 5` : '未评分';
    }

    function selectMovie(id) {
      if (state.dirty && id !== state.selectedId && !window.confirm('当前修改尚未保存，确定切换电影吗？')) return;
      const movie = state.movies.find(item => item.id === id);
      if (!movie) return;
      state.selectedId = id;
      state.rating = movie.personalRating ?? null;
      state.dirty = false;
      empty.hidden = true;
      editor.hidden = false;
      document.querySelector('#movie-title').textContent = movie.title;
      document.querySelector('#movie-subline').textContent = [movie.mediaType === 'tv' ? '剧集' : '电影', movie.year, `豆瓣 ${movie.doubanRating ?? '—'}`, `ID ${movie.id}`].filter(Boolean).join(' · ');
      const posterWrap = document.querySelector('#poster-wrap');
      posterWrap.replaceChildren(poster(movie, 'poster'));
      shortComment.value = movie.shortComment || '';
      review.value = movie.review || '';
      status.textContent = movie.hasManualEdit ? '已载入手动数据' : '';
      status.classList.remove('error');
      renderStars();
      renderList();
    }

    async function save() {
      if (!state.selectedId || saveButton.disabled) return;
      saveButton.disabled = true;
      status.textContent = '正在保存…';
      status.classList.remove('error');
      try {
        const response = await fetch(`/api/movies/${encodeURIComponent(state.selectedId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personalRating: state.rating,
            shortComment: shortComment.value,
            review: review.value,
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '保存失败');
        const index = state.movies.findIndex(movie => movie.id === result.movie.id);
        state.movies[index] = result.movie;
        state.rating = result.movie.personalRating ?? null;
        state.dirty = false;
        status.textContent = '已保存';
        renderStars();
        renderList();
      } catch (error) {
        status.textContent = error.message;
        status.classList.add('error');
      } finally {
        saveButton.disabled = false;
      }
    }

    form.addEventListener('submit', event => { event.preventDefault(); save(); });
    shortComment.addEventListener('input', () => { state.dirty = true; });
    review.addEventListener('input', () => { state.dirty = true; });
    search.addEventListener('input', renderList);
    window.addEventListener('beforeunload', event => {
      if (state.dirty) { event.preventDefault(); event.returnValue = ''; }
    });
    window.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 's') {
        event.preventDefault();
        save();
      }
    });

    fetch('/api/movies')
      .then(response => response.json().then(data => ({ response, data })))
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data.error || '加载失败');
        state.movies = data.movies;
        renderList();
        if (state.movies.length) selectMovie(state.movies[0].id);
      })
      .catch(error => {
        summary.textContent = error.message;
        summary.style.color = 'var(--danger)';
      });
  </script>
</body>
</html>
"""


def read_json(path: Path, expected_type: type) -> object:
    if not path.exists():
        raise FileNotFoundError(f"文件不存在: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, expected_type):
        raise ValueError(f"JSON 根节点格式错误: {path}")
    return data


def load_manual() -> dict[str, object]:
    if not MANUAL_PATH.exists():
        return {}
    return read_json(MANUAL_PATH, dict)  # type: ignore[return-value]


def movies_for_ui() -> list[dict[str, object]]:
    movies = read_json(GENERATED_PATH, list)
    manual = load_manual()
    result: list[dict[str, object]] = []

    for raw_movie in movies:  # type: ignore[union-attr]
        if not isinstance(raw_movie, dict):
            continue
        movie_id = str(raw_movie.get("id", ""))
        override = manual.get(movie_id, {})
        if not isinstance(override, dict):
            override = {}
        result.append(
            {
                "id": movie_id,
                "title": raw_movie.get("title", "未命名电影"),
                "mediaType": raw_movie.get("mediaType", "movie"),
                "originalTitle": raw_movie.get("originalTitle"),
                "year": raw_movie.get("year"),
                "poster": raw_movie.get("poster"),
                "posterFallback": raw_movie.get("posterFallback"),
                "doubanRating": raw_movie.get("doubanRating"),
                "personalRating": override.get("personalRating", raw_movie.get("personalRating")),
                "shortComment": override.get("shortComment", raw_movie.get("shortComment", "")),
                "review": override.get("review", raw_movie.get("review", "")),
                "hasManualEdit": any(field in override for field in EDITABLE_FIELDS),
            }
        )

    return result


def save_movie(movie_id: str, payload: object) -> dict[str, object]:
    if not isinstance(payload, dict):
        raise ValueError("请求内容必须是 JSON 对象")

    known_ids = {movie["id"] for movie in movies_for_ui()}
    if movie_id not in known_ids:
        raise ValueError(f"找不到电影 ID: {movie_id}")

    rating = payload.get("personalRating")
    if rating is not None and (isinstance(rating, bool) or not isinstance(rating, int) or not 1 <= rating <= 5):
        raise ValueError("personalRating 必须是 1–5 的整数或 null")

    manual = load_manual()
    current = manual.get(movie_id, {})
    if not isinstance(current, dict):
        raise ValueError(f"手动数据 ID={movie_id} 不是对象，无法编辑")
    override = dict(current)

    if rating is None:
        override.pop("personalRating", None)
    else:
        override["personalRating"] = rating

    for field in ("shortComment", "review"):
        value = payload.get(field, "")
        if not isinstance(value, str):
            raise ValueError(f"{field} 必须是字符串")
        value = value.strip()
        if value:
            override[field] = value
        else:
            override.pop(field, None)

    if override:
        manual[movie_id] = override
    else:
        manual.pop(movie_id, None)

    MANUAL_PATH.parent.mkdir(parents=True, exist_ok=True)
    temp_path = MANUAL_PATH.with_suffix(".json.tmp")
    temp_path.write_text(json.dumps(manual, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temp_path, MANUAL_PATH)

    return next(movie for movie in movies_for_ui() if movie["id"] == movie_id)


class MovieEditorHandler(BaseHTTPRequestHandler):
    server_version = "FilmWallEditor/1.0"

    def send_bytes(self, status: int, content_type: str, body: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'",
        )
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, status: int, payload: object) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_bytes(status, "application/json; charset=utf-8", body)

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        try:
            if path == "/":
                self.send_bytes(200, "text/html; charset=utf-8", INDEX_HTML.encode("utf-8"))
            elif path == "/api/movies":
                self.send_json(200, {"movies": movies_for_ui()})
            elif path == "/favicon.ico":
                self.send_bytes(204, "image/x-icon", b"")
            else:
                self.send_json(404, {"error": "页面不存在"})
        except (OSError, ValueError, json.JSONDecodeError) as error:
            self.send_json(500, {"error": str(error)})

    def do_PUT(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        prefix = "/api/movies/"
        if not path.startswith(prefix):
            self.send_json(404, {"error": "接口不存在"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 1_000_000:
                raise ValueError("请求大小无效")
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            movie = save_movie(unquote(path[len(prefix) :]), payload)
            self.send_json(200, {"ok": True, "movie": movie})
        except (OSError, ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": str(error)})

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"[movie-editor] {self.address_string()} - {fmt % args}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="打开 Film Wall 本地评分与评价编辑器")
    parser.add_argument("--port", type=int, default=8765, help="本地端口，默认 8765")
    parser.add_argument("--no-browser", action="store_true", help="启动时不自动打开浏览器")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), MovieEditorHandler)
    url = f"http://127.0.0.1:{server.server_port}/"
    print(f"\nFilm Wall 编辑器已启动: {url}")
    print("按 Ctrl+C 停止。\n")
    if not args.no_browser:
        threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n正在停止编辑器…")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
