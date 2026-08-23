function decodeEntities(str) {
  return (str || '')
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

async function cacheGet(env, key) {
  try {
    if (!env.NEWS_CACHE) return null;
    const raw = await env.NEWS_CACHE.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
async function cacheSet(env, key, value, ttlSeconds) {
  try {
    if (!env.NEWS_CACHE) return;
    await env.NEWS_CACHE.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
  } catch (e) { /* sin KV, no pasa nada */ }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  // hl/gl los calcula el cliente según el país del lugar (ver COUNTRY_INFO en index.html).
  // Antes esto estaba fijo en en-US, por eso siempre traía prensa de EEUU sin importar la ciudad.
  const hl = url.searchParams.get('hl') || 'en';
  const gl = (url.searchParams.get('gl') || 'US').toUpperCase();
  const ceid = `${gl}:${hl}`;

  if (!q) {
    return json({ articles: [] });
  }

  const cacheKey = `news:${hl}:${gl}:${q.toLowerCase()}`;
  const cached = await cacheGet(env, cacheKey);
  if (cached) return json(cached, true);

  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&ceid=${encodeURIComponent(ceid)}`;

  try {
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; corresponsal-app/1.0)' }
    });
    const xml = await res.text();

    let items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .map(m => {
        const block = m[1];
        const title = decodeEntities((block.match(/<title>([\s\S]*?)<\/title>/) || [, ''])[1]);
        const link = decodeEntities((block.match(/<link>([\s\S]*?)<\/link>/) || [, ''])[1]);
        const pubDate = decodeEntities((block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [, ''])[1]);
        const source = decodeEntities((block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [, ''])[1]);
        return { title, url: link, domain: source, seendate: pubDate, lang: hl };
      })
      .filter(a => a.title && a.url);

    // Ordenar por fecha real (antes venía en el orden que Google devolvía, sin garantía de recencia)
    items.sort((a, b) => new Date(b.seendate) - new Date(a.seendate));
    items = items.slice(0, 12);

    const payload = { articles: items };
    await cacheSet(env, cacheKey, payload, 60 * 15); // 15 min
    return json(payload);
  } catch (err) {
    return json({ articles: [], error: String(err) });
  }
}

function json(obj, cached = false) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { 'content-type': 'application/json', 'x-cache': cached ? 'hit' : 'miss' }
  });
}
