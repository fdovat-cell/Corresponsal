/* ============================================================
   Corresponsal — lógica principal
   ============================================================ */

/* ---- Tabla país -> idioma/moneda/capital (datos estáticos, sin llamada de red) ----
   Cubre los países más consultados. Si un país no está, la ficha simplemente
   muestra menos chips (nunca se inventa un dato). */
const COUNTRY_INFO = {
  uy:{lang:'es',currency:'UYU',capital:'Montevideo'}, ar:{lang:'es',currency:'ARS',capital:'Buenos Aires'},
  br:{lang:'pt',currency:'BRL',capital:'Brasilia'}, cl:{lang:'es',currency:'CLP',capital:'Santiago'},
  py:{lang:'es',currency:'PYG',capital:'Asunción'}, bo:{lang:'es',currency:'BOB',capital:'Sucre'},
  pe:{lang:'es',currency:'PEN',capital:'Lima'}, co:{lang:'es',currency:'COP',capital:'Bogotá'},
  ve:{lang:'es',currency:'VES',capital:'Caracas'}, ec:{lang:'es',currency:'USD',capital:'Quito'},
  mx:{lang:'es',currency:'MXN',capital:'Ciudad de México'}, cu:{lang:'es',currency:'CUP',capital:'La Habana'},
  gt:{lang:'es',currency:'GTQ',capital:'Ciudad de Guatemala'}, cr:{lang:'es',currency:'CRC',capital:'San José'},
  pa:{lang:'es',currency:'PAB',capital:'Ciudad de Panamá'}, do:{lang:'es',currency:'DOP',capital:'Santo Domingo'},
  us:{lang:'en',currency:'USD',capital:'Washington D.C.'}, ca:{lang:'en',currency:'CAD',capital:'Ottawa'},
  gb:{lang:'en',currency:'GBP',capital:'Londres'}, ie:{lang:'en',currency:'EUR',capital:'Dublín'},
  fr:{lang:'fr',currency:'EUR',capital:'París'}, es:{lang:'es',currency:'EUR',capital:'Madrid'},
  pt:{lang:'pt',currency:'EUR',capital:'Lisboa'}, it:{lang:'it',currency:'EUR',capital:'Roma'},
  de:{lang:'de',currency:'EUR',capital:'Berlín'}, at:{lang:'de',currency:'EUR',capital:'Viena'},
  ch:{lang:'de',currency:'CHF',capital:'Berna'}, nl:{lang:'nl',currency:'EUR',capital:'Ámsterdam'},
  be:{lang:'nl',currency:'EUR',capital:'Bruselas'}, se:{lang:'sv',currency:'SEK',capital:'Estocolmo'},
  no:{lang:'no',currency:'NOK',capital:'Oslo'}, dk:{lang:'da',currency:'DKK',capital:'Copenhague'},
  fi:{lang:'fi',currency:'EUR',capital:'Helsinki'}, is:{lang:'is',currency:'ISK',capital:'Reikiavik'},
  pl:{lang:'pl',currency:'PLN',capital:'Varsovia'}, cz:{lang:'cs',currency:'CZK',capital:'Praga'},
  sk:{lang:'sk',currency:'EUR',capital:'Bratislava'}, hu:{lang:'hu',currency:'HUF',capital:'Budapest'},
  ro:{lang:'ro',currency:'RON',capital:'Bucarest'}, bg:{lang:'bg',currency:'BGN',capital:'Sofía'},
  gr:{lang:'el',currency:'EUR',capital:'Atenas'}, hr:{lang:'hr',currency:'EUR',capital:'Zagreb'},
  rs:{lang:'sr',currency:'RSD',capital:'Belgrado'}, ua:{lang:'uk',currency:'UAH',capital:'Kiev'},
  ru:{lang:'ru',currency:'RUB',capital:'Moscú'}, tr:{lang:'tr',currency:'TRY',capital:'Ankara'},
  il:{lang:'iw',currency:'ILS',capital:'Jerusalén'}, ae:{lang:'ar',currency:'AED',capital:'Abu Dabi'},
  sa:{lang:'ar',currency:'SAR',capital:'Riad'}, eg:{lang:'ar',currency:'EGP',capital:'El Cairo'},
  ma:{lang:'ar',currency:'MAD',capital:'Rabat'}, tn:{lang:'ar',currency:'TND',capital:'Túnez'},
  za:{lang:'en',currency:'ZAR',capital:'Pretoria'}, ng:{lang:'en',currency:'NGN',capital:'Abuya'},
  ke:{lang:'en',currency:'KES',capital:'Nairobi'}, jp:{lang:'ja',currency:'JPY',capital:'Tokio'},
  cn:{lang:'zh-CN',currency:'CNY',capital:'Pekín'}, kr:{lang:'ko',currency:'KRW',capital:'Seúl'},
  in:{lang:'en',currency:'INR',capital:'Nueva Delhi'}, th:{lang:'th',currency:'THB',capital:'Bangkok'},
  vn:{lang:'vi',currency:'VND',capital:'Hanói'}, id:{lang:'id',currency:'IDR',capital:'Yakarta'},
  ph:{lang:'en',currency:'PHP',capital:'Manila'}, my:{lang:'ms',currency:'MYR',capital:'Kuala Lumpur'},
  sg:{lang:'en',currency:'SGD',capital:'Singapur'}, au:{lang:'en',currency:'AUD',capital:'Canberra'},
  nz:{lang:'en',currency:'NZD',capital:'Wellington'}, pk:{lang:'en',currency:'PKR',capital:'Islamabad'},
  bd:{lang:'bn',currency:'BDT',capital:'Daca'}, ir:{lang:'fa',currency:'IRR',capital:'Teherán'},
  iq:{lang:'ar',currency:'IQD',capital:'Bagdad'}
};

