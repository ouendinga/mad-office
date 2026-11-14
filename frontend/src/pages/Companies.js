import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import '../styles/companies.css';

// Inicio tras entrar: mis empresas, crear una, las públicas (pedir entrar) y el tablón de
// «Se busca personal» (ofertas de broma de las vacantes).
export default function Companies({ me, notice, onEnter, onChanged, onLogout, onBack }) {
  const [tab, setTab] = useState(me.companies.length ? 'mias' : 'crear');
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState('privada');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState(notice || '');
  const [publics, setPublics] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [applying, setApplying] = useState(null); // { company, position? }
  const [letter, setLetter] = useState('');

  const loadPublic = useCallback(() => {
    api('/public/companies').then(setPublics).catch(e => setError(e.message));
  }, []);
  const loadJobs = useCallback(() => {
    api('/jobs').then(setJobs).catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    if (tab === 'publicas') loadPublic();
    if (tab === 'empleo') loadJobs();
  }, [tab, loadPublic, loadJobs]);

  const create = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const c = await api('/companies', { method: 'POST', body: { name, visibility } });
      await onChanged();
      onEnter(c.id);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const apply = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/companies/${applying.company.id}/join`, {
        method: 'POST',
        body: { message: letter, ...(applying.position ? { position_id: applying.position.id } : {}) },
      });
      setMsg(`Petición enviada a ${applying.company.name}. Cuando te acepten, aparecerá en «Mis empresas».`);
      setApplying(null);
      setLetter('');
      if (tab === 'publicas') loadPublic();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const tabs = [
    ['mias', '🏢 Mis empresas'],
    ['empleo', '📰 Se busca personal'],
    ['publicas', '🌍 Empresas públicas'],
    ['crear', '➕ Crear empresa'],
  ];

  return (
    <div className="cos">
      <header className="cos-head">
        <span className="pixel-font cos-logo">Mad Office</span>
        <span className="cos-user">Hola, {me.user.name}</span>
        <span className="cos-spacer" />
        {onBack && <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>← Volver a la oficina</button>}
        <button type="button" className="btn btn-ghost btn-sm" onClick={onLogout}>Salir</button>
      </header>

      <main className="cos-main">
        <nav className="cos-tabs" role="tablist" aria-label="Empresas">
          {tabs.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k}
              className={`onb-chip ${tab === k ? 'is-on' : ''}`} onClick={() => { setTab(k); setError(''); }}>{label}</button>
          ))}
        </nav>
        {msg && <div className="cos-notice" role="status">{msg}</div>}
        {error && <div className="modal-error">{error}</div>}

        {tab === 'mias' && (
          <section>
            {me.companies.length === 0 && (
              <p className="muted">Aún no estás en ninguna. Crea la tuya, pide entrar a una pública o usa el enlace de invitación que te pasen.</p>
            )}
            <ul className="cos-list">
              {me.companies.map(c => (
                <li key={c.id} className="cos-card">
                  <div className="cos-card-main">
                    <strong>{c.name}</strong>
                    <span className="muted">
                      {c.role === 'admin' ? '👑 La llevas tú' : 'Miembro'} · {c.visibility === 'publica' ? 'pública' : 'privada'}
                      {c.position_title ? ` · ${c.position_title}` : ' · aún sin cargo'}
                    </span>
                  </div>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => onEnter(c.id)}>Entrar</button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === 'crear' && (
          <form className="cos-form" onSubmit={create}>
            <p className="muted">Tu oficina, tus reglas. Viene con un organigrama de serie lleno de compañeros ficticios con mucha personalidad: los vais sustituyendo a medida que entráis.</p>
            <div className="onb-q">
              <label htmlFor="co-name">Nombre de la empresa</label>
              <input id="co-name" maxLength={60} value={name} onChange={e => setName(e.target.value)} placeholder="Walmeric, Los del pádel, Cuñados S.A.…" />
            </div>
            <fieldset className="cos-radio">
              <legend>¿Quién la puede ver?</legend>
              <label><input type="radio" name="vis" checked={visibility === 'privada'} onChange={() => setVisibility('privada')} /> 🔒 Privada: solo se entra con invitación</label>
              <label><input type="radio" name="vis" checked={visibility === 'publica'} onChange={() => setVisibility('publica')} /> 🌍 Pública: cualquiera puede pedir entrar</label>
            </fieldset>
            <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>{busy ? 'Montando la oficina…' : 'Crear empresa'}</button>
          </form>
        )}

        {tab === 'publicas' && (
          <section>
            {!publics && <p className="muted">Buscando empresas…</p>}
            {publics && publics.length === 0 && <p className="muted">Ninguna empresa pública todavía. ¡Sé la primera!</p>}
            <ul className="cos-list">
              {(publics || []).map(c => (
                <li key={c.id} className="cos-card">
                  <div className="cos-card-main">
                    <strong>{c.name}</strong>
                    <span className="muted">{c.members} {c.members === 1 ? 'persona' : 'personas'}{c.job_board ? ' · 📰 busca personal' : ''}</span>
                  </div>
                  {c.mine ? <span className="muted">Ya estás dentro</span>
                    : c.pending ? <span className="muted">Petición enviada ⏳</span>
                      : <button type="button" className="btn btn-ghost btn-sm" onClick={() => setApplying({ company: c })}>Pedir entrar</button>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === 'empleo' && (
          <section>
            <p className="muted">Ofertas 100 % reales de puestos 100 % inventados. Postúlate y, si el admin te acepta, sustituyes al ficticio que lo ocupa.</p>
            {!jobs && <p className="muted">Leyendo el periódico…</p>}
            {jobs && jobs.length === 0 && <p className="muted">Nadie busca personal ahora mismo. Vuelve después del café.</p>}
            <div className="job-grid">
              {(jobs || []).map(j => (
                <article key={`${j.company.id}-${j.position.id}`} className="job-card">
                  <div className="job-company">{j.company.name}</div>
                  <h3 className="job-title">{j.ad.titulo}</h3>
                  <div className="job-position">{j.position.csuite ? '⭐ ' : ''}{j.position.title}</div>
                  <p className="job-text">{j.ad.texto}</p>
                  {j.ad.requisitos && j.ad.requisitos.length > 0 && (
                    <ul className="job-reqs">{j.ad.requisitos.map(r => <li key={r}>{r}</li>)}</ul>
                  )}
                  {me.companies.some(c => c.id === j.company.id)
                    ? <span className="muted">Ya trabajas aquí</span>
                    : <button type="button" className="btn btn-primary btn-sm" onClick={() => setApplying({ company: j.company, position: j.position })}>Postularme</button>}
                </article>
              ))}
            </div>
          </section>
        )}
      </main>

      {applying && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setApplying(null); }}>
          <form className="modal" onSubmit={apply}>
            <button type="button" className="modal-close" onClick={() => setApplying(null)} aria-label="Cerrar">&times;</button>
            <h2 className="modal-title">{applying.position ? `Postularme a ${applying.position.title}` : `Pedir entrar en ${applying.company.name}`}</h2>
            <div className="onb-q">
              <label htmlFor="letter">Carta de presentación (opcional, con gracia)</label>
              <textarea id="letter" rows={3} maxLength={280} value={letter} onChange={e => setLetter(e.target.value)}
                placeholder="Tengo 15 años de experiencia en reiniciar routers y sé dónde está la cafetera." />
            </div>
            {error && <div className="modal-error">{error}</div>}
            <button type="submit" className="btn btn-primary btn-full" disabled={busy}>{busy ? 'Enviando…' : 'Enviar petición'}</button>
          </form>
        </div>
      )}
    </div>
  );
}
