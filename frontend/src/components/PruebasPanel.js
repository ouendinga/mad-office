import React, { useCallback, useEffect, useState } from 'react';
import { capi } from '../api';
import Transformacion from './Transformacion';
import Contratacion from './Contratacion';

// Modo pruebas (solo el dueño): mover el reloj de esta empresa y crear jugadores de prueba para
// probar sin esperar a que sea laborable. Nada de esto afecta a las demás empresas.
const WD = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const JUMPS = [
  { hhmm: '08:35', label: '🚶 Camino del trabajo' },
  { hhmm: '09:30', label: '☕ Empieza el día' },
  { hhmm: '11:30', label: '💻 Media mañana' },
  { hhmm: '14:05', label: '🍽️ Comida' },
  { hhmm: '16:30', label: '📞 Tarde' },
  { hhmm: '18:05', label: '🚶 Vuelta a casa' },
  { hhmm: '22:00', label: '🌙 Noche (sueños)' },
];
const SPEEDS = [1, 2, 5, 10, 30, 60];

// Repetición de las escenas con TU avatar y TUS respuestas, sin IA ni despertador: la
// transformación «termina» sola a los 7 s y luego viene la de ¡Contratado!.
function Escenas({ me, company, positions, start, onClose }) {
  const [scene, setScene] = useState(start);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (scene !== 'transfo') return undefined;
    setDone(false);
    const id = setTimeout(() => setDone(true), 7000);
    return () => clearTimeout(id);
  }, [scene]);
  const c = me.character || {};
  const name = c.name || me.user.name;
  const pos = positions.find(p => p.id === c.position_id);
  return (
    <div className="pruebas-escena">
      <button type="button" className="modal-close" aria-label="Cerrar" onClick={onClose}>&times;</button>
      {scene === 'transfo' ? (
        <div className="onb"><div className="onb-card transfo-card">
          <Transformacion avatar={me.user.avatar_config} answers={c.interview || {}} name={name}
            done={done} onFinish={() => setScene('contrato')} />
        </div></div>
      ) : (
        <Contratacion avatar={me.user.avatar_config} name={name} company={company ? company.name : 'la empresa'}
          position={(pos && pos.title) || (c.ficha && c.ficha.puesto) || 'fichaje estrella'} onDone={onClose} />
      )}
    </div>
  );
}