function countryInfoFor(code){ return COUNTRY_INFO[(code||'').toLowerCase()] || null; }

/* ---- Favoritos (localStorage) ---- */
const FAV_KEY = 'corresponsal:favorites';
function loadFavorites(){
  try{ return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); }catch(e){ return []; }
}
function saveFavorites(list){
  localStorage.setItem(FAV_KEY, JSON.stringify(list));
}
function isFavorite(displayName, country){
  return loadFavorites().some(f => f.displayName === displayName && f.country === country);
}
function toggleFavorite(place){
  const list = loadFavorites();
  const idx = list.findIndex(f => f.displayName === place.displayName && f.country === place.country);
  if(idx >= 0){ list.splice(idx, 1); } else { list.push(place); }
  saveFavorites(list);
  renderBoard();
  return idx < 0; // true si quedó agregado
}

/* ---- Board (franja de favoritos con hora local) ---- */
const boardInner = document.getElementById('boardInner');
function renderBoard(){
  const favs = loadFavorites();
  boardInner.innerHTML = '';
  if(!favs.length){
    boardInner.innerHTML = '<div class="board-empty">Sin favoritos todavía — fijá una ciudad para verla acá.</div>';
    return;
  }
  favs.forEach(f => {
    const cell = document.createElement('div');
    cell.className = 'board-cell';
    cell.innerHTML = `<div class="board-city">${f.displayName}<span class="board-remove" title="Quitar">✕</span></div><div class="board-time" data-tz="${f.tz || 'UTC'}">--:--</div>`;
    cell.querySelector('.board-city').addEventListener('click', (e) => {
      if(e.target.classList.contains('board-remove')) return;
      loadPlace(f.displayName, f);
    });
    cell.querySelector('.board-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(f);
    });
    boardInner.appendChild(cell);
  });
  updateBoardClocks();
}
function updateBoardClocks(){
  document.querySelectorAll('.board-time').forEach(el => {
    try{
      el.textContent = new Intl.DateTimeFormat('es-UY', { hour:'2-digit', minute:'2-digit', hour12:false, timeZone: el.dataset.tz }).format(new Date());
    }catch(e){ el.textContent = '--:--'; }
  });
}
renderBoard();
setInterval(updateBoardClocks, 30000);

/* ---- Router simple (URL compartible) ---- */
function updateUrl(place, view){
  if(!place){ history.pushState({}, '', location.pathname); return; }
  const params = new URLSearchParams({
    place: place.displayName, country: place.country || '', cc: place.countryCode || '',
    lat: place.lat, lon: place.lon, view: view || 'home'
  });
  history.pushState({ place, view }, '', `?${params.toString()}`);
}
window.addEventListener('popstate', (e) => {
  const s = e.state;
  if(s && s.place){ loadPlace(s.place.displayName, s.place, s.view === 'city'); }
  else { goHomeView(); }
});

