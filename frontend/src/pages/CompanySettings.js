import React, { useCallback, useEffect, useState } from 'react';
import { capi } from '../api';
import '../styles/companies.css';

// «Empresa»: cómo es la empresa (no el edificio). Solo el admin edita; los demás lo ven.
const DAYS = [[1, 'L'], [2, 'M'], [3, 'X'], [4, 'J'], [5, 'V']];
const LEVELS = [
  [0, '😌 Tranquila'], [1, '🙂 Normal'], [2, '😰 Alta'], [3, '🔥 A tope'],
];

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Días laborables de la semana en curso y las 4 siguientes.
function weekdays() {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const out = [];
  for (let w = 0; w < 5; w++) {
    for (let d = 0; d < 5; d++) {
      const x = new Date(monday);
      x.setDate(monday.getDate() + w * 7 + d);
      out.push(x);
    }
  }
  return out;
}

const PLACE_NAME = { terraza: 'Terraza', descanso: 'Zona chill', reuniones: 'Sala de reuniones', cafe: 'Cocina' };

export default function CompanySettings({ company, onChanged, onBack }) {
  const isAdmin = company.role === 'admin';
  const [info, setInfo] = useState(null);
  const [hours, setHours] = useState(null);
  const [load_, setLoad] = useState([]); // carga de trabajo
  const [dayEdit, setDayEdit] = useState(null); // { day, level, note }
  const [invites, setInvites] = useState([]);
  const [invDays, setInvDays] = useState(7);
  const [invUses, setInvUses] = useState(10);
  const [joins, setJoins] = useState([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(null);
  const [eventos, setEventos] = useState(null); // { kinds, places, events }
  const [evForm, setEvForm] = useState({ kind: 'afterwork', title: 'Afterwork', place: 'terraza', day: new Date().toISOString().slice(0, 10), from: '17:00', to: '18:30' });

  const reload = useCallback(async () => {
    try {
      setInfo(await capi('/'));
      setHours(await capi('/settings/hours'));
      setLoad(await capi('/workload'));
      setEventos(await capi('/eventos'));
      if (isAdmin) {
        setInvites(await capi('/invitations'));
        setJoins(await capi('/join-requests'));
      }
    } catch (e) {
      setError(e.message);
    }
  }, [isAdmin]);
  useEffect(() => { reload(); }, [reload]);

  const run = async (fn, okMsg) => {
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await fn();
      if (okMsg) setMsg(okMsg);
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveGeneral = e => {
    e.preventDefault();
    run(async () => {
      await capi('/', { method: 'PUT', body: { name: info.name, visibility: info.visibility, settings: info.settings } });
      await onChanged();
    }, 'Guardado ✓');
  };

  const saveHours = e => {
    e.preventDefault();
    run(() => capi('/settings/hours', { method: 'PUT', body: hours }), 'Horario guardado ✓');
  };

  const saveDay = e => {
    e.preventDefault();
    run(async () => {
      await capi(`/workload/${dayEdit.day}`, { method: 'PUT', body: { level: Number(dayEdit.level), note: dayEdit.note } });
      setDayEdit(null);
    });
  };

  const clearDay = () => run(async () => {
    await capi(`/workload/${dayEdit.day}`, { method: 'DELETE' });
    setDayEdit(null);
  });

  const link = code => `${window.location.origin}/invitacion/${code}`;
  const copy = async code => {
    try {
      await navigator.clipboard.writeText(link(code));
      setCopied(code);
    } catch {
      setCopied(null); // sin portapapeles: el enlace está a la vista para copiarlo a mano
    }
  };

  if (!info) {
    return <div className="loading">{error || 'Abriendo los papeles de la empresa…'}</div>;
  }
  const set = info.settings;
  const today = iso(new Date());
  const byDay = Object.fromEntries(load_.map(w => [String(w.day).slice(0, 10), w]));
  const days = weekdays();

  return (
    <div className="cos">
      <header className="cos-head">
        <span className="pixel-font cos-logo">{info.name}</span>
        <span className="cos-spacer" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>← Oficina</button>
      </header>
      <main className="cos-main">
        <h1 className="cos-title">🏢 La empresa</h1>
        {!isAdmin && <p className="muted">Esto lo decide quien lleva la empresa. Tú puedes mirarlo.</p>}
        {msg && <div className="cos-notice" role="status">{msg}</div>}
        {error && <div className="modal-error">{error}</div>}

        <form className="set-section" onSubmit={saveGeneral}>
          <h2>General</h2>
          <div className="set-row">
            <label>Nombre<input type="text" maxLength={60} value={info.name} disabled={!isAdmin} onChange={e => setInfo({ ...info, name: e.target.value })} /></label>
            <label>Quién la ve
              <select value={info.visibility} disabled={!isAdmin} onChange={e => setInfo({ ...info, visibility: e.target.value })}>
                <option value="privada">🔒 Privada: solo con invitación</option>
                <option value="publica">🌍 Pública: se puede pedir entrar</option>
              </select>
            </label>
          </div>
          <label className="org-check">
            <input type="checkbox" checked={set.jobBoard} disabled={!isAdmin} onChange={e => setInfo({ ...info, settings: { ...set, jobBoard: e.target.checked } })} />
            {' '}📰 Publicar las vacantes en «Se busca personal» (solo si es pública; la IA escribe cada oferta una vez)
          </label>
          <h2 style={{ marginTop: '1rem' }}>🏠 Teletrabajo</h2>
          <div className="set-row">
            <label>Días de casa por semana
              <select value={set.remotePerWeek} disabled={!isAdmin} onChange={e => setInfo({ ...info, settings: { ...set, remotePerWeek: Number(e.target.value) } })}>
                {[0, 1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n === 0 ? 'Nunca (todo presencial)' : n}</option>)}
              </select>
            </label>
            <div>
              <div className="muted" style={{ fontSize: '0.82rem' }}>Días que toca oficina sí o sí</div>
              <div className="set-days">
                {DAYS.map(([n, l]) => (
                  <button key={n} type="button" disabled={!isAdmin} aria-pressed={set.officeDays.includes(n)}
                    className={`onb-chip ${set.officeDays.includes(n) ? 'is-on' : ''}`}
                    onClick={() => setInfo({ ...info, settings: { ...set, officeDays: set.officeDays.includes(n) ? set.officeDays.filter(x => x !== n) : [...set.officeDays, n] } })}>{l}</button>
                ))}
              </div>
            </div>
          </div>
          {isAdmin && <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Guardar</button>}
        </form>

        {hours && (
          <form className="set-section" onSubmit={saveHours}>
            <h2>🕘 Horario</h2>
            <div className="set-row">
              <label>Entrada<input type="time" value={hours.start} disabled={!isAdmin} onChange={e => setHours({ ...hours, start: e.target.value })} /></label>
              <label>Salida<input type="time" value={hours.end} disabled={!isAdmin} onChange={e => setHours({ ...hours, end: e.target.value })} /></label>
              <label>Comida<input type="time" value={hours.lunch} disabled={!isAdmin} onChange={e => setHours({ ...hours, lunch: e.target.value })} /></label>
              <label>Minutos para comer<input type="number" min={15} max={120} step={5} value={hours.lunchMin} disabled={!isAdmin} onChange={e => setHours({ ...hours, lunchMin: e.target.value })} /></label>
            </div>
            <p className="muted">Vienen media hora antes de entrar y se van al salir. Las horas extra solo pasan con carga alta o a tope.</p>
            {isAdmin && <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Guardar horario</button>}
          </form>
        )}

        <section className="set-section">
          <h2>📈 Carga de trabajo</h2>
          <p className="muted">{isAdmin ? 'Toca un día para marcar cómo viene. Con carga alta o a tope, alguno se quedará haciendo horas extra.' : 'Cómo viene el trabajo estas semanas.'}</p>
          <div className="cal" role="grid" aria-label="Carga de trabajo por día">
            {DAYS.map(([n, l]) => <div key={n} className="cal-head">{l}</div>)}
            {days.map(d => {
              const k = iso(d);
              const w = byDay[k];
              const lvl = w ? w.level : 1;
              return (
                <button key={k} type="button" className={`cal-day lvl-${lvl} ${k === today ? 'is-today' : ''}`} disabled={!isAdmin || k < today}
                  onClick={() => setDayEdit({ day: k, level: lvl, note: (w && w.note) || '' })}
                  aria-label={`${d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}: ${LEVELS[lvl][1]}${w && w.note ? `, ${w.note}` : ''}`}>
                  <span className="cal-num">{d.getDate()}</span> {w ? LEVELS[lvl][1].split(' ')[0] : ''}
                  {w && w.note && <span className="cal-note">{w.note}</span>}
                </button>
              );
            })}
          </div>
          {dayEdit && (
            <form className="org-form" onSubmit={saveDay}>
              <label>{new Date(`${dayEdit.day}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                <select value={dayEdit.level} onChange={e => setDayEdit({ ...dayEdit, level: e.target.value })}>
                  {LEVELS.map(([n, l]) => <option key={n} value={n}>{l}</option>)}
                </select>
              </label>
              <label>Nota (opcional)<input maxLength={140} value={dayEdit.note} placeholder="Entrega al cliente X" onChange={e => setDayEdit({ ...dayEdit, note: e.target.value })} /></label>
              <div className="org-actions">
                <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Guardar</button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={clearDay}>Dejar normal</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDayEdit(null)}>Cancelar</button>
              </div>
            </form>
          )}
        </section>

        <section className="set-section">
          <h2>🎉 Eventos</h2>
          <p className="muted">
            Afterworks, talleres, team building… Los personajes se enteran y van (o no) según su carácter. Algunos los
            propone la oficina sola (el afterwork de los viernes, los cumpleaños); si no te gusta alguno, bórralo.
          </p>
          {eventos && eventos.events.length === 0 && <p className="muted">No hay ninguno a la vista.</p>}
          {eventos && (
            <ul className="cos-list">
              {eventos.events.map(e => (
                <li key={e.id} className="cos-card">
                  <div className="cos-card-main">
                    <strong>{(eventos.kinds.find(k => k.kind === e.kind) || {}).icon} {e.title}</strong>
                    <span className="muted">
                      {new Date(`${e.day}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} · {e.from}-{e.to} · {PLACE_NAME[e.place] || e.place}{e.auto ? ' · lo propuso la oficina' : ''}
                    </span>
                  </div>
                  {isAdmin && (
                    <button type="button" className="btn btn-danger btn-sm" disabled={busy}
                      onClick={() => run(() => capi(`/eventos/${e.id}`, { method: 'DELETE' }), 'Evento quitado.')}>Quitar</button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {isAdmin && eventos && (
            <form className="set-row ev-form" onSubmit={e => {
              e.preventDefault();
              run(() => capi('/eventos', { method: 'POST', body: evForm }), 'Evento creado: se enterarán todos.');
            }}>
              <label>Tipo
                <select value={evForm.kind} onChange={e => {
                  const k = eventos.kinds.find(x => x.kind === e.target.value);
                  setEvForm({ ...evForm, kind: e.target.value, title: k ? k.label : evForm.title });
                }}>
                  {eventos.kinds.map(k => <option key={k.kind} value={k.kind}>{k.icon} {k.label}</option>)}
                </select>
              </label>
              <label>Nombre<input value={evForm.title} maxLength={80} required onChange={e => setEvForm({ ...evForm, title: e.target.value })} /></label>
              <label>Dónde
                <select value={evForm.place} onChange={e => setEvForm({ ...evForm, place: e.target.value })}>
                  {eventos.places.map(pl => <option key={pl} value={pl}>{PLACE_NAME[pl] || pl}</option>)}
                </select>
              </label>
              <label>Día<input type="date" required value={evForm.day} onChange={e => setEvForm({ ...evForm, day: e.target.value })} /></label>
              <label>De<input type="time" required value={evForm.from} onChange={e => setEvForm({ ...evForm, from: e.target.value })} /></label>
              <label>A<input type="time" required value={evForm.to} onChange={e => setEvForm({ ...evForm, to: e.target.value })} /></label>
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Crear evento</button>
            </form>
          )}
        </section>

        {isAdmin && (
          <section className="set-section">
            <h2>✉️ Invitaciones</h2>
            <p className="muted">Crea un enlace y pásalo por WhatsApp o por correo. Quien lo abra entra directo en la empresa.</p>
            <div className="set-row">
              <label>Caduca en (días)<input type="number" min={1} max={30} value={invDays} onChange={e => setInvDays(e.target.value)} /></label>
              <label>Usos<input type="number" min={1} max={100} value={invUses} onChange={e => setInvUses(e.target.value)} /></label>
              <button type="button" className="btn btn-primary btn-sm" disabled={busy}
                onClick={() => run(() => capi('/invitations', { method: 'POST', body: { days: Number(invDays), max_uses: Number(invUses) } }), 'Enlace creado: cópialo y compártelo.')}>Crear enlace</button>
            </div>
            <ul className="cos-list">
              {invites.filter(i => !i.revoked).map(i => (
                <li key={i.id} className="cos-card">
                  <div className="cos-card-main">
                    <span className="inv-link">{link(i.code)}</span>
                    <span className="muted">{i.uses}/{i.max_uses} usos · caduca el {new Date(i.expires_at).toLocaleDateString('es-ES')}</span>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(i.code)}>{copied === i.code ? 'Copiado ✓' : 'Copiar'}</button>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy}
                    onClick={() => run(() => capi(`/invitations/${i.id}`, { method: 'DELETE' }), 'Enlace anulado.')}>Anular</button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {isAdmin && (
          <section className="set-section">
            <h2>🙋 Quieren entrar</h2>
            {joins.length === 0 && <p className="muted">Nadie llamando a la puerta.</p>}
            <ul className="cos-list">
              {joins.map(j => (
                <li key={j.id} className="cos-card">
                  <div className="cos-card-main">
                    <strong>{j.name}{j.position ? ` → ${j.position}` : ''}</strong>
                    {j.message && <span className="muted">«{j.message}»</span>}
                  </div>
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy}
                    onClick={() => run(() => capi(`/join-requests/${j.id}`, { method: 'POST', body: { accept: true } }), `${j.name} ya está dentro.`)}>Aceptar</button>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy}
                    onClick={() => run(() => capi(`/join-requests/${j.id}`, { method: 'POST', body: { accept: false } }), 'Rechazada.')}>Rechazar</button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
