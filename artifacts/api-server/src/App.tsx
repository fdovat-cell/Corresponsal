import { type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Bookmark,
  ChevronRight,
  Clock3,
  Compass,
  ExternalLink,
  Heart,
  MapPin,
  Menu,
  Newspaper,
  Search,
  Sun,
  X,
} from 'lucide-react';
import {
  getGetNearbyPlacesQueryKey,
  getGetPlaceBriefQueryKey,
  getGetPlaceNewsQueryKey,
  getSuggestPlacesQueryKey,
  useGetNearbyPlaces,
  useGetPlaceBrief,
  useGetPlaceNews,
  useSuggestPlaces,
  type NewsItem,
  type NearbyPlace,
  type Place,
  type PlaceBrief,
} from '@workspace/api-client-react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const PLACE_KEY = 'corresponsal-selected-place';
const FAVORITES_KEY = 'corresponsal-favorite-places';

const starterPlaces: Place[] = [
  { displayName: 'Lisbon', country: 'Portugal', countryCode: 'PT', state: null, lat: 38.7223, lon: -9.1393, timezone: 'Europe/Lisbon' },
  { displayName: 'Mexico City', country: 'Mexico', countryCode: 'MX', state: null, lat: 19.4326, lon: -99.1332, timezone: 'America/Mexico_City' },
  { displayName: 'Tokyo', country: 'Japan', countryCode: 'JP', state: null, lat: 35.6762, lon: 139.6503, timezone: 'Asia/Tokyo' },
];

function readPlaces(key: string, fallback: Place[]): Place[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? 'null');
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function readSelected(): Place | null {
  try {
    return JSON.parse(localStorage.getItem(PLACE_KEY) ?? 'null') as Place | null;
  } catch {
    return null;
  }
}

function saveSelected(place: Place) {
  localStorage.setItem(PLACE_KEY, JSON.stringify(place));
}

function placeKey(place: Place) {
  return `${place.displayName}-${place.countryCode}`.toLowerCase();
}

function placeParams(place: Place) {
  return { name: place.displayName, country: place.country, lat: place.lat, lon: place.lon };
}