/* ---- Buscador predictivo ---- */
const placeInput = document.getElementById('placeInput');
const suggestList = document.getElementById('suggestList');
let suggestTimer = null, suggestItems = [], hiIndex = -1, selectedPlace = null;

placeInput.addEventListener('input', () => {
  selectedPlace = null;
  const q = placeInput.value.trim();
  clearTimeout(suggestTimer);
  if(q.length < 3){ closeSuggest(); return; }
  suggestTimer = setTimeout(() => fetchSuggestions(q), 350);
});
placeInput.addEventListener('keydown', e => {
  if(suggestList.classList.contains('open') && suggestItems.length){
    if(e.key === 'ArrowDown'){ e.preventDefault(); hiIndex = Math.min(hiIndex+1, suggestItems.length-1); paintHi(); return; }
    if(e.key === 'ArrowUp'){ e.preventDefault(); hiIndex = Math.max(hiIndex-1, 0); paintHi(); return; }
    if(e.key === 'Enter' && hiIndex >= 0){ e.preventDefault(); chooseSuggestion(suggestItems[hiIndex]); return; }
  }
  if(e.key === 'Enter'){ document.getElementById('searchBtn').click(); }
  if(e.key === 'Escape'){ closeSuggest(); }
});
document.addEventListener('click', e => { if(!e.target.closest('.search-row')) closeSuggest(); });

function closeSuggest(){ suggestList.classList.remove('open'); suggestList.innerHTML = ''; suggestItems = []; hiIndex = -1; }
function paintHi(){ [...suggestList.children].forEach((el, i) => el.classList.toggle('hi', i === hiIndex)); }

async function fetchSuggestions(q){
  try{
    const res = await fetch(`/api/geocode?mode=suggest&limit=8&q=${encodeURIComponent(q)}`);
    const data = await res.json();
    suggestItems = (data.results || []).slice(0, 6);
    if(!suggestItems.length){ closeSuggest(); return; }
    renderSuggestions();
  }catch(e){ closeSuggest(); }
}
function renderSuggestions(){
  hiIndex = -1;
  suggestList.innerHTML = '';
  suggestItems.forEach(r => {
    const el = document.createElement('div');
    el.className = 'suggest-item';
    el.innerHTML = `<div class="suggest-main">${r.displayName}</div><div class="suggest-sub">${[r.state, r.country].filter(Boolean).join(', ')}</div>`;
    el.addEventListener('click', () => chooseSuggestion(r));
    suggestList.appendChild(el);
  });
  suggestList.classList.add('open');
}
function chooseSuggestion(r){
  selectedPlace = r;
  placeInput.value = [r.displayName, r.country].filter(Boolean).join(', ');
  closeSuggest();
  loadPlace(placeInput.value, r);
}
document.getElementById('searchBtn').addEventListener('click', () => {
  const q = placeInput.value.trim();
  if(!q) return;
  loadPlace(q, selectedPlace);
});
document.getElementById('goHome').addEventListener('click', goHomeView);
document.getElementById('titleHome').addEventListener('click', goHomeView);
document.getElementById('backLink').addEventListener('click', () => showView('home'));

function goHomeView(){
  document.getElementById('summaryCard').classList.remove('active');
  document.getElementById('cityView').classList.remove('active');
  placeInput.value = '';
  updateUrl(null);
}

/* ---- Carga de un lugar: geocoding (si falta), clima+huso, noticias y cámara EN PARALELO ---- */
let currentPlace = null;

function buildNewsQuery(name, country){
  const clean = name.replace(/[-–—_]/g, ' ').replace(/\s+/g, ' ').trim();
  const phrase = clean.includes(' ') ? `"${clean}"` : clean;
  return country ? `${phrase} ${country}` : phrase;
}

async function resolvePlace(query){
  const res = await fetch(`/api/geocode?mode=search&limit=1&q=${encodeURIComponent(query)}`);
  const data = await res.json();
  return (data.results && data.results[0]) || null;
}

