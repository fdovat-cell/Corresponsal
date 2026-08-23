// Traducción con fallback en cascada:
// 1) DeepL (si hay env.DEEPL_API_KEY configurada) — mejor calidad y cuota (500k caracteres/mes gratis).
// 2) MyMemory (gratis, sin key, pero se agota rápido) — funciona igual sin configurar nada.
// Además cachea traducciones repetidas si hay un binding de KV (env.TRANSLATE_CACHE).

async function cacheGet(env, key) {
  try {
    if (!env.TRANSLATE_CACHE) return null;
    return await env.TRANSLATE_CACHE.get(key);
  } catch (e) { return null; }
}
async function cacheSet(env, key, value) {
  try {
    if (!env.TRANSLATE_CACHE) return;
    await env.TRANSLATE_CACHE.put(key, value, { expirationTtl: 60 * 60 * 24 * 30 }); // 30 días
  } catch (e) { /* sin KV, no pasa nada */ }
}

async function translateWithDeepL(text, target, apiKey) {
  const res = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ text, target_lang: target.toUpperCase() })
  });
  if (!res.ok) throw new Error(`DeepL HTTP ${res.status}`);
  const data = await res.json();
  return data?.translations?.[0]?.text || null;
}

async function translateWithMyMemory(text, target, env) {
  // Si configurás env.MYMEMORY_EMAIL (variable de entorno, gratis, sin trámite),
  // MyMemory sube la cuota diaria de ~5.000 a ~50.000 caracteres.
  const deParam = env?.MYMEMORY_EMAIL ? `&de=${encodeURIComponent(env.MYMEMORY_EMAIL)}` : '';
  const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=autodetect|${target}${deParam}`;
  const res = await fetch(apiUrl);
  const data = await res.json();

  // Cuando se agota la cuota gratis, MyMemory NO da un error HTTP: devuelve
  // responseStatus != 200 y/o un texto de advertencia en mayúsculas en vez de la
  // traducción real. Si no detectamos esto, ese aviso se mostraba como si fuera
  // el título traducido — el bug de las mayúsculas en inglés.
  const translated = data?.responseData?.translatedText || '';
  const quotaExceeded = data?.responseStatus !== 200 || /MYMEMORY WARNING|QUOTA|LIMIT/i.test(translated);
  if (quotaExceeded || !translated) {
    throw new Error('mymemory sin cuota disponible');
  }
  return translated;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const text = url.searchParams.get('text') || '';
  const target = (url.searchParams.get('target') || 'es').toLowerCase();

  if (!text) {
    return json({ translatedText: '' });
  }

  const cacheKey = `tr:${target}:${text}`;
  const cachedText = await cacheGet(env, cacheKey);
  if (cachedText) return json({ translatedText: cachedText, engine: 'cache' });

  let translatedText = null;
  let engine = null;

  if (env.DEEPL_API_KEY) {
    try {
      translatedText = await translateWithDeepL(text, target, env.DEEPL_API_KEY);
      engine = 'deepl';
    } catch (e) { /* cae a MyMemory */ }
  }

  if (!translatedText) {
    try {
      translatedText = await translateWithMyMemory(text, target, env);
      engine = 'mymemory';
    } catch (e) { /* devolvemos el original abajo, con el error marcado */ }
  }

  if (!translatedText) {
    // Devolvemos el texto ORIGINAL (nunca un mensaje de error disfrazado de traducción)
    // y marcamos el error para que el front pueda avisar en vez de mostrarlo como traducido.
    return json({ translatedText: text, error: 'sin motores de traducción disponibles por ahora' });
  }

  await cacheSet(env, cacheKey, translatedText);
  return json({ translatedText, engine });
}

function json(obj) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}
