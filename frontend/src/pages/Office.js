import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { renderOffice, pickAt } from '../canvas/officeRenderer';
import { api, getToken, waitTurn, WS_URL, HUMOR_EMOJI } from '../api';
import '../styles/office.css';

const WEEKDAYS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const PLACE_TEXT = { mesa: 'en su mesa', cafe: 'en el café', reuniones: 'en reunión', lavabo: 'en el lavabo', visita: 'de visita' };

function fmtMorning(date) {
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function Office({ me, onLogout, onEditAvatar }) {
  const canvasRef = useRef(null);
  const worldRef = useRef(null);
  const frameRef = useRef(0);
  const [world, setWorld] = useState(null);
  const [feed, setFeed] = useState([]);
  const [offline, setOffline] = useState(false);
  const [selected, setSelected] = useState(null); // ficha abierta
  const selectedIdRef = useRef(null);

  // Directo por socket.
  useEffect(() => {
    api('/feed').then(setFeed).catch(() => {});
    const socket = io(WS_URL || window.location.origin, { auth: { token: getToken() }, transports: ['websocket', 'polling'] });
    socket.on('connect', () => setOffline(false));
    socket.on('disconnect', () => setOffline(true));
    socket.on('connect_error', () => setOffline(true));
    socket.on('world', w => { worldRef.current = w; setWorld(w); });
    socket.on('feed', item => setFeed(prev => [...prev, item].slice(-80)));
    return () => socket.disconnect();
  }, []);

  // Bucle de dibujo.
  useEffect(() => {
    let raf;
    const loop = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        frameRef.current++;
        renderOffice(canvas.getContext('2d'), canvas, worldRef.current, Math.floor(frameRef.current / 8), selectedIdRef.current);
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
    selectedIdRef.current = id;
    try {
      setSelected(await api(`/characters/${id}`));
    } catch {
      setSelected(null);
    }
  }, []);

  const onCanvasClick = e => {
    const rect = canvasRef.current.getBoundingClientRect();
    const hit = pickAt(worldRef.current, e.clientX - rect.left, e.clientY - rect.top);
    if (hit) openCharacter(hit.id);
  };

  const mine = world && world.characters.find(c => c.owner_user_id === me.user.id);
  const clock = world && world.clock;

  return (
    <div className="office-page">
      <header className="office-header">
        <div className="office-header-left">
          <span className="office-logo pixel-font">Mad Office</span>
          {clock && (
            <span className="office-clock" title={clock.date}>
              {WEEKDAYS[clock.weekday]} {clock.hhmm}
            </span>
          )}
          {offline && <span className="office-offline">sin conexión…</span>}
        </div>
        <div className="office-header-right">
          <span className="office-user-name">{me.user.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={onEditAvatar}>Avatar</button>
          <button className="btn btn-ghost btn-sm" onClick={onLogout}>Salir</button>
        </div>
      </header>

      <div className="office-layout">
        <div className="office-canvas-container">
          <canvas ref={canvasRef} className="office-canvas" onClick={onCanvasClick} />
        </div>

        <aside className="office-sidebar">
          <MyCharacter mine={mine} me={me} onOpen={() => mine && openCharacter(mine.id)} />
          <DreamPanel clock={clock} />
          <Feed feed={feed} />
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
    </div>
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

function MyCharacter({ mine, me, onOpen }) {
  const [usage, setUsage] = useState(null);
  useEffect(() => {
    const load = () => api('/me/usage').then(setUsage).catch(() => {});
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
        {mine.home ? 'En casa, durmiendo.' : `${mine.que} (${PLACE_TEXT[mine.lugar] || mine.lugar})`}
      </p>
      <Bar label="Energía" value={mine.energia} />
      <Bar label="Café" value={mine.cafe} />
      {usage && (
        <p className="mine-usage" title="Lo que lleva gastado hoy tu suscripción en esta oficina">
          IA hoy: {usage.calls} llamadas · {Number(usage.spent).toFixed(3)} $ de {usage.cap} $
          {me.user.is_admin ? ' (incluye a los compañeros ficticios)' : ''}
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

  const load = useCallback(() => api('/me/dream').then(s => {
    setState(s);
    setText(s.text || '');
    setSaved(s.text || '');
  }).catch(() => {}), []);

  useEffect(() => { load(); }, [load, open]);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await api('/me/dream', { method: 'PUT', body: { text } });
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
      const r = await api('/me/dream/help', { method: 'POST', body: { draft: text } });
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
        <p className="muted">Ahora está despierto. A las 18:00 se abre la ventana de los sueños.</p>
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

function Feed({ feed }) {
  const items = [...feed].reverse();
  return (
    <section className="sidebar-section feed">
      <h3 className="sidebar-title">📻 Radio pasillo</h3>
      {items.length === 0 && <p className="muted">Silencio en la oficina… de momento.</p>}
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