async function loadPlace(query, preResolved, openCityView){
  const stateMsg = document.getElementById('stateMsg');
  stateMsg.textContent = 'Buscando…';
  document.getElementById('summaryCard').classList.remove('active');
  document.getElementById('cityView').classList.remove('active');

  let place = preResolved;
  if(!place){
    place = await resolvePlace(query);
    if(!place){ stateMsg.textContent = 'No encontré ese lugar. Probá con otro nombre.'; return; }
  }
  currentPlace = place;
  stateMsg.textContent = '';

  renderSummarySkeleton(place);
  updateUrl(place, openCityView ? 'city' : 'home');

  // Disparamos todo en paralelo — antes se esperaba a Wikipedia antes de arrancar el resto,
  // lo que hacía que cambiar de ciudad se sintiera lento.
  const info = countryInfoFor(place.countryCode);
  const hl = info ? info.lang : 'es';
  const gl = (place.countryCode || 'US').toUpperCase();
  const newsQuery = buildNewsQuery(place.displayName, place.country);

  const weatherP = fetchWeather(place.lat, place.lon);
  const newsP = fetchNews(newsQuery, hl, gl);
  const camP = fetchWebcam(place.lat, place.lon);

  weatherP.then(w => renderWeatherChips(place, info, w)).catch(() => renderWeatherChips(place, info, null));
  newsP.then(n => { currentArticles = n.articles || []; currentNewsError = n.error || null; renderWire(); })
       .catch(e => { currentArticles = []; currentNewsError = String(e); renderWire(); });
  camP.then(c => renderCam(c)).catch(() => renderCam(null));

  if(openCityView) showView('city');
}

function renderSummarySkeleton(place){
  document.getElementById('dateline').textContent = `${place.displayName.toUpperCase()} — ${new Date().toLocaleDateString('es-UY',{day:'2-digit',month:'short',year:'numeric'})}`;
  document.getElementById('placeName').textContent = place.displayName;
  document.getElementById('chips').innerHTML = `<span class="chip">Cargando datos…</span>`;

  const favBtn = document.getElementById('favToggle');
  const fav = isFavorite(place.displayName, place.country);
  favBtn.classList.toggle('on', fav);
  favBtn.textContent = fav ? '✓ En favoritos' : '+ Fijar como favorito';
  favBtn.onclick = () => {
    const nowFav = toggleFavorite({ displayName: place.displayName, country: place.country, lat: place.lat, lon: place.lon, tz: place.tz });
    favBtn.classList.toggle('on', nowFav);
    favBtn.textContent = nowFav ? '✓ En favoritos' : '+ Fijar como favorito';
  };

  document.getElementById('enterBtn').onclick = () => { showView('city'); updateUrl(place, 'city'); };

  document.getElementById('summaryCard').classList.add('active');
}

function showView(view){
  document.getElementById('summaryCard').classList.toggle('active', view === 'home');
  document.getElementById('cityView').classList.toggle('active', view === 'city');
  if(view === 'city'){
    document.getElementById('interestInput').value = '';
    document.getElementById('interestWire').innerHTML = '';
    loadPOIs('cafe');
  }
}

