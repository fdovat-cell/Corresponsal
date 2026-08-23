export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const text = url.searchParams.get('text') || '';
  const target = url.searchParams.get('target') || 'es';

  if (!text) {
    return new Response(JSON.stringify({ translatedText: '' }), {
      headers: { 'content-type': 'application/json' }
    });
  }

  const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=autodetect|${target}`;

  try {
    const res = await fetch(apiUrl);
    const data = await res.json();
    const translatedText = data?.responseData?.translatedText || text;
    return new Response(JSON.stringify({ translatedText }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ translatedText: text, error: String(err) }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }
}
