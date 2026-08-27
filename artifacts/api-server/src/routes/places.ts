import { Router, type IRouter } from "express";
import {
  GetNearbyPlacesQueryParams,
  GetPlaceBriefQueryParams,
  GetPlaceNewsQueryParams,
  SuggestPlacesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
};

const weatherDescriptions: Record<number, string> = {
  0: "Despejado",
  1: "Mayormente despejado",
  2: "Parcialmente nublado",
  3: "Nublado",
  45: "Niebla",
  48: "Niebla",
  51: "Llovizna",
  53: "Llovizna",
  55: "Llovizna",
  61: "Lluvia",
  63: "Lluvia",
  65: "Lluvia intensa",
  71: "Nieve",
  73: "Nieve",
  75: "Nieve intensa",
  80: "Chaparrones",
  81: "Chaparrones",
  82: "Tormentas",
  95: "Tormenta",
  96: "Tormenta",
  99: "Tormenta",
};

const weatherIcons: Record<number, string> = {
  0: "sun",
  1: "sun",
  2: "cloud-sun",
  3: "cloud",
  45: "fog",
  48: "fog",
  51: "cloud-drizzle",
  53: "cloud-drizzle",
  55: "cloud-drizzle",
  61: "cloud-rain",
  63: "cloud-rain",
  65: "cloud-rain",
  71: "snowflake",
  73: "snowflake",
  75: "snowflake",
  80: "cloud-rain",
  81: "cloud-rain",
  82: "cloud-lightning",
  95: "cloud-lightning",
  96: "cloud-lightning",
  99: "cloud-lightning",
};

function placeFromNominatim(result: NominatimResult) {
  const address = result.address ?? {};
  const displayName =
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.hamlet ??
    result.display_name.split(",")[0]?.trim() ??
    "Lugar";

  return {
    displayName,
    country: address.country ?? "",
    countryCode: (address.country_code ?? "").toUpperCase(),
    state: address.state ?? null,
    lat: Number(result.lat),
    lon: Number(result.lon),
    timezone: null,
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Corresponsal/1.0 (place brief app)" },
  });
  if (!response.ok) throw new Error(`Upstream request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

// --- Cache en memoria para /places/suggest ---
// Guarda cada búsqueda por 24hs para no volver a pegarle a ningún servicio
// externo (LocationIQ o Nominatim) si alguien repite la misma consulta.
const SUGGEST_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
type SuggestCacheEntry = { data: ReturnType<typeof placeFromNominatim>[]; expiresAt: number };
const suggestCache = new Map<string, SuggestCacheEntry>();

function getSuggestCacheKey(q: string, limit: number): string {
  return `${q.trim().toLowerCase()}::${limit}`;
}

function getFromSuggestCache(key: string) {
  const entry = suggestCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    suggestCache.delete(key);
    return null;
  }
  return entry.data;
}

function setSuggestCache(key: string, data: ReturnType<typeof placeFromNominatim>[]) {
  suggestCache.set(key, { data, expiresAt: Date.now() + SUGGEST_CACHE_TTL_MS });
}

// --- Proveedor de búsqueda: LocationIQ si hay clave configurada, si no Nominatim ---
async function fetchPlaceSuggestions(q: string, limit: number) {
  const locationIqKey = process.env.LOCATIONIQ_API_KEY;

  if (locationIqKey) {
    try {
      const results = await fetchJson<NominatimResult[]>(
        `https://us1.locationiq.com/v1/search?key=${locationIqKey}&format=json&addressdetails=1&limit=${limit}&accept-language=es&q=${encodeURIComponent(q)}`,
      );
      return results.map(placeFromNominatim);
    } catch (error) {
      // Si LocationIQ falla (clave inválida, cuota agotada, etc.) no cortamos
      // la búsqueda: caemos a Nominatim como si no hubiera clave configurada.
      // Logueamos el motivo para poder diagnosticarlo sin adivinar.
      console.warn("LocationIQ suggest failed, falling back to Nominatim:", error);
    }
  }

  const results = await fetchJson<NominatimResult[]>(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=${limit}&accept-language=es&q=${encodeURIComponent(q)}`,
  );
  return results.map(placeFromNominatim);
}

router.get("/places/suggest", async (req, res) => {
  const parsed = SuggestPlacesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "La búsqueda debe tener al menos dos letras." });
    return;
  }

  const { q, limit } = parsed.data;
  const cacheKey = getSuggestCacheKey(q, limit);
  const cached = getFromSuggestCache(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  try {
    const suggestions = await fetchPlaceSuggestions(q, limit);
    setSuggestCache(cacheKey, suggestions);
    res.json(suggestions);
  } catch (error) {
    req.log.warn({ err: error }, "Place suggestions unavailable");
    res.status(502).json({ error: "No se pudo consultar el buscador geográfico." });
  }
});

// --- Cache en memoria para /places/brief ---
// El clima no necesita refrescarse todo el tiempo: cachear 30 min reduce
// mucho la cantidad de pedidos salientes y baja la chance de toparse con
// límites de uso de los servicios públicos.
const BRIEF_CACHE_TTL_MS = 30 * 60 * 1000;
const briefCache = new Map<string, { data: unknown; expiresAt: number }>();

function getBriefCacheKey(name: string, lat: number, lon: number): string {
  return `${name.trim().toLowerCase()}::${lat.toFixed(2)}::${lon.toFixed(2)}`;
}

function getFromBriefCache(key: string) {
  const entry = briefCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    briefCache.delete(key);
    return null;
  }
  return entry.data;
}

function setBriefCache(key: string, data: unknown) {
  briefCache.set(key, { data, expiresAt: Date.now() + BRIEF_CACHE_TTL_MS });
}

// --- Clima: OpenWeatherMap si hay clave configurada, si no Open-Meteo ---
function timezoneLabelFromOffsetSeconds(offsetSeconds: number): string {
  const totalMinutes = Math.round(offsetSeconds / 60);
  const sign = totalMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(totalMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${hh}:${mm}`;
}

