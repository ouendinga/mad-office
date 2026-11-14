import React, { useCallback, useEffect, useState } from 'react';
import { capi } from '../api';

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

export default function PruebasPanel({ onClose, onBecome }) {
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

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal pruebas">
        <button type="button" className="modal-close" aria-label="Cerrar" onClick={onClose}>&times;</button>
        <h2 className="modal-title">🧪 Modo pruebas</h2>
        <p className="pruebas-help">Solo lo ves tú. El reloj que muevas aquí es el de <strong>esta empresa</strong>; las demás siguen con la hora real.</p>
        {err && <div className="modal-error">{err}</div>}
        {!st ? <p>Cargando…</p> : (
          <>
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
