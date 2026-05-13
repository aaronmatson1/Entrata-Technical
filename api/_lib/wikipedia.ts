/**
 * Q3 + Q7: server-side Wikipedia fetch with opensearch fuzzy fallback,
 * fail closed if no article found. Truncate before prompt injection
 * to bound context size and reduce prompt-injection surface.
 */

const MAX_SUMMARY_CHARS = 3000;
const FUZZY_TIMEOUT_MS = 4000;
const SUMMARY_TIMEOUT_MS = 4000;

export interface WikipediaContext {
  title: string;
  summary: string;
  url: string;
}

export class WikipediaNotFoundError extends Error {
  constructor() {
    super('No Wikipedia article found for topic');
    this.name = 'WikipediaNotFoundError';
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AI-Quiz-Builder/0.1 (educational)' },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSummary(title: string): Promise<WikipediaContext | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetchWithTimeout(url, SUMMARY_TIMEOUT_MS);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    title?: string;
    extract?: string;
    content_urls?: { desktop?: { page?: string } };
    type?: string;
  };
  if (data.type === 'disambiguation') return null;
  if (!data.extract || data.extract.length < 50) return null;
  const rawUrl = data.content_urls?.desktop?.page;
  const safeUrl =
    typeof rawUrl === 'string' && rawUrl.startsWith('https://en.wikipedia.org/')
      ? rawUrl
      : `https://en.wikipedia.org/wiki/${encodeURIComponent(data.title ?? title)}`;
  return {
    title: data.title ?? title,
    summary: data.extract.slice(0, MAX_SUMMARY_CHARS),
    url: safeUrl,
  };
}

async function fuzzyFind(query: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=opensearch&limit=1&namespace=0&format=json&search=${encodeURIComponent(query)}`;
  const res = await fetchWithTimeout(url, FUZZY_TIMEOUT_MS);
  if (!res.ok) return null;
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data) || data.length < 2) return null;
  const matches = data[1];
  if (!Array.isArray(matches) || matches.length === 0) return null;
  const first = matches[0];
  return typeof first === 'string' && first.length > 0 ? first : null;
}

export async function getWikipediaContext(topic: string): Promise<WikipediaContext> {
  const direct = await fetchSummary(topic);
  if (direct) return direct;

  const fuzzy = await fuzzyFind(topic);
  if (fuzzy && fuzzy !== topic) {
    const viaFuzzy = await fetchSummary(fuzzy);
    if (viaFuzzy) return viaFuzzy;
  }

  throw new WikipediaNotFoundError();
}
