// Proxy hacia Nominatim (OpenStreetMap) para:
// 1) Poder mandar un User-Agent identificable (obligatorio por los términos de uso de Nominatim,
//    algo que un fetch desde el navegador no puede hacer).
// 2) Cachear resultados si hay un binding de KV configurado (opcional).
//
// Uso:
//   /api/geocode?q=texto&limit=8&mode=suggest   -> lista de resultados livianos para el autocompletado
//   /api/geocode?q=texto&limit=1&mode=search    -> resultado único (fallback cuando el usuario no eligió de la lista)

const NOMINATIM_UA = 'Corresponsal-App/1.0 (+https://github.com/fdovat-cell/Corresponsal)';
const PLACE_TYPES = new Set([
  'city', 'town', 'village', 'hamlet', 'municipality', 'suburb', 'county',
  'state', 'island', 'locality', 'administrative', 'borough'
]);

async function cacheGet(env, key) {
  try {
    if (!env.GEO_CACHE) return null;
    const raw = await env.GEO_CACHE.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
async function cacheSet(env, key, value, ttlSeconds) {
  try {
    if (!env.GEO_CACHE) return;
    await env.GEO_CACHE.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
  } catch (e) { /* sin KV configurado, seguimos sin cachear */ }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '8', 10) || 8, 10);
  const mode = url.searchParams.get('mode') || 'suggest';

  if (!q || q.length < 2) {
    return json({ results: [] });
  }

  const cacheKey = `geo:${mode}:${limit}:${q.toLowerCase()}`;
  const cached = await cacheGet(env, cacheKey);
  if (cached) return json(cached, true);

  const nomUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&extratags=1&limit=${limit}&accept-language=es&q=${encodeURIComponent(q)}`;

  try {
    const res = await fetch(nomUrl, { headers: { 'User-Agent': NOMINATIM_UA } });
    const raw = await res.json();

    let results = raw;
    if (mode === 'suggest') {
      results = raw.filter(r => PLACE_TYPES.has(r.type) || PLACE_TYPES.has(r.class)).slice(0, 6);
    }

    const shaped = results.map(r => {
      const a = r.address || {};
      const extra = r.extratags || {};
      return {
        displayName: a.city || a.town || a.village || a.municipality || (r.display_name || '').split(',')[0],
        country: a.country || '',
        countryCode: (a.country_code || '').toLowerCase(),
        state: a.state || '',
        lat: r.lat,
        lon: r.lon,
        population: extra.population ? parseInt(extra.population, 10) : null,
        boundingbox: r.boundingbox || null
      };
    });

    const payload = { results: shaped };
    await cacheSet(env, cacheKey, payload, mode === 'suggest' ? 60 * 60 * 24 : 60 * 60 * 6);
    return json(payload);
  } catch (err) {
    return json({ results: [], error: String(err) });
  }
}

function json(obj, cached = false) {
  return new Response(JSON.stringify(obj), {
    headers: { 'content-type': 'application/json', 'x-cache': cached ? 'hit' : 'miss' }
  });
}
