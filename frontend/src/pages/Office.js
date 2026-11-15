import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { renderOffice, pickAt, pickInLens, pickRoomAt, roomIdOf, roomLabel, callText } from '../canvas/officeRenderer';
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
import OfficeSettings from '../components/OfficeSettings';

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
      <div className="day-card-date pixel-font">{WEEKDAYS[clock.weekday]} {d} {MONTHS[m - 1]}</div>
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

function fmtMorning(date) {
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function Office({ me, company, owner, onBecome, onLogout, onEditAvatar, onHistory, onCompanies, onOrg, onCompanySettings }) {
  const isAdmin = company.role === 'admin';
  const placeLog = useRef(new Map()); // minuto → sitio de mi personaje (para «lo que sabe»)
  const [showSettings, setShowSettings] = useState(false);
  const [showPruebas, setShowPruebas] = useState(false);
  const canvasRef = useRef(null);
  const worldRef = useRef(null);
  const frameRef = useRef(0);
  const [world, setWorld] = useState(null);
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
      if (canvas) {
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

  useEffect(() => {
    const resize = () => {
      const c = canvasRef.current;
      if (!c) return;
      c.width = c.parentElement.clientWidth;
      c.height = c.parentElement.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
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

  const onCanvasClick = e => {
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
    const onKey = e => { if (e.key === 'Escape') changeFocus(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const mine = world && world.characters.find(c => c.owner_user_id === me.user.id && !c.visitor);
  const clock = world && world.clock;
  const focused = focus && focus.charId != null && world ? world.characters.find(c => c.id === focus.charId) : null;
  const inStreet = showStreet(world, view);
  const streetTime = clock && (clock.phase === 'ida' || clock.phase === 'vuelta') && streetHasWalkers(world);
  const roomPeople = focus && world ? world.characters.filter(c => c.mode !== 'remoto' && !c.home && c.x != null && roomIdOf(c) === focus.room) : [];

  return (
    <div className="office-page">
      <header className="office-header">
        <div className="office-header-left">
          <button type="button" className="office-company" onClick={onCompanies} title="Cambiar de empresa">
            <span className="office-logo pixel-font">{company.name}</span> <span aria-hidden="true">▾</span>
          </button>
          {clock && (
            <span className="office-clock" title={clock.date}>
              {WEEKDAYS[clock.weekday]} {clock.hhmm}
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
          {owner && isAdmin && <button className="btn btn-ghost btn-sm" onClick={() => setShowPruebas(true)}>🧪 Pruebas</button>}
          <button className="btn btn-ghost btn-sm" onClick={onOrg}>🗂️ Organigrama</button>
          <button className="btn btn-ghost btn-sm" onClick={onCompanySettings}>🏢 Empresa</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowSettings(true)}>🌦️ Oficina</button>
          <button className="btn btn-ghost btn-sm" onClick={onEditAvatar}>Avatar</button>
          <button className="btn btn-ghost btn-sm" onClick={onLogout}>Salir</button>
        </div>
      </header>

      {showPruebas && <PruebasPanel company={company} onClose={() => setShowPruebas(false)} onBecome={(tk, n) => { setShowPruebas(false); onBecome(tk, n); }} />}
      <div className="office-layout">
        <div className="office-canvas-container">
          <canvas ref={canvasRef} className="office-canvas" onClick={onCanvasClick} />
          <DayCard clock={clock} weather={weather} />
          {DEMO && <div className="demo-badge">DEMO</div>}
          {streetTime && (
            <div className="view-switch">
              <button type="button" className={`btn btn-sm ${inStreet ? 'btn-primary' : 'btn-ghost'}`} onClick={() => changeView('street')}>🚶 La calle</button>
              <button type="button" className={`btn btn-sm ${!inStreet ? 'btn-primary' : 'btn-ghost'}`} onClick={() => changeView('office')}>🏢 La oficina</button>
            </div>
          )}
          {!inStreet && !focus && <HomeStrip world={world} />}
          {focus && !inStreet && (
            <div className="lupa-box">
              {focused ? <Portrait config={focused.avatar_config} /> : <div className="lupa-portrait lupa-room">🏢</div>}
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
                  {WEEKDAYS[clock.weekday]} · {clock.hhmm} · {roomLabel(focus.room)}
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
            {selected.ficha.manias && selected.ficha.manias.length > 0 && (
              <ul className="char-list">{selected.ficha.manias.map(m => <li key={m}>{m}</li>)}</ul>
            )}
            <p><strong>Objetivo:</strong> {selected.ficha.objetivo}</p>
            <h3 className="char-h3">📔 Diario</h3>
            {selected.diaries.length === 0 && <p className="muted">Aún no ha escrito nada.</p>}
            {selected.diaries.map(d => (
              <div key={d.day} className="char-diary">
                <div className="char-diary-day">{fmtMorning(d.day)}</div>
                <p>{d.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {showSettings && <OfficeSettings isAdmin={isAdmin} onClose={() => setShowSettings(false)} />}
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
  if (!mine) return <section className="sidebar-section"><p className="muted">Tu personaje está en pausa.</p></section>;
  return (
    <section className="sidebar-section">
      <h3 className="sidebar-title">Tu personaje</h3>
      <button type="button" className="mine-name" onClick={onOpen}>
        {HUMOR_EMOJI[mine.humor] || ''} {mine.name} <span className="muted">· ver ficha y diario</span>
      </button>
      <p className="mine-now">
        {mineText(mine)}
      </p>
      {mine.stats && <StatsPentagon stats={mine.stats} size={180} />}
      <Bar label="Café" value={mine.cafe} />
      <button type="button" className="btn btn-ghost btn-sm mine-history" onClick={() => onHistory && onHistory(mine.id)}>📜 Mi historial</button>
      {usage && (
        <p className="mine-usage" title="Lo que lleva gastado hoy tu suscripción en esta oficina">
          IA hoy: {usage.calls} llamadas · {Number(usage.spent).toFixed(3)} $ de {usage.cap} $
          {isAdmin ? ' (incluye a los C-suite ficticios)' : ''}
        </p>
      )}
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
      <h3 className="sidebar-title">🌙 El sueño de esta noche</h3>
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
            <button className="btn btn-ghost btn-sm" onClick={askHelp} disabled={busy}>Ayúdame ✨</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={busy || !text.trim() || text === saved}>
              {saved && text === saved ? 'Guardado ✓' : 'Guardar'}
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
      <h3 className="sidebar-title">📻 Todo lo que pasa</h3>
      <label className="feed-toggle">
        <input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} />
        {' '}Solo lo que sabe mi personaje
      </label>
      <p className="muted feed-hint">{onlyMine ? 'Lo que ha visto, oído o le han contado. El resto no lo sabe… todavía.' : 'Tú te enteras de todo; tu personaje, solo de lo que pasa cerca de él.'}</p>
      {items.length === 0 && <p className="muted">{onlyMine ? 'Tu personaje no se ha enterado de nada. Bendita ignorancia.' : 'Silencio en la oficina… de momento.'}</p>}
      <ul className="feed-list">
        {items.map(f => (
          <li key={f.id} className={`feed-item feed-${f.kind}`}>
            <span className="feed-time">{new Date(f.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
            {f.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