function formatTime(value?: string, timezone?: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('es', { hour: 'numeric', minute: '2-digit', timeZone: timezone || undefined }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatRelative(value?: string) {
  if (!value) return 'Actualizado recién';
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `Actualizado hace ${minutes}m`;
  if (minutes < 1440) return `Actualizado hace ${Math.round(minutes / 60)}h`;
  return `Actualizado hace ${Math.round(minutes / 1440)}d`;
}

function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const selected = readSelected();
  const nav = [
    { href: '/', label: 'Lugares', icon: MapPin },
    { href: '/place', label: 'Hoy', icon: Newspaper },
    { href: '/place/explore', label: 'Explorar', icon: Compass },
  ];

  return (
    <div className="min-h-[100dvh] bg-background">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[244px] flex-col bg-sidebar px-5 py-6 text-sidebar-foreground transition-transform duration-300 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-11 flex items-center justify-between">
          <Link href="/" data-testid="link-brand" className="flex items-center gap-3">
            <span className="flex h-9 w-9 rotate-[-8deg] items-center justify-center rounded-[11px] bg-primary text-sidebar text-lg font-semibold shadow-md">c</span>
            <span className="font-display text-[22px] tracking-[-0.03em]">corresponsal</span>
          </Link>
          <button className="rounded-md p-1 md:hidden" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú" data-testid="button-close-menu"><X size={18} /></button>
        </div>
        <p className="mb-3 px-3 font-mono-ui text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/45">Tu ventana</p>
        <nav className="space-y-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? location === '/' : location === href;
            return (
              <Link key={href} href={href} onClick={() => setMobileOpen(false)} data-testid={`link-nav-${label.toLowerCase()}`} className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${active ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/62 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`}>
                <Icon size={17} strokeWidth={active ? 2.2 : 1.7} />
                <span>{label}</span>
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-2xl border border-sidebar-border bg-sidebar-accent/70 p-4">
          <div className="mb-3 flex items-center gap-2 text-accent"><Heart size={15} fill="currentColor" /><span className="font-mono-ui text-[10px] uppercase tracking-[0.13em]">Un pequeño ritual</span></div>
          <p className="font-display text-[17px] leading-snug text-sidebar-foreground/90">En algún lugar siempre es de mañana.</p>
          <p className="mt-2 text-xs leading-relaxed text-sidebar-foreground/48">Guardá cerca los lugares que te acercan.</p>
        </div>
      </aside>
      {mobileOpen && <button className="fixed inset-0 z-30 bg-sidebar/40 md:hidden" onClick={() => setMobileOpen(false)} aria-label="Cerrar navegación" data-testid="button-overlay-menu" />}
      <main className="min-h-[100dvh] md:pl-[244px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b hairline bg-background/90 px-5 backdrop-blur-md md:px-10">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 hover:bg-muted md:hidden" aria-label="Abrir menú" data-testid="button-open-menu"><Menu size={20} /></button>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#5f9d85]" />Un resumen diario de los lugares importantes</div>
          <div className="ml-auto flex items-center gap-3">
            {selected && <Link href="/place" data-testid="link-header-place" className="hidden items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:flex"><span className="max-w-[180px] truncate">{selected.displayName}</span><ChevronRight size={14} /></Link>}
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/30 bg-primary/15 font-display text-sm text-foreground" data-testid="avatar-user">M</div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

function SearchBox({ onSelect }: { onSelect: (place: Place) => void }) {
  const [search, setSearch] = useState('');
  const clean = search.trim();
  const suggestions = useSuggestPlaces({ q: clean.length >= 2 ? clean : '  ', limit: 6 }, {
    query: { enabled: clean.length >= 2, queryKey: getSuggestPlacesQueryKey({ q: clean.length >= 2 ? clean : '  ', limit: 6 }) },
  });
  const results = suggestions.data ?? [];
  return (
    <div className="relative z-10">
      <div className={`flex items-center gap-3 rounded-2xl border bg-card px-4 py-1 shadow-sm transition-all ${clean ? 'border-primary/60 shadow-[0_8px_28px_-18px_hsl(var(--primary))]' : 'border-border'}`}>
        <Search size={20} className="shrink-0 text-primary" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscá una ciudad o un lugar..." className="h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/65" data-testid="input-place-search" />
        {search && <button onClick={() => setSearch('')} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Limpiar búsqueda" data-testid="button-clear-search"><X size={16} /></button>}
        <kbd className="hidden rounded-md border border-border bg-muted px-2 py-1 font-mono-ui text-[10px] text-muted-foreground sm:inline">⌘ K</kbd>
      </div>
      {clean.length >= 2 && (
        <div className="absolute left-0 right-0 top-[62px] overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-xl">
          {suggestions.isLoading && <div className="space-y-2 p-2"><div className="h-10 animate-pulse rounded-lg bg-muted" /><div className="h-10 animate-pulse rounded-lg bg-muted" /></div>}
          {suggestions.isError && <div className="p-4 text-sm text-muted-foreground">No se pudo buscar ahora. Intentá nuevamente en un momento.</div>}
          {!suggestions.isLoading && !suggestions.isError && results.length === 0 && <div className="p-4 text-sm text-muted-foreground">No encontramos “{clean}”. Probá con una ciudad, región o país.</div>}
          {results.map((place) => <button key={placeKey(place)} onClick={() => { onSelect(place); setSearch(''); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted" data-testid={`button-suggestion-${placeKey(place)}`}><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-primary"><MapPin size={15} /></span><span className="min-w-0"><span className="block truncate text-sm font-medium">{place.displayName}</span><span className="block truncate text-xs text-muted-foreground">{place.state ? `${place.state}, ` : ''}{place.country}</span></span><ArrowUpRight size={15} className="ml-auto text-muted-foreground" /></button>)}
        </div>
      )}
    </div>
  );
}

function Home() {
  const [, setLocation] = useLocation();
  const [favorites, setFavorites] = useState<Place[]>(() => readPlaces(FAVORITES_KEY, starterPlaces));
  const [selected, setSelected] = useState<Place | null>(() => readSelected());

  const choose = (place: Place) => {
    saveSelected(place);
    setSelected(place);
    if (!favorites.some((item) => placeKey(item) === placeKey(place))) {
      const next = [place, ...favorites].slice(0, 8);
      setFavorites(next);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    }
    setLocation('/place');
  };

  const remove = (place: Place) => {
    const next = favorites.filter((item) => placeKey(item) !== placeKey(place));
    setFavorites(next);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  };

  return (
    <div className="paper-grid min-h-[calc(100dvh-72px)] overflow-hidden">
      <section className="mx-auto max-w-6xl px-5 pb-14 pt-12 md:px-10 md:pb-20 md:pt-20">
        <div className="max-w-3xl rise-in">
          <div className="mb-6 flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[0.2em] text-primary"><span className="h-px w-8 bg-primary" />El mundo, un poco más cerca</div>
          <h1 className="font-display text-4xl sm:text-6xl md:text-7xl lg:text-8xl leading-[.9] tracking-[-0.065em] text-foreground">Quedate cerca<br /><span className="text-primary">desde acá.</span></h1>
          <p className="mt-7 max-w-[470px] text-[17px] leading-relaxed text-muted-foreground md:text-lg">Una ventana tranquila y actual a las ciudades donde vive tu gente — y a los lugares que te generan curiosidad.</p>
        </div>
        <div className="mt-11 max-w-2xl rise-in-delay"><SearchBox onSelect={choose} /><p className="mt-3 pl-1 text-xs text-muted-foreground">Buscá una ciudad para abrir su resumen diario.</p></div>
        <div className="mt-20 rise-in-delay-2">
          <div className="mb-6 flex items-end justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Lugares guardados</p><h2 className="mt-2 font-display text-3xl tracking-[-0.04em]">Tu pequeño mundo</h2></div><span className="font-mono-ui text-xs text-muted-foreground">{favorites.length.toString().padStart(2, '0')} lugares</span></div>
          {favorites.length === 0 ? <EmptyFavorites onSearch={() => document.querySelector<HTMLInputElement>('[data-testid="input-place-search"]')?.focus()} /> : <div className="grid gap-3 md:grid-cols-3">{favorites.map((place, index) => <PlaceCard key={placeKey(place)} place={place} index={index} selected={selected ? placeKey(selected) === placeKey(place) : false} onSelect={choose} onRemove={remove} />)}<AddPlaceCard onSearch={() => document.querySelector<HTMLInputElement>('[data-testid="input-place-search"]')?.focus()} /></div>}
        </div>
      </section>
      <footer className="mx-auto flex max-w-6xl flex-col gap-3 border-t hairline px-5 py-7 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-10"><span className="font-display text-base text-foreground/70">corresponsal</span><span>Hecho para los momentos intermedios.</span></footer>
    </div>
  );
}

function PlaceCard({ place, index, selected, onSelect, onRemove }: { place: Place; index: number; selected: boolean; onSelect: (place: Place) => void; onRemove: (place: Place) => void }) {
  const colors = ['bg-[#d9e8e4]', 'bg-[#f2d7ca]', 'bg-[#e9e0b9]'];
  return (
    <div className={`group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${selected ? 'border-primary/50 bg-card' : 'border-border bg-card/70'}`} data-testid={`card-place-${placeKey(place)}`}>
      <button onClick={() => onSelect(place)} className="absolute inset-0 z-0 text-left" aria-label={`Abrir ${place.displayName}`} data-testid={`button-open-place-${placeKey(place)}`} />
      <div className="relative z-10 flex items-start justify-between pointer-events-none"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors[index % colors.length]} text-foreground`}><MapPin size={18} /></span><button onClick={() => onRemove(place)} className="pointer-events-auto rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-destructive group-hover:opacity-100" aria-label={`Quitar ${place.displayName}`} data-testid={`button-remove-place-${placeKey(place)}`}><X size={15} /></button></div>
      <div className="relative z-10 mt-9 pointer-events-none"><h3 className="font-display text-[27px] tracking-[-0.04em]">{place.displayName}</h3><p className="mt-1 text-sm text-muted-foreground">{place.country}{place.state ? ` · ${place.state}` : ''}</p></div>
      <div className="relative z-10 mt-6 flex items-center justify-between border-t hairline pt-3 pointer-events-none"><span className="font-mono-ui text-[10px] uppercase tracking-[.1em] text-muted-foreground">{place.timezone?.split('/').pop()?.replace('_', ' ') ?? 'Hora local'}</span><ChevronRight size={15} className="text-primary transition-transform group-hover:translate-x-1" /></div>
    </div>
  );
}

function AddPlaceCard({ onSearch }: { onSearch: () => void }) {
  return <button onClick={onSearch} className="flex min-h-[218px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/30 text-muted-foreground transition-colors hover:border-primary/60 hover:bg-card/70" data-testid="button-add-place"><span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-border text-xl font-light">+</span><span className="text-sm">Agregar otro lugar</span></button>;
}

function EmptyFavorites({ onSearch }: { onSearch: () => void }) {
  return <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 text-center"><Bookmark size={21} className="mb-3 text-primary" /><h3 className="font-display text-xl">Tu mundo todavía está tomando forma</h3><p className="mt-1 max-w-sm text-sm text-muted-foreground">Buscá una ciudad arriba y guardá cerca los lugares a los que querés volver.</p><button onClick={onSearch} className="mt-5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.03]" data-testid="button-search-first-place">Buscar un lugar</button></div>;
}

function PlaceLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const selected = readSelected();
  useEffect(() => { if (!selected) setLocation('/'); }, [selected, setLocation]);
  if (!selected) return <div className="mx-auto max-w-3xl px-5 py-24 text-center"><Compass className="mx-auto mb-4 text-primary" /><h1 className="font-display text-4xl">Elegí un lugar primero</h1><p className="mt-3 text-muted-foreground">Tu ventana diaria está esperando una ciudad.</p><Link href="/" className="mt-7 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" data-testid="link-choose-place">Elegir un lugar</Link></div>;
  return <div className="mx-auto max-w-6xl px-5 py-10 md:px-10 md:py-14"><div className="mb-10 flex flex-wrap items-end justify-between gap-5"><div><Link href="/" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" data-testid="link-back-places"><ChevronRight size={13} className="rotate-180" />Todos los lugares</Link><h1 className="font-display text-3xl sm:text-4xl md:text-6xl leading-none tracking-[-0.06em]">{selected.displayName}</h1><p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><MapPin size={14} className="text-primary" />{selected.country}{selected.state ? `, ${selected.state}` : ''}<span className="text-border">/</span><Clock3 size={13} />{selected.timezone?.replace('_', ' ') ?? 'Hora local'}</p></div><div className="flex rounded-xl border border-border bg-card p-1"><Link href="/place" className={`rounded-lg px-3.5 py-2 text-sm ${location === '/place' ? 'bg-secondary font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`} data-testid="link-tab-today">Hoy</Link><Link href="/place/explore" className={`rounded-lg px-3.5 py-2 text-sm ${location === '/place/explore' ? 'bg-secondary font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`} data-testid="link-tab-explore">Explorar</Link></div></div>{children}</div>;
}