function weatherFromOwmId(id: number): { description: string; icon: string } {
  if (id >= 200 && id < 300) return { description: "Tormenta", icon: "cloud-lightning" };
  if (id >= 300 && id < 400) return { description: "Llovizna", icon: "cloud-drizzle" };
  if (id >= 500 && id < 600) return { description: id >= 502 ? "Lluvia intensa" : "Lluvia", icon: "cloud-rain" };
  if (id >= 600 && id < 700) return { description: id >= 602 ? "Nieve intensa" : "Nieve", icon: "snowflake" };
  if (id >= 700 && id < 800) return { description: "Niebla", icon: "fog" };
  if (id === 800) return { description: "Despejado", icon: "sun" };
  if (id === 801) return { description: "Mayormente despejado", icon: "cloud-sun" };
  if (id === 802) return { description: "Parcialmente nublado", icon: "cloud-sun" };
  return { description: "Nublado", icon: "cloud" };
}

async function fetchWeatherData(lat: number, lon: number) {
  const openWeatherKey = process.env.OPENWEATHERMAP_API_KEY;

  if (openWeatherKey) {
    try {
      const owm = await fetchJson<{
        main?: { temp?: number };
        weather?: Array<{ id?: number }>;
        timezone?: number;
      }>(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${openWeatherKey}&units=metric&lang=es`,
      );
      const { description, icon } = weatherFromOwmId(owm.weather?.[0]?.id ?? -1);
      return {
        temperature: owm.main?.temp ?? 0,
        description,
        icon,
        timezone: timezoneLabelFromOffsetSeconds(owm.timezone ?? 0),
      };
    } catch (error) {
      // Si OpenWeatherMap falla (clave inválida, cuota agotada, etc.) no
      // cortamos: caemos a Open-Meteo como si no hubiera clave configurada.
      console.warn("OpenWeatherMap brief failed, falling back to Open-Meteo:", error);
    }
  }

  const weather = await fetchJson<{
    current?: { temperature_2m?: number; weather_code?: number };
    timezone?: string;
  }>(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`,
  );
  return {
    temperature: weather.current?.temperature_2m ?? 0,
    description: weatherDescriptions[weather.current?.weather_code ?? -1] ?? "Condiciones actuales",
    icon: weatherIcons[weather.current?.weather_code ?? -1] ?? "cloud",
    timezone: weather.timezone ?? "UTC",
  };
}

router.get("/places/brief", async (req, res) => {
  const parsed = GetPlaceBriefQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Faltan datos para consultar el lugar." });
    return;
  }

  const { name, country, lat, lon } = parsed.data;
  const cacheKey = getBriefCacheKey(name, lat, lon);
  const cached = getFromBriefCache(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  try {
    const weather = await fetchWeatherData(lat, lon);
    let summary: string | null = null;
    let imageUrl: string | null = null;
    try {
      const wiki = await fetchJson<{
        extract?: string;
        thumbnail?: { source?: string };
        originalimage?: { source?: string };
      }>(
        `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`,
      );
      summary = wiki.extract ?? null;
      imageUrl = wiki.thumbnail?.source ?? wiki.originalimage?.source ?? null;
    } catch {
      // A place can be useful even when Wikipedia has no matching article.
    }

    const payload = {
      place: {
        displayName: name,
        country: country ?? "",
        countryCode: "",
        state: null,
        lat,
        lon,
        timezone: weather.timezone,
      },
      weather: {
        temperature: weather.temperature,
        description: weather.description,
        icon: weather.icon,
      },
      localTime: new Date().toISOString(),
      summary,
      imageUrl,
      updatedAt: new Date().toISOString(),
    };
    setBriefCache(cacheKey, payload);
    res.json(payload);
  } catch (error) {
    req.log.warn({ err: error, name }, "Place brief unavailable");
    res.status(502).json({ error: "No se pudo actualizar la información del lugar." });
  }
});

function xmlValue(item: string, tag: string): string {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return (match?.[1] ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

async function fetchNewsItems(query: string, topic: string | null) {
  const rss = await fetch(
    `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=es-419&gl=US&ceid=US:es-419`,
    { headers: { "User-Agent": "Corresponsal/1.0 (news reader)" } },
  );
  if (!rss.ok) throw new Error(`News request failed: ${rss.status}`);
  const xml = await rss.text();
  const now = Date.now();
  const NEWS_MAX_AGE_MS = 45 * 24 * 60 * 60 * 1000;
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .map((match) => {
      const item = match[1] ?? "";
      const url = xmlValue(item, "link");
      return {
        title: xmlValue(item, "title"),
        translatedTitle: null,
        url,
        source: xmlValue(item, "source") || "Google News",
        publishedAt: new Date(xmlValue(item, "pubDate") || Date.now()).toISOString(),
        language: "auto",
        topic,
      };
    })
    .filter((item) => item.title && item.url)
    .filter((item) => now - new Date(item.publishedAt).getTime() <= NEWS_MAX_AGE_MS)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  // Algunas notas (ej. galerías de fotos) quedan indexadas como una entrada
  // por página/imagen; las agrupamos por título (sin números) + fuente y
  // nos quedamos con una sola.
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.source.toLowerCase()}::${item.title.replace(/\d+/g, "").trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

router.get("/places/news", async (req, res) => {
  const parsed = GetPlaceNewsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Faltan datos para buscar novedades." });
    return;
  }

  const { name, country, topic, limit } = parsed.data;
  const placeQuery = [name, country, topic].filter(Boolean).join(" ");
  try {
    let items = await fetchNewsItems(placeQuery, topic ?? null);

    // Si el lugar no tiene noticias recientes propias, mostramos lo más
    // relevante del país en vez de dejar la sección vacía.
    if (items.length === 0 && country) {
      const countryQuery = [country, topic].filter(Boolean).join(" ");
      items = await fetchNewsItems(countryQuery, topic ?? null);
    }

    res.json(items.slice(0, limit));
  } catch (error) {
    req.log.warn({ err: error, name }, "Place news unavailable");
    res.status(502).json({ error: "No se pudieron actualizar las novedades." });
  }
});

router.get("/places/nearby", async (req, res) => {
  const parsed = GetNearbyPlacesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Faltan coordenadas para buscar lugares cercanos." });
    return;
  }

  const { lat, lon, category } = parsed.data;
  const amenity = category === "restaurant" ? "restaurant" : category;
  const query = `[out:json];nwr["amenity"="${encodeURIComponent(amenity)}"](around:5000,${lat},${lon});out center 12;`;
  try {
    const data = await fetchJson<{ elements?: Array<{ tags?: Record<string, string>; lat?: number; lon?: number; center?: { lat: number; lon: number } }> }>(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
    );
    res.json(
      (data.elements ?? [])
        .filter((element) => element.tags?.name)
        .map((element) => {
          const point = element.center ?? { lat: element.lat ?? lat, lon: element.lon ?? lon };
          return {
            name: element.tags?.name ?? "Lugar sin nombre",
            category,
            address: element.tags?.["addr:street"] ?? null,
            mapUrl: `https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lon}#map=18/${point.lat}/${point.lon}`,
          };
        }),
    );
  } catch (error) {
    req.log.warn({ err: error, category }, "Nearby places unavailable");
    res.status(502).json({ error: "No se pudieron buscar lugares cercanos." });
  }
});

export default router;