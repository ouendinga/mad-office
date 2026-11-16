import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { renderOffice, centerOn, panBy, canPan, pickAt, pickInLens, pickRoomAt, roomIdOf, roomLabel, callText } from '../canvas/officeRenderer';
import { renderStreet, streetHasWalkers } from '../canvas/streetRenderer';
import { augmentWorld, DEMO } from '../canvas/demo';
import { weatherLabel } from '../canvas/weather';
import HomeStrip from '../components/HomeStrip';
import { characterSprite } from '../engine/Character';
import { capi, getToken, waitTurn, WS_URL, HUMOR_EMOJI } from '../api';
import '../styles/office.css';
import '../styles/history.css';
import StatsPentagon from '../components/StatsPentagon';
import PruebasPanel from '../components/PruebasPanel';
import { getPlan, setPlan } from '../canvas/plan';
import { FlaskConical, Network, Settings, UserRound, LogOut, UserPlus, ScrollText, AlertTriangle, PartyPopper, LayoutGrid, Eye,
  MoreHorizontal, Map as MapIcon, Footprints, Building2, Moon, Radio, Sparkles, Check, Repeat, ChevronDown, Globe } from 'lucide-react';

const WEEKDAYS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// El tiempo de verdad (Open-Meteo, sin clave). Si falla, la tarjeta sale sin él.
const WEATHER_LAT = process.env.REACT_APP_WEATHER_LAT || '40.4168';
const WEATHER_LON = process.env.REACT_APP_WEATHER_LON || '-3.7038';
function weatherText(code) {
  if (code === 0) return ['☀️', 'Despejado'];
  if (code <= 2) return ['🌤️', 'Algo nuboso'];
  if (code === 3) return ['☁️', 'Nublado'];
  if (code <= 48) return ['🌫️', 'Niebla'];
  if (code <= 67 || (code >= 80 && code <= 82)) return ['🌧️', 'Lluvia'];
  if (code <= 77 || code === 85 || code === 86) return ['❄️', 'Nieve'];
  return ['⛈️', 'Tormenta'];
}
function useWeather() {
  const [w, setW] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () => fetch(`https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}&current=temperature_2m,weather_code&timezone=Europe%2FMadrid`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d && d.current) setW({ t: Math.round(d.current.temperature_2m), code: d.current.weather_code }); })
      .catch(() => {});
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return w;
}

function DayCard({ clock, weather }) {
  if (!clock) return null;
  const [, m, d] = clock.date.split('-').map(Number);
  const night = clock.block === 'noche';
  // el tiempo del servidor (contrato v2) manda; si no viene, el que pide el navegador
  const sw = clock.weather;
  const [icon, label] = sw ? weatherLabel(sw) : weather ? weatherText(weather.code) : [null, null];
  const temp = sw ? Math.round(sw.temp) : weather ? weather.t : null;
  const phaseText = { ida: '🚶 Camino del trabajo', vuelta: '🚶 Volviendo a casa' }[clock.phase];
  return (
    <div className={`day-card ${night && !phaseText ? 'is-night' : ''}`}>
      <div className="day-card-date">{WEEKDAYS[clock.weekday]} {d} {MONTHS[m - 1]}</div>
      <div className="day-card-meta">
        <span className="day-card-time">{clock.hhmm}</span>
        {icon && <span>{icon} {label} · {temp} °C</span>}
        {clock.city && <span>📍 {clock.city}</span>}
        {phaseText ? <span>{phaseText}</span> : night && <span>🌙 Todos en casa</span>}
      </div>
    </div>
  );
}

function Portrait({ config }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 64, 64);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(characterSprite(config || {}), 0, 0, 32, 20, 0, 0, 64, 40);
  }, [config]);
  return <canvas ref={ref} width={64} height={40} className="lupa-portrait" />;
}
const PLACE_TEXT = { mesa: 'en su mesa', cafe: 'en la cocina', reuniones: 'en reunión', lavabo: 'en el baño', visita: 'de visita', descanso: 'en la zona chill', terraza: 'en la terraza', recepcion: 'en recepción', despacho: 'en el despacho', servidores: 'con los servidores' };

