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

router.get("/places/suggest", async (req, res) => {
  const parsed = SuggestPlacesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "La búsqueda debe tener al menos dos letras." });
    return;
  }

  try {
    const { q, limit } = parsed.data;
    const results = await fetchJson<NominatimResult[]>(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=${limit}&accept-language=es&q=${encodeURIComponent(q)}`,
    );
    res.json(results.map(placeFromNominatim));
  } catch (error) {
    req.log.warn({ err: error }, "Place suggestions unavailable");
    res.status(502).json({ error: "No se pudo consultar el buscador geográfico." });
  }
});

router.get("/places/brief", async (req, res) => {
  const parsed = GetPlaceBriefQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Faltan datos para consultar el lugar." });
    return;
  }

  const { name, country, lat, lon } = parsed.data;
  try {
    const weather = await fetchJson<{
      current?: { temperature_2m?: number; weather_code?: number };
      timezone?: string;
    }>(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`,
    );
    const timezone = weather.timezone ?? "UTC";
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

    res.json({
      place: {
        displayName: name,
        country: country ?? "",
        countryCode: "",
        state: null,
        lat,
        lon,
        timezone,
      },
      weather: {
        temperature: weather.current?.temperature_2m ?? 0,
        description: weatherDescriptions[weather.current?.weather_code ?? -1] ?? "Condiciones actuales",
        icon: weatherIcons[weather.current?.weather_code ?? -1] ?? "cloud",
      },
      localTime: new Date().toISOString(),
      summary,
      imageUrl,
      updatedAt: new Date().toISOString(),
    });
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

router.get("/places/news", async (req, res) => {
  const parsed = GetPlaceNewsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Faltan datos para buscar novedades." });
    return;
  }

  const { name, country, topic, limit } = parsed.data;
  const query = [name, country, topic].filter(Boolean).join(" ");
  try {
    const rss = await fetch(
      `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=es-419&gl=US&ceid=US:es-419`,
      { headers: { "User-Agent": "Corresponsal/1.0 (news reader)" } },
    );
    if (!rss.ok) throw new Error(`News request failed: ${rss.status}`);
    const xml = await rss.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
      .slice(0, limit)
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
          topic: topic ?? null,
        };
      })
      .filter((item) => item.title && item.url);
    const translated = await Promise.all(
      items.map(async (item) => {
        try {
          const response = await fetch(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(item.title)}&langpair=auto|es`,
          );
          if (!response.ok) return item;
          const data = (await response.json()) as { responseData?: { translatedText?: string } };
          const translatedTitle = data.responseData?.translatedText?.trim();
          return translatedTitle && translatedTitle.toLowerCase() !== item.title.toLowerCase()
            ? { ...item, translatedTitle }
            : item;
        } catch {
          return item;
        }
      }),
    );
    res.json(translated);
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