function LoadingBrief() {
  return <div className="grid gap-4 md:grid-cols-[1.3fr_.7fr]"><div className="h-[340px] animate-pulse rounded-3xl bg-muted" /><div className="h-[340px] animate-pulse rounded-3xl bg-muted" /></div>;
}

function PlacePage() {
  const selected = readSelected();
  if (!selected) return <PlaceLayout><div /></PlaceLayout>;
  const params = placeParams(selected);
  const briefQuery = useGetPlaceBrief(params, { query: { queryKey: getGetPlaceBriefQueryKey(params) } });
  const newsQuery = useGetPlaceNews({ name: selected.displayName, country: selected.country, limit: 8 }, { query: { queryKey: getGetPlaceNewsQueryKey({ name: selected.displayName, country: selected.country, limit: 8 }) } });
  const brief = briefQuery.data;
  const news = newsQuery.data ?? [];
  return <PlaceLayout>{briefQuery.isLoading ? <LoadingBrief /> : briefQuery.isError ? <ErrorPanel onRetry={() => briefQuery.refetch()} /> : <><div className="grid gap-4 md:grid-cols-[1.35fr_.65fr]"><BriefHero brief={brief} /><TimeCard brief={brief} /></div><section className="mt-14"><SectionHeading eyebrow="Desde allá, hoy" title="Lo que se lee ahí" action={<Link href="/place/explore" className="flex items-center gap-1 text-sm text-primary hover:gap-2 transition-all" data-testid="link-explore-more">Ver más <ArrowUpRight size={15} /></Link>} />{newsQuery.isLoading ? <NewsSkeleton /> : newsQuery.isError ? <ErrorPanel onRetry={() => newsQuery.refetch()} compact /> : <NewsList news={news} />}</section></>}</PlaceLayout>;
}

