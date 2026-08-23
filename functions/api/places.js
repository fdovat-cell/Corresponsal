// Búsqueda de lugares puntuales (cafés, restaurantes, hitos, etc.) dentro del radio de una ciudad,
// usando Overpass API (OpenStreetMap) — gratis, sin key. Datos básicos: nombre, dirección, categoría.
// Para fotos/reseñas reales habría que sumar una API paga (Google Places, Foursquare) más adelante;
// queda preparado para eso pero no es parte de esta versión.

const CATEGORY_TAGS = {
  cafe: 'amenity=cafe',
  restaurante: 'amenity=restaurant',
  bar: 'amenity=bar',
  museo: 'tourism=museum',
  monumento: 'historic=monument',
  parque: 'leisure=park',
  mirador: 'tourism=viewpoint',
  mercado: 'amenity=marketplace'
};

async function cacheGet(env, key) {
  try {
    if (!env.PLACES_CACHE) return null;
    const raw = await env.PLACES_CACHE.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
async function cacheSet(env, key, value) {
  try {
    if (!env.PLACES_CACHE) return;
    await env.PLACES_CACHE.put(key, JSON.stringify(value), { expirationTtl: 60 * 60 * 24 });
  } catch (e) { /* sin KV, no pasa nada */ }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const lat = parseFloat(url.searchParams.get('lat'));
  const lon = parseFloat(url.searchParams.get('lon'));
  const category = (url.searchParams.get('category') || 'cafe').toLowerCase();
  const radius = Math.min(parseInt(url.searchParams.get('radius') || '3000', 10) || 3000, 8000);

  if (isNaN(lat) || isNaN(lon)) {
    return json({ places: [], error: 'faltan coordenadas' });
  }

  const tag = CATEGORY_TAGS[category] || CATEGORY_TAGS.cafe;
  const cacheKey = `places:${category}:${radius}:${lat.toFixed(3)}:${lon.toFixed(3)}`;
  const cached = await cacheGet(env, cacheKey);
  if (cached) return json(cached, true);

  const [k, v] = tag.split('=');
  const query = `
    [out:json][timeout:15];
    node["${k}"="${v}"](around:${radius},${lat},${lon});
    out center 20;
  `;

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: query
    });
    const data = await res.json();

    const places = (data.elements || [])
      .filter(el => el.tags && el.tags.name)
      .slice(0, 15)
      .map(el => ({
        name: el.tags.name,
        category,
        address: [el.tags['addr:street'], el.tags['addr:housenumber']].filter(Boolean).join(' ') || null,
        lat: el.lat,
        lon: el.lon,
        mapUrl: `https://www.openstreetmap.org/?mlat=${el.lat}&mlon=${el.lon}#map=19/${el.lat}/${el.lon}`
      }));

    const payload = { places };
    await cacheSet(env, cacheKey, payload);
    return json(payload);
  } catch (err) {
    return json({ places: [], error: String(err) });
  }
}

function json(obj, cached = false) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { 'content-type': 'application/json', 'x-cache': cached ? 'hit' : 'miss' }
  });
}