/* ---- Clima + huso horario en vivo (Open-Meteo, sin API key) ---- */
async function fetchWeather(lat, lon){
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&timezone=auto`;
  const res = await fetch(url);
  if(!res.ok) throw new Error('weather http ' + res.status);
  const data = await res.json();
  return {
    temp: data.current?.temperature_2m,
    code: data.current?.weather_code,
    isDay: data.current?.is_day,
    tz: data.timezone
  };
}
const WEATHER_ICON = {
  0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌦️',
  61:'🌧️',63:'🌧️',65:'🌧️',71:'🌨️',73:'🌨️',75:'🌨️',80:'🌦️',81:'🌧️',82:'⛈️',
  95:'⛈️',96:'⛈️',99:'⛈️'
};
function renderWeatherChips(place, info, weather){
  const chips = document.getElementById('chips');
  const parts = [];
  parts.push(`<span class="chip"><b>País</b> ${place.country || '—'}</span>`);
  if(weather && weather.tz){
    place.tz = weather.tz;
    const hora = new Intl.DateTimeFormat('es-UY', { hour:'2-digit', minute:'2-digit', hour12:false, timeZone: weather.tz }).format(new Date());
    parts.push(`<span class="chip"><b>Hora local</b> ${hora}</span>`);
  }
  if(weather && typeof weather.temp === 'number'){
    const icon = WEATHER_ICON[weather.code] || '🌡️';
    parts.push(`<span class="chip">${icon} <b>${Math.round(weather.temp)}°C</b> ahora</span>`);
  }
  if(info){
    parts.push(`<span class="chip"><b>Idioma</b> ${info.lang.toUpperCase()}</span>`);
    parts.push(`<span class="chip"><b>Moneda</b> ${info.currency}</span>`);
    parts.push(`<span class="chip"><b>Capital</b> ${info.capital}</span>`);
  }
  if(place.population){
    parts.push(`<span class="chip"><b>Población</b> ${place.population.toLocaleString('es-UY')}</span>`);
  }
  chips.innerHTML = parts.join('');
}

/* ---- Cámara en vivo (Windy) ---- */
async function fetchWebcam(lat, lon){
  const res = await fetch(`/api/webcam?lat=${lat}&lon=${lon}`);
  return res.json();
}
function renderCam(data){
  const box = document.getElementById('camBox');
  if(!data || !data.webcams || !data.webcams.length){ box.style.display = 'none'; return; }
  const cam = data.webcams[0];
  document.getElementById('camImg').src = cam.imageUrl;
  document.getElementById('camTitle').textContent = cam.title || 'Cámara pública cerca';
  document.getElementById('camLink').href = cam.viewerUrl;
  box.style.display = 'block';
}

/* ---- Noticias: traducción individual al toque + link al medio ya traducido ---- */
let currentArticles = [], currentNewsError = null, allTranslated = false;

function googleTranslateProxy(url){
  return `https://translate.google.com/translate?sl=auto&tl=es&u=${encodeURIComponent(url)}`;
}
async function fetchNews(q, hl, gl){
  const res = await fetch(`/api/news?q=${encodeURIComponent(q)}&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}`);
  return res.json();
}
async function translateText(text){
  const res = await fetch(`/api/translate?text=${encodeURIComponent(text)}&target=es`);
  if(!res.ok) throw new Error('translate request failed');
  const data = await res.json();
  return data?.translatedText || text;
}
function formatWireDate(raw){
  if(!raw) return '';
  const d = new Date(raw);
  if(isNaN(d)) return raw;
  return d.toLocaleDateString('es-UY', { day:'2-digit', month:'short', year:'numeric' });
}

function renderWire(){
  const wire = document.getElementById('wire');
  const btn = document.getElementById('translateBtn');
  btn.disabled = !currentArticles.length;
  btn.textContent = allTranslated ? 'Ver original' : 'Traducir todo';
  wire.innerHTML = '';

  if(currentNewsError){ wire.innerHTML = `<div class="state-msg">No se pudieron traer los titulares — error: ${currentNewsError}</div>`; return; }
  if(!currentArticles.length){ wire.innerHTML = '<div class="state-msg">No se encontraron titulares recientes para este lugar.</div>'; return; }

  currentArticles.forEach((a, i) => {
    const item = document.createElement('div');
    item.className = 'wire-item';
    const shownTitle = allTranslated && a._translated ? a._translated : a.title;
    item.innerHTML = `
      <a href="${googleTranslateProxy(a.url)}" target="_blank" rel="noopener">${shownTitle}</a>
      <div class="wire-meta">
        <span>${a.domain || ''} · ${formatWireDate(a.seendate)}</span>
        ${a._translated ? '' : `<span class="mini-translate" data-i="${i}">traducir</span>`}
      </div>`;
    wire.appendChild(item);
  });

  wire.querySelectorAll('.mini-translate').forEach(el => {
    el.addEventListener('click', async () => {
      const i = parseInt(el.dataset.i, 10);
      el.textContent = 'traduciendo…';
      try{ currentArticles[i]._translated = await translateText(currentArticles[i].title); }
      catch(e){ currentArticles[i]._translated = currentArticles[i].title; }
      renderWire();
    });
  });
}

document.getElementById('translateBtn').addEventListener('click', async () => {
  const btn = document.getElementById('translateBtn');
  if(allTranslated){ allTranslated = false; renderWire(); return; }
  btn.disabled = true; btn.textContent = 'Traduciendo…';
  try{
    await Promise.all(currentArticles.map(async a => {
      if(!a._translated){ try{ a._translated = await translateText(a.title); }catch(e){ a._translated = a.title; } }
    }));
    allTranslated = true;
  }catch(e){ console.error(e); }
  renderWire();
});

