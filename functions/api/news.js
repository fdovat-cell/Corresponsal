export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const q = url.searchParams.get('q') || '';
  if (!q) {
    return new Response(JSON.stringify({ articles: [] }), {
      headers: { 'content-type': 'application/json' }
    });
  }

  const gdeltUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&maxrecords=8&sort=datedesc&format=json`;

  try {
    const res = await fetch(gdeltUrl, {
      headers: { 'User-Agent': 'corresponsal-app/1.0' }
    });
    const text = await res.text();
    return new Response(text, {
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ articles: [], error: String(err) }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }
}