export default function PruebasPanel({ company, onClose, onBecome }) {
  const [me, setMe] = useState(null);
  const [escena, setEscena] = useState(null);
  const [st, setSt] = useState(null);
  const [positions, setPositions] = useState([]);
  const [name, setName] = useState('');
  const [pos, setPos] = useState('');
  const [ia, setIa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    capi('/pruebas').then(setSt).catch(e => setErr(e.message));
    capi('/org').then(d => setPositions(d.positions)).catch(() => {});
    capi('/me').then(setMe).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const call = async (path, opts) => {
    setBusy(true);
    setErr('');
    try {
      setSt(await capi(path, opts));
      return true;
    } catch (e) {
      setErr(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const reloj = body => call('/pruebas/reloj', { method: 'PUT', body });

  const create = async e => {
    e.preventDefault();
    const ok = await call('/pruebas/jugadores', { method: 'POST', body: { name, position_id: pos ? Number(pos) : null, ia } });
    if (ok) { setName(''); load(); }
  };

  const become = async p => {
    setBusy(true);
    try {
      const r = await capi(`/pruebas/jugadores/${p.id}/entrar`, { method: 'POST' });
      onBecome(r.token, p.name);
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  if (escena && me) return <Escenas me={me} company={company} positions={positions} start={escena} onClose={() => setEscena(null)} />;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal pruebas">
        <button type="button" className="modal-close" aria-label="Cerrar" onClick={onClose}>&times;</button>
        <h2 className="modal-title">🧪 Modo pruebas</h2>
        <p className="pruebas-help">Solo lo ves tú. El reloj que muevas aquí es el de <strong>esta empresa</strong>; las demás siguen con la hora real.</p>
        {err && <div className="modal-error">{err}</div>}
        {!st ? <p>Cargando…</p> : (
          <>
            <label className="pruebas-switch">
              <input type="checkbox" role="switch" checked={st.active} disabled={busy}
                onChange={e => call('/pruebas/modo', { method: 'PUT', body: { on: e.target.checked } })} />
              <span><strong>Modo pruebas {st.active ? 'activado' : 'desactivado'}</strong>
                <small>{st.active
                  ? 'Al desactivarlo, la oficina vuelve al día y la hora reales y los jugadores de prueba se van a casa (no se borran).'
                  : 'La oficina va con la hora real y sin jugadores de prueba. Actívalo para mover el reloj o traerlos de vuelta.'}</small>
              </span>
            </label>
            <section className="pruebas-sec">
              <h3>🕐 Reloj</h3>
              <p className="pruebas-now">
                Ahora: <strong>{WD[st.now.weekday]} {st.now.hhmm}</strong>
                {st.moved ? <> · movido{st.speed > 1 ? `, ×${st.speed}` : ''}</> : ' · hora real'}
              </p>
              <div className="pruebas-grid">
                {JUMPS.map(j => (
                  <button key={j.hhmm} type="button" className="btn btn-ghost btn-sm" disabled={busy}
                    onClick={() => reloj({ hhmm: j.hhmm, day: 'laborable' })}>{j.label} <small>{j.hhmm}</small></button>
                ))}
              </div>
              <div className="pruebas-row">
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => reloj({ plus: 60 })}>+1 h</button>
                <label>Velocidad{' '}
                  <select value={st.speed} disabled={busy} onChange={e => reloj({ speed: Number(e.target.value) })}>
                    {SPEEDS.map(s => <option key={s} value={s}>×{s}</option>)}
                  </select>
                </label>
                {st.moved && <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => reloj({ reset: true })}>Volver a la hora real</button>}
              </div>
              <p className="pruebas-help">Los saltos van al día laborable más cercano (si hoy es sábado, al lunes).</p>
            </section>

            <section className="pruebas-sec">
              <h3>🎬 Escenas</h3>
              <p className="pruebas-help">Repite las escenas con tu avatar y tus respuestas de la entrevista. No gasta IA ni necesita el despertador.</p>
              <div className="pruebas-row">
                <button type="button" className="btn btn-ghost btn-sm" disabled={!me} onClick={() => setEscena('transfo')}>✨ Transformación</button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={!me} onClick={() => setEscena('contrato')}>📨 ¡Contratado!</button>
              </div>
              {me && !(me.character && me.character.interview && Object.keys(me.character.interview).length) &&
                <p className="pruebas-help">Aún no hay respuestas tuyas guardadas: saldrán estrellas y corazones genéricos.</p>}
            </section>

            <section className="pruebas-sec">
              <h3>👥 Jugadores de prueba</h3>
              {st.players.length === 0 && <p className="pruebas-help">Aún no hay. Crea alguno para ver la oficina con más gente de verdad.</p>}
              <ul className="pruebas-players">
                {st.players.map(p => (
                  <li key={p.id}>
                    <span className="pruebas-pname">{p.name}<small>{p.position || 'sin cargo'}</small></span>
                    <label title="Con IA gasta de tu suscripción (≈0,025 $/día)">
                      <input type="checkbox" checked={!p.sin_ia} disabled={busy}
                        onChange={e => call(`/pruebas/jugadores/${p.id}`, { method: 'PUT', body: { ia: e.target.checked } })} /> IA
                    </label>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => become(p)}>Entrar como</button>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={busy} aria-label={`Borrar a ${p.name}`}
                      onClick={() => window.confirm(`¿Borrar a ${p.name} y todo lo suyo?`) && call(`/pruebas/jugadores/${p.id}`, { method: 'DELETE' })}>🗑️</button>
                  </li>
                ))}
              </ul>
              <form className="pruebas-new" onSubmit={create}>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre (o al azar)" maxLength={40} aria-label="Nombre" />
                <select value={pos} onChange={e => setPos(e.target.value)} aria-label="Cargo">
                  <option value="">Cargo al azar</option>
                  {positions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                <label title="Con IA gasta de tu suscripción"><input type="checkbox" checked={ia} onChange={e => setIa(e.target.checked)} /> Con IA</label>
                <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Crear</button>
              </form>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