/* ---- Intereses locales: búsqueda libre dentro de la ciudad ---- */
document.getElementById('interestBtn').addEventListener('click', async () => {
  if(!currentPlace) return;
  const topic = document.getElementById('interestInput').value.trim();
  const wire = document.getElementById('interestWire');
  if(!topic){ wire.innerHTML = '<div class="state-msg">Escribí qué te interesa buscar de este lugar.</div>'; return; }
  wire.innerHTML = '<div class="state-msg">Buscando…</div>';
  const info = countryInfoFor(currentPlace.countryCode);
  const hl = info ? info.lang : 'es';
  const gl = (currentPlace.countryCode || 'US').toUpperCase();
  const q = `${topic} ${currentPlace.displayName}`;
  try{
    const data = await fetchNews(q, hl, gl);
    const articles = data.articles || [];
    if(!articles.length){ wire.innerHTML = '<div class="state-msg">No encontré nada puntual sobre eso. Probá con otras palabras.</div>'; return; }
    wire.innerHTML = '';
    articles.forEach(a => {
      const item = document.createElement('div');
      item.className = 'wire-item';
      item.innerHTML = `<a href="${googleTranslateProxy(a.url)}" target="_blank" rel="noopener">${a.title}</a>
        <div class="wire-meta"><span>${a.domain || ''} · ${formatWireDate(a.seendate)}</span></div>`;
      wire.appendChild(item);
    });
  }catch(e){ wire.innerHTML = '<div class="state-msg">Error al buscar. Probá de nuevo.</div>'; }
});
document.getElementById('interestInput').addEventListener('keydown', e => {
  if(e.key === 'Enter') document.getElementById('interestBtn').click();
});

/* ---- Lugares cerca (POI vía OpenStreetMap) ---- */
const POI_CATEGORIES = [
  ['cafe','Cafés'], ['restaurante','Restaurantes'], ['bar','Bares'],
  ['museo','Museos'], ['mirador','Miradores'], ['mercado','Mercados']
];
(function initPoiTabs(){
  const tabs = document.getElementById('poiTabs');
  POI_CATEGORIES.forEach(([key, label], i) => {
    const btn = document.createElement('div');
    btn.className = 'poi-tab' + (i === 0 ? ' active' : '');
    btn.textContent = label;
    btn.dataset.key = key;
    btn.addEventListener('click', () => {
      tabs.querySelectorAll('.poi-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      loadPOIs(key);
    });
    tabs.appendChild(btn);
  });
})();

async function loadPOIs(category){
  if(!currentPlace) return;
  const grid = document.getElementById('poiGrid');
  const state = document.getElementById('poiState');
  grid.innerHTML = '';
  state.textContent = 'Buscando lugares cerca…';
  try{
    const res = await fetch(`/api/places?lat=${currentPlace.lat}&lon=${currentPlace.lon}&category=${category}`);
    const data = await res.json();
    const places = data.places || [];
    if(!places.length){ state.textContent = 'No encontré lugares de esta categoría cerca (la base es OpenStreetMap, la cobertura varía por ciudad).'; return; }
    state.textContent = '';
    places.forEach(p => {
      const card = document.createElement('div');
      card.className = 'poi-card';
      card.innerHTML = `<div class="poi-name">${p.name}</div>
        <div class="poi-addr">${p.address || 'Sin dirección registrada'}</div>
        <a class="poi-link" href="${p.mapUrl}" target="_blank" rel="noopener">ver en el mapa →</a>`;
      grid.appendChild(card);
    });
  }catch(e){ state.textContent = 'Error al buscar lugares. Probá de nuevo.'; }
}

/* ---- Arranque: si la URL trae un lugar (link compartido), lo cargamos directo ---- */
(function bootFromUrl(){
  const params = new URLSearchParams(location.search);
  if(params.get('place') && params.get('lat') && params.get('lon')){
    const place = {
      displayName: params.get('place'), country: params.get('country') || '',
      countryCode: params.get('cc') || '', lat: params.get('lat'), lon: params.get('lon')
    };
    loadPlace(place.displayName, place, params.get('view') === 'city');
  }
})();
