import type { Movie } from "../types/movie.js";

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])];
}

export function hasPosterSource(movie: Movie): boolean {
  return Boolean(
    movie.posterPath ||
    movie.poster ||
    movie.posterFallback ||
    movie.posterSources?.length
  );
}

/** 返回按优先级排列的本地海报与外部备用地址。 */
export function getPosterSources(movie: Movie, base = ""): string[] {
  const localPoster = movie.posterPath
    ? `${base}/${movie.posterPath.replace(/^\/+/, "")}`
    : undefined;

  return unique([
    localPoster,
    movie.poster,
    ...(movie.posterSources ?? []),
    movie.posterFallback,
  ]);
}