function BriefHero({ brief }: { brief: PlaceBrief | undefined }) {
  if (!brief) return null;
  return <article className="relative min-h-[260px] overflow-hidden rounded-3xl bg-sidebar p-6 text-sidebar-foreground md:min-h-[340px] md:p-10" data-testid="card-place-brief">{brief.imageUrl && <img src={brief.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35 mix-blend-luminosity" />}{!brief.imageUrl && <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full border-[38px] border-primary/25" />}<div className="relative flex h-full min-h-[212px] flex-col justify-between md:min-h-[276px]"><div className="flex items-center justify-between"><span className="rounded-full border border-sidebar-foreground/20 px-3 py-1 font-mono-ui text-[10px] uppercase tracking-[.14em] text-sidebar-foreground/70">El resumen</span><span className="font-mono-ui text-[10px] text-sidebar-foreground/50">{formatRelative(brief.updatedAt)}</span></div><div className="max-w-2xl"><p className="mb-3 flex items-center gap-2 text-sm text-sidebar-foreground/65"><Sun size={16} className="text-accent" />{brief.weather?.description ?? 'Un vistazo al día'}</p><h2 className="font-display text-lg sm:text-xl md:text-2xl leading-snug tracking-[-.01em]">{brief.summary || 'Acá está por comenzar un nuevo día.'}</h2></div></div></article>;
}

function TimeCard({ brief }: { brief: PlaceBrief | undefined }) {
  if (!brief) return null;
  return <aside className="flex min-h-[260px] flex-col justify-between rounded-3xl border border-border bg-card p-6 md:min-h-[340px] md:p-8" data-testid="card-local-time"><div className="flex items-center justify-between"><span className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-muted-foreground">Ahora mismo</span><span className="h-2 w-2 rounded-full bg-[#5f9d85]" /></div><div><p className="font-mono-ui text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-none tracking-[-.08em] text-foreground">{formatTime(brief.localTime, brief.place.timezone)}</p><p className="mt-3 text-sm text-muted-foreground">hora local en {brief.place.displayName}</p></div><div className="flex items-end justify-between border-t hairline pt-4"><div><p className="font-mono-ui text-3xl tracking-[-.07em]">{Math.round(brief.weather?.temperature ?? 0)}°</p><p className="text-xs text-muted-foreground">clima actual</p></div><span className="rounded-xl bg-accent/50 px-3 py-2 text-xs text-foreground">{brief.weather?.description ?? 'Condiciones actuales'}</span></div></aside>;
}

function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return <div className="mb-6 flex items-end justify-between gap-4"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-primary">{eyebrow}</p><h2 className="mt-2 font-display text-3xl tracking-[-.045em]">{title}</h2></div>{action}</div>;
}

function NewsList({ news }: { news: NewsItem[] }) {
  if (!news.length) return <EmptyFeed />;
  return <div className="divide-y hairline rounded-2xl border border-border bg-card">{news.map((item, index) => <a key={`${item.url}-${index}`} href={item.url} target="_blank" rel="noreferrer" className="group flex items-start gap-4 p-5 transition-colors hover:bg-muted/50 md:p-6" data-testid={`link-news-${index}`}><span className="mt-1 font-mono-ui text-[10px] text-primary">{String(index + 1).padStart(2, '0')}</span><div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[.12em] text-muted-foreground"><span>{item.source}</span><span className="text-border">/</span><span>{item.topic || 'Mundo'}</span></div><h3 className="font-display text-[20px] leading-snug tracking-[-.02em] group-hover:text-primary">{item.translatedTitle || item.title}</h3>{item.translatedTitle && item.translatedTitle !== item.title && <p className="mt-1 text-xs text-muted-foreground">{item.title}</p>}</div><ExternalLink size={16} className="mt-1 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" /></a>)}</div>;
}

function NewsSkeleton() {
  return <div className="space-y-2 rounded-2xl border border-border bg-card p-5"><div className="h-14 animate-pulse rounded-lg bg-muted" /><div className="h-14 animate-pulse rounded-lg bg-muted" /><div className="h-14 animate-pulse rounded-lg bg-muted" /></div>;
}

function EmptyFeed() {
  return <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center"><Newspaper size={21} className="mx-auto mb-3 text-primary" /><h3 className="font-display text-xl">Un día tranquilo de noticias</h3><p className="mt-1 text-sm text-muted-foreground">No hay nada nuevo para mostrarte por ahora. Volvé más tarde.</p></div>;
}

function ErrorPanel({ onRetry, compact = false }: { onRetry: () => void; compact?: boolean }) {
  return <div className={`rounded-2xl border border-destructive/20 bg-destructive/5 text-center ${compact ? 'px-6 py-10' : 'px-6 py-20'}`}><p className="font-display text-xl">Esta ventana está momentáneamente fuera de alcance</p><p className="mt-1 text-sm text-muted-foreground">No pudimos actualizar este lugar en este momento.</p><button onClick={onRetry} className="mt-4 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted" data-testid="button-retry">Reintentar</button></div>;
}

function ExplorePage() {
  const selected = readSelected();
  const [topic, setTopic] = useState('');
  const [category, setCategory] = useState('');
  if (!selected) return <PlaceLayout><div /></PlaceLayout>;
  const newsParams = { name: selected.displayName, country: selected.country, topic: topic || undefined, limit: 12 };
  const nearbyParams = { lat: selected.lat, lon: selected.lon, category: category || undefined };
  const newsQuery = useGetPlaceNews(newsParams, { query: { queryKey: getGetPlaceNewsQueryKey(newsParams) } });
  const nearbyQuery = useGetNearbyPlaces(nearbyParams, { query: { queryKey: getGetNearbyPlacesQueryKey(nearbyParams) } });
  const topics = ['Cultura', 'Negocios', 'Política', 'Comunidad'];
  return <PlaceLayout><div className="mb-10 max-w-2xl"><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-primary">Una mirada más amplia</p><h2 className="mt-3 font-display text-3xl sm:text-4xl md:text-6xl leading-[.94] tracking-[-.06em]">Encontrá tu camino<br />por {selected.displayName}.</h2><p className="mt-5 text-base leading-relaxed text-muted-foreground">Seguí un hilo y después dejate llevar. Explorá de qué se habla y qué hay cerca.</p></div><div className="mb-14 flex flex-wrap gap-2 border-b hairline pb-6">{topics.map((item) => <button onClick={() => setTopic(topic === item ? '' : item)} key={item} className={`rounded-full border px-4 py-2 text-sm transition-colors ${topic === item ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'}`} data-testid={`button-topic-${item.toLowerCase()}`}>{item}</button>)}</div><section><SectionHeading eyebrow="Seguí leyendo" title={topic ? `${topic} en las noticias` : 'Lo que se mueve ahí'} /><div className="grid gap-10 lg:grid-cols-[1fr_330px]"><div>{newsQuery.isLoading ? <NewsSkeleton /> : newsQuery.isError ? <ErrorPanel onRetry={() => newsQuery.refetch()} compact /> : <NewsList news={newsQuery.data ?? []} />}</div><NearbyPanel category={category} setCategory={setCategory} query={nearbyQuery} /></div></section></PlaceLayout>;
}

function NearbyPanel({ category, setCategory, query }: { category: string; setCategory: (value: string) => void; query: ReturnType<typeof useGetNearbyPlaces<NearbyPlace[]>> }) {
  const categories = ['Para comer', 'Museos', 'Parques', 'Mercados'];
  return <aside className="rounded-2xl border border-border bg-card p-5 md:p-6" data-testid="panel-nearby"><div className="mb-5 flex items-start justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-primary">Cerca tuyo</p><h3 className="mt-2 font-display text-2xl tracking-[-.04em]">A la vuelta de la esquina</h3></div><MapPin size={19} className="text-primary" /></div><div className="mb-5 flex flex-wrap gap-1.5">{categories.map((item) => <button key={item} onClick={() => setCategory(category === item ? '' : item)} className={`rounded-full px-2.5 py-1 text-[11px] ${category === item ? 'bg-secondary text-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`} data-testid={`button-nearby-${item.toLowerCase().replaceAll(' ', '-')}`}>{item}</button>)}</div>{query.isLoading ? <div className="space-y-3"><div className="h-12 animate-pulse rounded-lg bg-muted" /><div className="h-12 animate-pulse rounded-lg bg-muted" /></div> : query.isError ? <p className="text-sm text-muted-foreground">Los lugares cercanos están tardando en cargar.</p> : !(query.data ?? []).length ? <div className="py-5 text-center"><Compass size={20} className="mx-auto mb-2 text-muted-foreground" /><p className="text-sm text-muted-foreground">No encontramos lugares cercanos.</p></div> : <div className="space-y-1">{(query.data ?? []).slice(0, 7).map((place, index) => <a href={place.mapUrl} target="_blank" rel="noreferrer" key={`${place.name}-${index}`} className="group block rounded-xl p-3 transition-colors hover:bg-muted" data-testid={`link-nearby-${index}`}><div className="flex items-center justify-between gap-2"><h4 className="text-sm font-medium group-hover:text-primary">{place.name}</h4><ExternalLink size={13} className="shrink-0 text-muted-foreground" /></div><p className="mt-1 text-xs text-muted-foreground">{place.category}{place.address ? ` · ${place.address}` : ''}</p></a>)}</div>}</aside>;
}

function Router() {
  return <RoutedErrorBoundary><Switch><Route path="/" component={Home} /><Route path="/place/explore" component={ExplorePage} /><Route path="/place" component={PlacePage} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><AppShell><Router /></AppShell></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;