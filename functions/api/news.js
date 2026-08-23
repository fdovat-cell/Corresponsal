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

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const q = url.searchParams.get('q') || '';

  if (!q) {
    return new Response(JSON.stringify({ articles: [] }), {
      headers: { 'content-type': 'application/json' }
    });
  }

  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;

  try {
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; corresponsal-app/1.0)' }
    });
    const xml = await res.text();

    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .slice(0, 10)
      .map(m => {
        const block = m[1];
        const title = decodeEntities((block.match(/<title>([\s\S]*?)<\/title>/) || [, ''])[1]);
        const link = decodeEntities((block.match(/<link>([\s\S]*?)<\/link>/) || [, ''])[1]);
        const pubDate = decodeEntities((block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [, ''])[1]);
        const source = decodeEntities((block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [, ''])[1]);
        return { title, url: link, domain: source, seendate: pubDate };
      })
      .filter(a => a.title && a.url);

    return new Response(JSON.stringify({ articles: items }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ articles: [], error: String(err) }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }
}
