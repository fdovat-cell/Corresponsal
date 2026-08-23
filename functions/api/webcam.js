// Busca una cámara pública cerca de la ciudad vía la API de Windy (windy.com/webcams).
// Requiere una key GRATIS propia en https://api.windy.com/webcams (env.WINDY_API_KEY).
// Si no está configurada, o no hay cámaras cerca, devuelve una lista vacía y el front
// simplemente no muestra el módulo — nunca una imagen vieja o inventada.

async function cacheGet(env, key) {
  try {
    if (!env.WEBCAM_CACHE) return null;
    const raw = await env.WEBCAM_CACHE.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
async function cacheSet(env, key, value) {
  try {
    if (!env.WEBCAM_CACHE) return;
    await env.WEBCAM_CACHE.put(key, JSON.stringify(value), { expirationTtl: 60 * 10 }); // 10 min, son "en vivo"
  } catch (e) { /* sin KV, no pasa nada */ }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const lat = parseFloat(url.searchParams.get('lat'));
  const lon = parseFloat(url.searchParams.get('lon'));

  if (!env.WINDY_API_KEY) {
    return json({ webcams: [], configured: false });
  }
  if (isNaN(lat) || isNaN(lon)) {
    return json({ webcams: [], error: 'faltan coordenadas' });
  }

  const cacheKey = `cam:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const cached = await cacheGet(env, cacheKey);
  if (cached) return json(cached, true);

  // Radio de búsqueda ~40km, hasta 3 cámaras
  const apiUrl = `https://api.windy.com/webcams/api/v3/webcams?nearby=${lat},${lon},40&limit=3&include=images,location`;

  try {
    const res = await fetch(apiUrl, { headers: { 'x-windy-api-key': env.WINDY_API_KEY } });
    if (!res.ok) return json({ webcams: [], error: `HTTP ${res.status}` });
    const data = await res.json();

    const webcams = (data.webcams || []).map(w => ({
      title: w.title,
      city: w.location?.city || '',
      imageUrl: w.images?.current?.preview || w.images?.current?.thumbnail || null,
      updatedAt: w.images?.current?.updated || null,
      viewerUrl: `https://www.windy.com/webcams/${w.webcamId}`
    })).filter(w => w.imageUrl);

    const payload = { webcams, configured: true };
    await cacheSet(env, cacheKey, payload);
    return json(payload);
  } catch (err) {
    return json({ webcams: [], error: String(err) });
  }
}

function json(obj, cached = false) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { 'content-type': 'application/json', 'x-cache': cached ? 'hit' : 'miss' }
  });
}
