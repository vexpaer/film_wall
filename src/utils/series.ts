export interface TvSeriesInfo {
  series: string;
  seasonNumber?: number;
}

const chineseDigits: Record<string, number> = {
  "零": 0,
  "〇": 0,
  "一": 1,
  "二": 2,
  "两": 2,
  "三": 3,
  "四": 4,
  "五": 5,
  "六": 6,
  "七": 7,
  "八": 8,
  "九": 9,
};

function parseChineseNumber(value: string): number | undefined {
  if (/^\d+$/.test(value)) return Number(value);

  let total = 0;
  let current = 0;
  for (const char of value) {
    if (char in chineseDigits) {
      current = chineseDigits[char]!;
    } else if (char === "十") {
      total += (current || 1) * 10;
      current = 0;
    } else if (char === "百") {
      total += (current || 1) * 100;
      current = 0;
    } else {
      return undefined;
    }
  }

  const result = total + current;
  return result > 0 ? result : undefined;
}

function cleanSeriesName(value: string): string {
  return value
    .replace(/[\s·:：\-–—]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 从中英文剧名中识别季编号和系列名。
 * 例如“生活大爆炸 第十二季”与“Modern Family: Season 5”。
 */
export function detectTvSeries(
  title: string,
  originalTitle?: string
): TvSeriesInfo | undefined {
  const candidates = [title, originalTitle].filter(
    (value): value is string => Boolean(value?.trim())
  );

  for (const candidate of candidates) {
    const normalized = candidate.replace(/\s+/g, " ").trim();
    const chineseMatch = normalized.match(
      /^(.*?)\s*(?:[·:：\-–—]\s*)?第\s*([零〇一二两三四五六七八九十百\d]+)\s*季(?:\s*[·:：\-–—]\s*.*)?$/
    );
    if (chineseMatch) {
      const series = cleanSeriesName(chineseMatch[1] ?? "");
      if (series) {
        return {
          series,
          seasonNumber: parseChineseNumber(chineseMatch[2] ?? ""),
        };
      }
    }

    const englishMatch = normalized.match(
      /^(.*?)\s*(?:[·:：\-–—]\s*)?(?:season\s*|s)(\d{1,3})(?:\b.*)?$/i
    );
    if (englishMatch) {
      const series = cleanSeriesName(englishMatch[1] ?? "");
      if (series) {
        return { series, seasonNumber: Number(englishMatch[2]) };
      }
    }

    const finalSeasonMatch = normalized.match(/^(.*?)\s+(?:最终季|终季)$/);
    if (finalSeasonMatch) {
      const series = cleanSeriesName(finalSeasonMatch[1] ?? "");
      if (series) return { series };
    }
  }

  return undefined;
}