function fmtMorning(date, cap = false) {
  const d = new Date(`${date}T12:00:00`);
  const t = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  // Mayúscula solo al principio («Lunes, 16 de noviembre»): con CSS capitalize salía «De».
  return cap ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

// ¿Pantalla de móvil? (≤ 800 px: pestañas abajo y menú «⋯» arriba)
function useNarrow() {
  const q = '(max-width: 800px)';
  const [narrow, setNarrow] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setNarrow(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return narrow;
}

const TABS = [
  ['oficina', 'Oficina', MapIcon],
  ['personaje', 'Mi personaje', UserRound],
  ['sueno', 'Sueño', Moon],
  ['feed', 'Feed', Radio],
];

export default function Office({ me, company, owner, onBecome, onLogout, onEditAvatar, onHistory, onCompanies, onOrg, onOffices, onCompanySettings }) {
  const isAdmin = company.role === 'admin';
  const placeLog = useRef(new Map()); // minuto → sitio de mi personaje (para «lo que sabe»)
  const narrow = useNarrow();
  const [tab, setTab] = useState('oficina'); // pestaña en móvil
  const [menu, setMenu] = useState(false); // menú «⋯» en móvil
  const [showPruebas, setShowPruebas] = useState(false);
  const canvasRef = useRef(null);
  const worldRef = useRef(null);
  const frameRef = useRef(0);
  const [world, setWorld] = useState(null);
  const planLoading = useRef(false);
  const [feed, setFeed] = useState([]);
  const [offline, setOffline] = useState(false);
  const [selected, setSelected] = useState(null); // ficha abierta
  const selectedIdRef = useRef(null);
  const focusRef = useRef(null); // la lupa: { room, charId }
  const [focus, setFocus] = useState(null);
  const viewRef = useRef('auto'); // 'auto' | 'office' | 'street'
  const [view, setView] = useState('auto');
  const weather = useWeather();

  // Directo por socket.
  useEffect(() => {
    capi('/feed').then(setFeed).catch(() => {});
    const socket = io(WS_URL || window.location.origin, { auth: { token: getToken(), companyId: company.id }, transports: ['websocket', 'polling'] });
    socket.on('connect', () => setOffline(false));
    socket.on('disconnect', () => setOffline(true));
    socket.on('connect_error', () => setOffline(true));
    socket.on('world', w => {
      // Si la empresa tiene otra oficina (o se ha mudado), se trae su plano.
      const want = w.company && w.company.oficina;
      if (want && want !== getPlan().id && !planLoading.current) {
        planLoading.current = true;
        capi('/oficina').then(setPlan).catch(() => {}).finally(() => { planLoading.current = false; });
      }
      const aw = augmentWorld(w);
      worldRef.current = aw;
      setWorld(aw);
      // Dónde está mi personaje a cada minuto de hoy: así se sabe qué ha podido oír.
      const mine = aw.characters.find(c => c.owner_user_id === me.user.id && !c.visitor);
      if (mine && aw.clock) {
        const [h, m] = aw.clock.hhmm.split(':').map(Number);
        const where = mine.mode === 'remoto' ? 'casa' : mine.mode === 'oficina' ? roomOfPlace(mine.lugar) : null;
        if (where) placeLog.current.set(`${aw.clock.date}|${h * 60 + m}`, where);
      }
    });
    // Los pensamientos (privados) van al historial, no a la radio.
    socket.on('feed', item => {
      if (item.private) return;
      // Lo que llega en directo no trae el día: es el de hoy en la oficina.
      const day = worldRef.current && worldRef.current.clock ? worldRef.current.clock.date : null;
      setFeed(prev => [...prev, { office_day: day, ...item }].slice(-80));
    });
    return () => socket.disconnect();
  }, [company.id, me.user.id]);

  // Bucle de dibujo.
  useEffect(() => {
    let raf;
    const loop = () => {
      const canvas = canvasRef.current;
      if (canvas && canvas.offsetParent !== null) { // en móvil, con otra pestaña, no se pinta
        frameRef.current++;
        const wd = worldRef.current;
        if (showStreet(wd, viewRef.current)) renderStreet(canvas.getContext('2d'), canvas, wd, Math.floor(frameRef.current / 8));
        else renderOffice(canvas.getContext('2d'), canvas, wd, Math.floor(frameRef.current / 8), focusRef.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // El lienzo va a la resolución real de la pantalla (devicePixelRatio): así el pixel art puede
  // caer en píxeles enteros del dispositivo. Los dibujantes trabajan en px CSS (canvas._dpr).
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return undefined;
    const resize = () => {
      const w = c.parentElement.clientWidth;
      const h = c.parentElement.clientHeight;
      if (!w || !h) return; // pestaña oculta en móvil
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      c._dpr = dpr;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(c.parentElement);
    window.addEventListener('resize', resize);
    return () => { ro.disconnect(); window.removeEventListener('resize', resize); };
  }, []);

  const openCharacter = useCallback(async id => {
    if (id < 0) return; // los visitantes no tienen ficha
    selectedIdRef.current = id;
    try {
      setSelected(await capi(`/characters/${id}`));
    } catch {
      setSelected(null);
    }
  }, []);

  const changeFocus = f => { focusRef.current = f; setFocus(f); };
  const changeView = v => { viewRef.current = v; setView(v); changeFocus(null); };

  // Arrastrar el mapa de lado (móvil en vertical). Si se ha arrastrado, el clic no cuenta.
  const drag = useRef(null);
  const onPointerDown = e => { drag.current = { x: e.clientX, moved: 0 }; };
  const onPointerMove = e => {
    const d = drag.current;
    if (!d || !canPan()) return;
    const dx = e.clientX - d.x;
    d.x = e.clientX;
    d.moved += Math.abs(dx);
    if (d.moved > 6) panBy(dx);
  };
  const onPointerUp = () => { setTimeout(() => { drag.current = null; }, 0); };

  const onCanvasClick = e => {
    if (drag.current && drag.current.moved > 6) return;
    if (showStreet(worldRef.current, viewRef.current)) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    // Con la lupa abierta: dentro, se elige a quién mirar; fuera, se cierra.
    if (focusRef.current) {
      const hit = pickInLens(sx, sy);
      if (!hit || hit.outside) changeFocus(null);
      else if (hit.charId) changeFocus({ ...focusRef.current, charId: hit.charId });
      return;
    }
    const hit = pickAt(worldRef.current, sx, sy);
    if (hit) return changeFocus({ room: roomIdOf(hit), charId: hit.id });
    const room = pickRoomAt(sx, sy);
    changeFocus(room && room !== 'pasillo' ? { room, charId: null } : null);
  };

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') { changeFocus(null); setMenu(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const mine = world && world.characters.find(c => c.owner_user_id === me.user.id && !c.visitor);
  // En móvil, el mapa empieza centrado en tu personaje.
  const mineId = mine ? mine.id : null;
  useEffect(() => { if (mineId != null) centerOn(mineId); }, [mineId]);
  const clock = world && world.clock;
  const focused = focus && focus.charId != null && world ? world.characters.find(c => c.id === focus.charId) : null;
  const inStreet = showStreet(world, view);
  const streetTime = clock && (clock.phase === 'ida' || clock.phase === 'vuelta') && streetHasWalkers(world);
  const focusRoom = focus && focus.follow && focused ? roomIdOf(focused) : focus && focus.room;
  const roomPeople = focus && world ? world.characters.filter(c => c.mode !== 'remoto' && !c.home && c.x != null && roomIdOf(c) === focusRoom) : [];

  // Lo que va en la cabecera (en móvil, dentro del menú «⋯»). «Ajustes» junta lo que antes eran
  // «Oficina» (ciudad y tiempo) y «Empresa», y solo lo ve quien lleva la empresa.
  const menuItems = [
    owner && isAdmin && ['Pruebas', FlaskConical, () => setShowPruebas(true)],
    ['Organigrama', Network, onOrg],
    ['Oficinas', LayoutGrid, onOffices, 'Oficinas: planos y mudanza'],
    isAdmin && ['Ajustes', Settings, onCompanySettings, 'Ajustes de la empresa y de la oficina'],
    narrow && ['Cambiar de empresa', Repeat, onCompanies],
    ['Avatar', UserRound, onEditAvatar],
    ['Salir', LogOut, onLogout],
  ].filter(Boolean);

  return (
    <div className="office-page" data-tab={narrow ? tab : undefined}>
      <header className="office-header">
        <div className="office-header-left">
          <button type="button" className="office-company" onClick={onCompanies} title="Cambiar de empresa">
            <span className="office-logo pixel-font">{company.name}</span> <ChevronDown size={14} aria-hidden />
          </button>
          {clock && (
            <span className="office-clock" title={clock.date}>
              <span className="office-clock-day">{WEEKDAYS[clock.weekday]} </span>{clock.hhmm}
            </span>
          )}
          {clock && clock.test && (
            <span className="office-test" title="Reloj de pruebas: esta empresa no va con la hora real">
              🧪 reloj de pruebas{clock.test.speed > 1 ? ` ×${clock.test.speed}` : ''}
            </span>
          )}
          {offline && <span className="office-offline">sin conexión…</span>}
        </div>
        <div className="office-header-right">
          <span className="office-user-name">{me.user.name}</span>
          {isAdmin && <InviteButton />}
          {narrow ? (
            <div className="office-more">
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Más opciones" aria-expanded={menu} aria-haspopup="menu"
                onClick={() => setMenu(!menu)}><MoreHorizontal size={20} aria-hidden /></button>
              {menu && (
                <>
                  <div className="office-more-backdrop" onClick={() => setMenu(false)} />
                  <div className="office-more-menu" role="menu">
                    {menuItems.map(([label, Icon, fn]) => (
                      <button key={label} type="button" role="menuitem" onClick={() => { setMenu(false); fn(); }}><Icon size={18} aria-hidden /> {label}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : menuItems.map(([label, Icon, fn, title]) => (
            <button key={label} className="btn btn-ghost btn-sm" title={title || label} aria-label={label} onClick={fn}><Icon size={16} aria-hidden /> <span className="hb-label">{label}</span></button>
          ))}
        </div>
      </header>

      {showPruebas && <PruebasPanel company={company} onClose={() => setShowPruebas(false)} onBecome={(tk, n) => { setShowPruebas(false); onBecome(tk, n); }} />}
      <div className="office-layout">
        <div className="office-canvas-container">
          <canvas ref={canvasRef} className="office-canvas" onClick={onCanvasClick}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} />
          <DayCard clock={clock} weather={weather} />
          {DEMO && <div className="demo-badge">DEMO</div>}
          {streetTime && (
            <div className="view-switch">
              <button type="button" className={`btn btn-sm ${inStreet ? 'btn-primary' : 'btn-ghost'}`} onClick={() => changeView('street')}><Footprints size={15} aria-hidden /> La calle</button>
              <button type="button" className={`btn btn-sm ${!inStreet ? 'btn-primary' : 'btn-ghost'}`} onClick={() => changeView('office')}><Building2 size={15} aria-hidden /> La oficina</button>
            </div>
          )}
          {!inStreet && mine && mine.mode === 'oficina' && !(focus && focus.follow) && (
            <button type="button" className="btn btn-secondary btn-sm my-view" title="Sigue a tu personaje: lo que ve y oye"
              onClick={() => changeFocus({ room: roomIdOf(mine), charId: mine.id, follow: true })}><Eye size={16} aria-hidden /> Tu vista</button>
          )}
          {!inStreet && !focus && <HomeStrip world={world} />}
          {focus && !inStreet && (
            <div className="lupa-box">
              {focused ? <Portrait config={focused.avatar_config} /> : <div className="lupa-portrait lupa-room"><Building2 size={22} aria-hidden /></div>}
              <div className="lupa-text">
                {focused ? (
                  <>
                    <div className="lupa-name">{HUMOR_EMOJI[focused.humor] || ''} {focused.name}</div>
                    <div className="lupa-line">{focused.bubble ? `«${focused.bubble}»` : focused.que}</div>
                    {callText(focused, world) && <div className="lupa-line lupa-call">{callText(focused, world)}</div>}
                  </>
                ) : (
                  <>
                    <div className="lupa-name">{roomLabel(focus.room)}</div>
                    <div className="lupa-line">
                      {roomPeople.length ? `Aquí: ${roomPeople.map(c => c.name).join(', ')}. Toca a alguien para verle.` : 'Ahora mismo no hay nadie.'}
                    </div>
                  </>
                )}
                <div className="lupa-meta">
                  {WEEKDAYS[clock.weekday].replace(/^./, c => c.toUpperCase())} · {clock.hhmm} · {roomLabel(focus.room)}
                </div>
              </div>
              <div className="lupa-actions">
                {focused && !focused.visitor && <button type="button" className="btn btn-ghost btn-sm" onClick={() => openCharacter(focused.id)}>Ficha y diario</button>}
                <button type="button" className="lupa-close" aria-label="Cerrar" onClick={() => changeFocus(null)}>×</button>
              </div>
            </div>
          )}
        </div>

        <aside className="office-sidebar">
          <MyCharacter mine={mine} isAdmin={isAdmin} onHistory={onHistory} onOpen={() => mine && openCharacter(mine.id)} />
          <OfficeNow office={world && world.office} />
          <DreamPanel clock={clock} />
          <Feed feed={feed} mine={mine} placeLog={placeLog} />
        </aside>
      </div>

      {selected && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setSelected(null); selectedIdRef.current = null; } }}>
          <div className="modal char-modal">
            <button className="modal-close" onClick={() => { setSelected(null); selectedIdRef.current = null; }}>&times;</button>
            <h2 className="modal-title">{HUMOR_EMOJI[selected.humor] || ''} {selected.name}</h2>
            <p className="char-puesto">{selected.ficha.puesto}</p>
            <p>{selected.ficha.personalidad}</p>
            {selected.aspecto && <p className="char-look">Se le nota: {selected.aspecto.join(', ')}.</p>}
            {selected.ficha.manias && selected.ficha.manias.length > 0 && (
              <ul className="char-list">{selected.ficha.manias.map(m => <li key={m}>{m}</li>)}</ul>
            )}
            {selected.full ? (
              <>
                <p><strong>Objetivo:</strong> {selected.ficha.objetivo}</p>
                <h3 className="char-h3">📔 Diario</h3>
                {selected.diaries.length === 0 && <p className="muted">Aún no ha escrito nada.</p>}
                {selected.diaries.map(d => (
                  <div key={d.day} className="char-diary">
                    <div className="char-diary-day">{fmtMorning(d.day, true)}</div>
                    <p>{d.text}</p>
                  </div>
                ))}
              </>
            ) : (
              <p className="muted char-private">Su objetivo, su diario y lo que piensa solo los ve su dueño (y quien lleva la empresa). Tú ves lo que se nota desde fuera.</p>
            )}
          </div>
        </div>
      )}
      {narrow && (
        <nav className="office-tabs" role="tablist" aria-label="Secciones">
          {TABS.map(([id, label, Icon]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''}
              onClick={() => { setTab(id); window.scrollTo(0, 0); }}>
              <Icon size={20} aria-hidden /><span>{label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

// Qué hace mi personaje, según dónde esté (contrato v2: mode).
function mineText(m) {
  if (m.mode === 'remoto') return `Teletrabaja desde casa: ${m.que || 'a su ritmo'}`;
  if (m.mode === 'ida') return `De camino a la oficina${m.trayecto ? `: ${m.trayecto}` : ''}`;
  if (m.mode === 'vuelta') return `Volviendo a casa${m.trayecto ? `: ${m.trayecto}` : ''}`;
  if (m.mode === 'casa' || m.home) return 'En casa, durmiendo.';
  return `${m.que} (${PLACE_TEXT[m.lugar] || m.lugar})`;
}

// ¿Toca enseñar la calle? Solo en las franjas de ida y vuelta y si hay alguien andando.
function showStreet(world, view) {
  if (view === 'office') return false;
  const phase = world && world.clock && world.clock.phase;
  if (phase !== 'ida' && phase !== 'vuelta') return false;
  return view === 'street' || streetHasWalkers(world);
}

// La hora de la oficina (la del suceso), no la del ordenador: con el reloj de pruebas no casaban.
function feedTime(f) {
  if (f.min != null) return `${String(Math.floor(f.min / 60)).padStart(2, '0')}:${String(f.min % 60).padStart(2, '0')}`;
  return new Date(f.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

// Invitar con un toque: crea un enlace (14 días, 20 usos) y lo comparte o lo copia.
function InviteButton() {
  const [msg, setMsg] = useState('');
  const invite = async () => {
    setMsg('');
    try {
      const inv = await capi('/invitations', { method: 'POST', body: { days: 14, max_uses: 20 } });
      const url = `${window.location.origin}/invitacion/${inv.code}`;
      if (navigator.share) {
        await navigator.share({ title: 'Mad Office', text: 'Únete a nuestra oficina en Mad Office', url }).catch(() => {});
        setMsg('Enlace listo');
      } else {
        await navigator.clipboard.writeText(url);
        setMsg('Enlace copiado');
      }
    } catch (e) {
      setMsg(e.message || 'No se pudo crear el enlace');
    }
    setTimeout(() => setMsg(''), 4000);
  };
  return (
    <span className="invite-wrap">
      <button type="button" className="btn btn-secondary btn-sm" onClick={invite} title="Crea un enlace de invitación (14 días) y lo copia">
        <UserPlus size={16} aria-hidden /> Invitar
      </button>
      {msg && <span className="invite-msg" role="status">{msg}</span>}
    </span>
  );
}

function Bar({ label, value }) {
  return (
    <div className="stat-row">
      <span>{label}</span>
      <div className="stat-track"><div className="stat-fill" style={{ width: `${value * 10}%` }} /></div>
    </div>
  );
}

function MyCharacter({ mine, isAdmin, onOpen, onHistory }) {
  const [usage, setUsage] = useState(null);
  useEffect(() => {
    const load = () => capi('/me/usage').then(setUsage).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);
  if (!mine) return <section className="sidebar-section mine-section"><p className="muted">Tu personaje está en pausa.</p></section>;
  return (
    <section className="sidebar-section mine-section">
      <h3 className="sidebar-title">Tu personaje</h3>
      <button type="button" className="mine-name" onClick={onOpen}>
        {HUMOR_EMOJI[mine.humor] || ''} {mine.name} <span className="muted">· ver ficha y diario</span>
      </button>
      <p className="mine-now">
        {mineText(mine)}
      </p>
      {mine.stats && <StatsPentagon stats={mine.stats} size={180} />}
      <Bar label="Café" value={mine.cafe} />
      <button type="button" className="btn btn-ghost btn-sm mine-history" onClick={() => onHistory && onHistory(mine.id)}><ScrollText size={16} aria-hidden /> Mi historial</button>
      {usage && (
        <p className="mine-usage" title="Lo que lleva gastado hoy tu suscripción en esta oficina">
          IA hoy: {usage.calls} llamadas · {Number(usage.spent).toFixed(3)} $ de {usage.cap} $
          {isAdmin ? ' (incluye a los C-suite ficticios)' : ''}
        </p>
      )}
    </section>
  );
}

const PLACE_LABEL = { terraza: 'terraza', descanso: 'zona chill', reuniones: 'sala de reuniones', cafe: 'cocina' };

// Lo que pasa ahora en la oficina: incidentes abiertos y eventos de hoy.
function OfficeNow({ office }) {
  const outside = (office && office.outside) || [];
  if (!office || (!office.incidents.length && !office.events.length && !outside.length)) return null;
  return (
    <section className="sidebar-section office-now">
      <h3 className="sidebar-title">Ahora en la oficina</h3>
      <ul className="office-now-list">
        {outside.map(o => (
          <li key={`o${o.id}`} className="office-now-out">
            <Globe size={14} aria-hidden />
            <span>
              {String(o.title).replace(/^\S+\s/, '').split(/\. |: /)[0]}
              {o.place && <span className="muted"> · {o.from}–{o.to} en {PLACE_LABEL[o.place] || o.place}{o.active ? ' · ahora' : ''}</span>}
            </span>
          </li>
        ))}
        {office.incidents.map(i => (
          <li key={`i${i.id}`} className="office-now-inc"><AlertTriangle size={14} aria-hidden /> {String(i.title).split('. ')[0]}</li>
        ))}
        {office.events.map(e => (
          <li key={`e${e.id}`} className={`office-now-ev ${e.active ? 'is-on' : ''}`}>
            <PartyPopper size={14} aria-hidden /> <strong>{e.from}</strong> {e.title} <span className="muted">· {PLACE_LABEL[e.place] || e.place}{e.active ? ' · ahora' : ''}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DreamPanel({ clock }) {
  const [state, setState] = useState(null);
  const [text, setText] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(null);
  const [error, setError] = useState('');
  const open = clock ? clock.dreamOpen : false;

  const load = useCallback(() => capi('/me/dream').then(s => {
    setState(s);
    setText(s.text || '');
    setSaved(s.text || '');
  }).catch(() => {}), []);

  useEffect(() => { load(); }, [load, open]);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await capi('/me/dream', { method: 'PUT', body: { text } });
      setSaved(r.text);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const askHelp = async () => {
    setBusy(true);
    setError('');
    setHelp(null);
    try {
      const r = await capi('/me/dream/help', { method: 'POST', body: { draft: text } });
      setHelp(await waitTurn(r.turnId, { onSlow: () => setError('La musa tarda… ¿está encendido el despertador?') }));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="sidebar-section dream">
      <h3 className="sidebar-title"><Moon size={14} aria-hidden /> El sueño de esta noche</h3>
      {state && state.last && (
        <p className="dream-last">
          Soñó «{state.last.text}» y {state.last.followed ? 'le hizo caso' : 'pasó'}: <em>{state.last.reason}</em>
        </p>
      )}
      {!open ? (
        <p className="muted">Ahora está despierto. Al acabar la jornada{clock && clock.schedule ? ` (${clock.schedule.end})` : ''} se abre la ventana de los sueños.</p>
      ) : (
        <>
          <p className="muted">Lo soñará antes de despertar el {state ? fmtMorning(state.morning) : '…'}. Él decide si te hace caso.</p>
          <textarea
            className="dream-input"
            maxLength={200}
            rows={3}
            value={text}
            placeholder="Sueñas que Paco esconde algo en la maceta…"
            onChange={e => setText(e.target.value)}
          />
          <div className="dream-row">
            <span className="muted">{text.length}/200</span>
            <button className="btn btn-secondary btn-sm" onClick={askHelp} disabled={busy}><Sparkles size={15} aria-hidden /> Ayúdame</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={busy || !text.trim() || text === saved}>
              {saved && text === saved ? <><Check size={15} aria-hidden /> Guardado</> : 'Guardar'}
            </button>
          </div>
          {help && (
            <div className="dream-help">
              {help.comentario && <p className="muted">{help.comentario}</p>}
              {help.propuestas.map(p => (
                <button key={p} type="button" className="dream-suggestion" onClick={() => setText(p)}>{p}</button>
              ))}
            </div>
          )}
        </>
      )}
      {error && <div className="modal-error">{error}</div>}
    </section>
  );
}

// El sitio «acústico» de un lugar: las mesas (y las visitas a una mesa) son el open space.
function roomOfPlace(lugar) {
  return lugar === 'mesa' || lugar === 'visita' ? 'openspace' : lugar;
}

// ¿Lo sabe mi personaje? Lo que hizo él, lo que le dijeron y lo que pasó en su mismo sitio y a la
// misma hora (según dónde le hemos visto mientras miramos). Lo de antes de abrir la página, solo lo suyo.
function knows(f, mine, placeLog) {
  if (!mine) return false;
  if (f.character_id === mine.id || f.con_id === mine.id) return true;
  if (f.kind === 'fuera' && !f.lugar) return true; // lo de fuera lo sabe todo el mundo
  if (f.min == null || !f.lugar || !f.office_day) return false;
  const day = String(f.office_day).slice(0, 10);
  for (const m of [f.min, f.min + 1, f.min - 1]) {
    const where = placeLog.current.get(`${day}|${m}`);
    if (where) return where !== 'casa' && where === roomOfPlace(f.lugar);
  }
  return false;
}

function Feed({ feed, mine, placeLog }) {
  const [onlyMine, setOnlyMine] = useState(false);
  const all = [...feed].reverse();
  const items = onlyMine ? all.filter(f => knows(f, mine, placeLog)) : all;
  return (
    <section className="sidebar-section feed">
      <h3 className="sidebar-title"><Radio size={14} aria-hidden /> Todo lo que pasa</h3>
      <label className="feed-toggle">
        <input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} />
        {' '}Solo lo que sabe mi personaje
      </label>
      <p className="muted feed-hint">{onlyMine ? 'Lo que ha visto, oído o le han contado. El resto no lo sabe… todavía.' : 'Tú te enteras de todo; tu personaje, solo de lo que pasa cerca de él.'}</p>
      {items.length === 0 && <p className="muted">{onlyMine ? 'Tu personaje no se ha enterado de nada. Bendita ignorancia.' : 'Silencio en la oficina… de momento.'}</p>}
      <ul className="feed-list">
        {items.map(f => (
          <li key={f.id} className={`feed-item feed-${f.kind}`}>
            <span className="feed-time">{feedTime(f)}</span>
            {f.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
