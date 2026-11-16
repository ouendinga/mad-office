import React, { useEffect, useRef, useState } from 'react';
import { Building2, Truck, X, FlaskConical } from 'lucide-react';
import { capi } from '../api';
import { drawPlanPreview } from '../canvas/planPreview';
import '../styles/companies.css';

// Galería de oficinas: la vuestra y las que hay para mudarse. Cambiar de oficina es una mudanza (un
// día: la tarde de antes se empaqueta y esa mañana van por la calle con cajas y un camión).
function Preview({ plan }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) drawPlanPreview(ref.current, plan); }, [plan]);
  return <canvas ref={ref} width={640} height={400} className="ofi-preview" aria-label={`Plano de ${plan.name}`} />;
}

const nextWorkday = () => {
  const d = new Date();
  do d.setDate(d.getDate() + 1); while (d.getDay() === 0 || d.getDay() === 6);
  return d.toISOString().slice(0, 10);
};
const fmt = day => new Date(`${day}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

export default function Offices({ company, owner, onBack }) {
  const isAdmin = company.role === 'admin';
  const [data, setData] = useState(null);
  const [pick, setPick] = useState(null); // id de la oficina a la que mudarse
  const [day, setDay] = useState(nextWorkday());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = () => capi('/oficinas').then(setData).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);

  const run = async (fn, ok) => {
    setBusy(true); setError(''); setMsg('');
    try { await fn(); setMsg(ok); setPick(null); await load(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const current = data && data.templates.find(t => t.id === data.current);
  const nameOf = id => (data && (data.templates.find(t => t.id === id) || {}).name) || id;

  return (
    <div className="cos">
      <header className="cos-head">
        <span className="pixel-font cos-logo">{company.name}</span>
        <span className="cos-spacer" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>← Oficina</button>
      </header>
      <main className="cos-main">
        <h1 className="cos-title"><Building2 size={22} aria-hidden /> Oficinas</h1>
        <p className="muted">
          Cada oficina tiene sus salas, sus muebles y su aforo. Cambiar es una <strong>mudanza</strong>: la tarde de antes se
          empaqueta y esa mañana van todos por la calle con sus cajas, con un camión y lo que les pase por el camino.
          {current ? ` Si en la nueva no hay mesa para todos, los que no quepan teletrabajan.` : ''}
        </p>
        {error && <div className="modal-error">{error}</div>}
        {msg && <p className="set-msg" role="status">{msg}</p>}
        {data && data.mudanza && (
          <div className="org-requests ofi-move">
            <Truck size={18} aria-hidden /> Mudanza a <strong>{nameOf(data.mudanza.to)}</strong> el {fmt(data.mudanza.day)}.
            {isAdmin && (
              <button type="button" className="btn btn-danger btn-sm" disabled={busy}
                onClick={() => run(() => capi('/mudanza', { method: 'DELETE' }), 'Mudanza anulada. Os quedáis donde estáis.')}><X size={15} aria-hidden /> Anularla</button>
            )}
          </div>
        )}
        {!data && !error && <p className="muted">Cargando planos…</p>}
        <ul className="ofi-grid">
          {data && data.templates.map(t => (
            <li key={t.id} className={`ofi-card ${t.id === data.current ? 'is-current' : ''}`}>
              <Preview plan={t.plan} />
              <div className="ofi-body">
                <h2>{t.name} {t.id === data.current && <span className="ofi-badge">Vuestra oficina</span>}</h2>
                <p className="ofi-meta">{t.desks} mesas · {t.rooms.filter(r => !/open space|loft|cubículos/i.test(r)).join(', ')}</p>
                <p className="muted">{t.description}</p>
                {isAdmin && t.id !== data.current && (pick === t.id ? (
                  <div className="ofi-pick">
                    <label>¿Qué día?<input type="date" value={day} min={nextWorkday()} onChange={e => setDay(e.target.value)} /></label>
                    <button type="button" className="btn btn-primary btn-sm" disabled={busy}
                      onClick={() => run(() => capi('/mudanza', { method: 'POST', body: { to: t.id, day } }), `Mudanza a ${t.name} el ${fmt(day)}. La tarde de antes, a empaquetar.`)}>
                      <Truck size={15} aria-hidden /> Programar la mudanza
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPick(null)}>Cancelar</button>
                  </div>
                ) : (
                  <div className="ofi-pick">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPick(t.id)}><Truck size={15} aria-hidden /> Mudarnos aquí</button>
                    {owner && (
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} title="Modo pruebas: mueve el reloj a la mañana de la mudanza"
                        onClick={() => run(() => capi('/pruebas/mudanza', { method: 'POST', body: { to: t.id } }), 'Reloj a la mañana de la mudanza: mira la calle.').then(onBack)}>
                        <FlaskConical size={15} aria-hidden /> Verla ya (pruebas)
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
