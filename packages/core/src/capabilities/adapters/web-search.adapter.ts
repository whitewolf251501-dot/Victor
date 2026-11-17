/**
 * Web Search Capability Adapter (System 04: Knowledge System / System 05: Capabilities)
 *
 * Implements real web search using Brave Search API (primary)
 * with DuckDuckGo Instant Answer API (fallback).
 */

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchResult {
  query: string;
  results: SearchResultItem[];
  source: 'brave' | 'duckduckgo' | 'none';
  timestamp: string;
  error?: boolean;
}

export interface WebSearchOptions {
  apiKey?: string;
  timeoutMs?: number;
}

export async function executeWebSearch(
  query: string,
  options?: WebSearchOptions
): Promise<WebSearchResult> {
  const timeoutMs = options?.timeoutMs ?? 10000;
  const apiKey = options?.apiKey || process.env.BRAVE_SEARCH_API_KEY;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return {
      query: query || '',
      results: [],
      source: 'none',
      timestamp: new Date().toISOString(),
      error: false,
    };
  }

  const cleanQuery = query.trim();

  // 1. Primary: Brave Search API
  if (apiKey) {
    try {
      const response = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(cleanQuery)}&count=5`,
        {
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip',
            'X-Subscription-Token': apiKey,
          },
          signal: AbortSignal.timeout(timeoutMs),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const results: SearchResultItem[] = (data.web?.results || []).map(
          (item: { title?: string; url?: string; description?: string }) => ({
            title: item.title || '',
            url: item.url || '',
            snippet: item.description || '',
          })
        );

        if (results.length > 0) {
          return {
            query: cleanQuery,
            results,
            source: 'brave',
            timestamp: new Date().toISOString(),
          };
        }
      }
    } catch {
      // Fall through to DuckDuckGo fallback
    }
  }

  // 2. Fallback: DuckDuckGo Instant Answer API
  try {
    const ddgResponse = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=1`,
      {
        headers: {
          'User-Agent': 'VictorNoctis/1.0 (Personal AI Assistant)',
        },
        signal: AbortSignal.timeout(timeoutMs),
      }
    );

    if (ddgResponse.ok) {
      const data = await ddgResponse.json();
      const results: SearchResultItem[] = [];

      if (data.AbstractText) {
        results.push({
          title: data.Heading || cleanQuery,
          url: data.AbstractURL || '',
          snippet: data.AbstractText,
        });
      }

      if (Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics) {
          if (results.length >= 5) break;

          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0] || topic.Text,
              url: topic.FirstURL,
              snippet: topic.Text,
            });
          } else if (Array.isArray(topic.Topics)) {
            for (const sub of topic.Topics) {
              if (results.length >= 5) break;
              if (sub.Text && sub.FirstURL) {
                results.push({
                  title: sub.Text.split(' - ')[0] || sub.Text,
                  url: sub.FirstURL,
                  snippet: sub.Text,
                });
              }
            }
          }
        }
      }

      if (results.length > 0) {
        return {
          query: cleanQuery,
          results,
          source: 'duckduckgo',
          timestamp: new Date().toISOString(),
        };
      }
    }
  } catch {
    // Continue to news search if direct instant answer timed out or failed
  }

  // 3. Fallback for news and general real-time queries (e.g. "latest news about ...")
  try {
    const rssResponse = await fetch(
      `https://news.google.com/rss/search?q=${encodeURIComponent(cleanQuery)}&hl=en-US&gl=US&ceid=US:en`,
      {
        signal: AbortSignal.timeout(timeoutMs),
      }
    );

    if (rssResponse.ok) {
      const text = await rssResponse.text();
      const results: SearchResultItem[] = [];
      const itemMatches = [...text.matchAll(/<item>(.*?)<\/item>/gs)];

      for (const m of itemMatches.slice(0, 5)) {
        const titleMatch = m[1].match(/<title>(.*?)<\/title>/);
        const linkMatch = m[1].match(/<link>(.*?)<\/link>/);
        const descMatch = m[1].match(/<description>(.*?)<\/description>/);

        const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
        const url = linkMatch ? linkMatch[1].trim() : '';
        const snippet = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : title;

        if (title && url) {
          results.push({ title, url, snippet });
        }
      }

      if (results.length > 0) {
        return {
          query: cleanQuery,
          results,
          source: 'duckduckgo',
          timestamp: new Date().toISOString(),
        };
      }
    }
  } catch {
    // Return empty results with error flag, never throw
  }

  return {
    query: cleanQuery,
    results: [],
    source: 'none',
    timestamp: new Date().toISOString(),
    error: true,
  };
}
