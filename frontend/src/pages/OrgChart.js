import React, { useCallback, useEffect, useRef, useState } from 'react';
import { capi } from '../api';
import { characterSprite } from '../engine/Character';
import { Pencil, Plus, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import '../styles/companies.css';

const PLACE = { mesa: 'mesa', despacho: 'despacho', recepcion: 'recepción' };

function Mini({ config }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 32, 32);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(characterSprite(config || {}), 0, 0);
  }, [config]);
  return <canvas ref={ref} width={32} height={32} aria-hidden="true" />;
}

// Organigrama de la empresa. mode 'choose': primera vez, elegir cargo para entrar. 'manage': ver y
// cambiar el propio cargo, pedir uno ocupado, responder peticiones y (admin) editar los cargos.
export default function OrgChart({ company, mode, onDone, onBack }) {
  const [data, setData] = useState(null);
  const [reqs, setReqs] = useState({ incoming: [], outgoing: [] });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(null); // { position, holder } tras un 409
  const panelRef = useRef(null);
  const scrollRef = useRef(null);
  const [editing, setEditing] = useState(null); // { id?, parent_id, ... }
  const [confirmDel, setConfirmDel] = useState(null);
  const isAdmin = company.role === 'admin';

  const load = useCallback(async () => {
    try {
      setData(await capi('/org'));
      setReqs(await capi('/org/requests'));
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const [confirmTake, setConfirmTake] = useState(null);
  const take = async p => {
    setBusy(true);
    setError('');
    setMsg('');
    setAsk(null);
    try {
      await capi('/me/position', { method: 'POST', body: { position_id: p.id } });
      if (mode === 'choose') return onDone();
      setMsg(`Ahora eres ${p.title}.`);
      await load();
      onDone();
    } catch (e) {
      if (e.code === 'ocupado') setAsk({ position: p, holderName: (p.holders.find(h => h.human) || {}).name });
      else setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const askFor = async () => {
    setBusy(true);
    setError('');
    try {
      await capi('/org/requests', { method: 'POST', body: { position_id: ask.position.id } });
      setMsg(`Petición enviada. Si ${ask.holderName || 'quien lo tiene'} acepta, os intercambiáis los cargos.`);
      setAsk(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const answer = async (id, accept) => {
    setBusy(true);
    setError('');
    try {
      const r = await capi(`/org/requests/${id}`, { method: 'POST', body: { accept } });
      setMsg(r.status === 'aceptada' ? 'Hecho: os habéis intercambiado los cargos.' : 'Petición rechazada.');
      await load();
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const savePosition = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = {
      title: editing.title, parent_id: editing.parent_id === '' ? null : editing.parent_id,
      csuite: !!editing.csuite, is_unique: !!editing.is_unique, seats: Number(editing.seats), place: editing.place,
    };
    try {
      if (editing.id) await capi(`/org/positions/${editing.id}`, { method: 'PUT', body });
      else await capi('/org/positions', { method: 'POST', body });
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async p => {
    if (confirmDel !== p.id) return setConfirmDel(p.id);
    setBusy(true);
    setError('');
    try {
      await capi(`/org/positions/${p.id}`, { method: 'DELETE' });
      setConfirmDel(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Al abrir un panel (pedir, editar), que se vea; al cargar, el árbol centrado en mi cargo (o en la raíz).
  useEffect(() => {
    if ((ask || editing) && panelRef.current) panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [ask, editing]);
  // En escritorio, el árbol se encoge para verse entero (botón para verlo a tamaño real). En móvil
  // pasa a lista sangrada por CSS y no se escala.
  const treeRef = useRef(null);
  const [fit, setFit] = useState(true);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const measure = () => {
      const box = scrollRef.current;
      const tree = treeRef.current;
      if (!box || !tree || window.innerWidth <= 700) return setScale(1);
      setScale(Math.max(0.45, Math.min(1, (box.clientWidth - 32) / tree.scrollWidth)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [data, editing, ask]);
  const shrink = fit && scale < 1;

  const centered = useRef(false);
  useEffect(() => {
    const box = scrollRef.current;
    if (!data || !box || centered.current) return;
    centered.current = true;
    const mine = data.positions.find(p => p.holders.some(h => h.mine));
    requestAnimationFrame(() => {
      const card = box.querySelector(mine ? `[data-pos="${mine.id}"]` : '.org-card');
      if (card) box.scrollLeft = card.getBoundingClientRect().left - box.getBoundingClientRect().left + box.scrollLeft + card.offsetWidth / 2 - box.clientWidth / 2;
    });
  }, [data]);

  const positions = data ? data.positions : [];
  const mineId = positions.find(p => p.holders.some(h => h.mine))?.id;
  const mineTitle = (positions.find(p => p.id === mineId) || {}).title;
  const children = pid => positions.filter(p => (p.parent_id || null) === pid);

  const form = (
    editing && (
      <form className="org-form" onSubmit={savePosition}>
        <label>Cargo<input value={editing.title} maxLength={60} onChange={e => setEditing({ ...editing, title: e.target.value })} required /></label>
        <label>Depende de
          <select value={editing.parent_id ?? ''} onChange={e => setEditing({ ...editing, parent_id: e.target.value === '' ? '' : Number(e.target.value) })}>
            <option value="">(nadie: arriba del todo)</option>
            {positions.filter(p => p.id !== editing.id).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </label>
        <label>Sitio
          <select value={editing.place} onChange={e => setEditing({ ...editing, place: e.target.value })}>
            <option value="mesa">Mesa del open space</option>
            <option value="despacho">Despacho</option>
            <option value="recepcion">Recepción</option>
          </select>
        </label>
        <label>Ficticios si no hay nadie<input type="number" min={0} max={10} value={editing.seats} onChange={e => setEditing({ ...editing, seats: e.target.value })} /></label>
        <label className="org-check"><input type="checkbox" checked={!!editing.is_unique} onChange={e => setEditing({ ...editing, is_unique: e.target.checked })} /> Solo una persona (como un CEO)</label>
        <label className="org-check"><input type="checkbox" checked={!!editing.csuite} onChange={e => setEditing({ ...editing, csuite: e.target.checked })} /> ⭐ C-suite (su ficticio piensa con IA)</label>
        <div className="org-actions">
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{editing.id ? 'Guardar' : 'Crear cargo'}</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancelar</button>
        </div>
      </form>
    )
  );

  // Árbol de arriba abajo: cada cargo es una tarjeta y sus hijos cuelgan debajo, unidos con
  // líneas (CSS). Si no cabe, se desplaza de lado dentro de su caja, nunca la página.
  const node = p => (
    <li key={p.id}>
      <div className={`org-card ${p.id === mineId ? 'is-mine' : ''} ${p.csuite ? 'is-csuite' : ''}`} data-pos={p.id}>
        <div className="org-title">{p.csuite ? '⭐ ' : ''}{p.title}</div>
        <div className="org-tags">{p.is_unique ? 'una persona' : p.seats === 1 ? '1 plaza' : `${p.seats} plazas`} · {PLACE[p.place]}</div>
        <div className="org-holders">
          {p.holders.length === 0 && <span className="muted">vacante</span>}
          {p.holders.map(h => (
            <span key={h.character_id} className="org-holder" title={h.human ? 'Persona' : h.ai ? 'Ficticio con IA' : 'Ficticio'}>
              <Mini config={h.avatar_config} />
              <span className="org-hname">{h.human ? '👤' : '🤖'} {h.name}{h.mine ? ' (tú)' : ''}</span>
            </span>
          ))}
        </div>
        <div className="org-actions">
          {p.id === mineId ? <span className="org-mine">Tu cargo</span> : mode === 'choose' ? (
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => take(p)}>Quiero este</button>
          ) : confirmTake === p.id ? (
            // Cambiarse de cargo no se deshace con un toque: se confirma diciendo qué va a pasar.
            <span className="org-confirm" role="alert">
              <span>{mineTitle ? `Dejarás de ser ${mineTitle}.` : ''} {p.holders.some(h => !h.human) ? 'El ficticio de este cargo se irá a casa.' : ''}</span>
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => { setConfirmTake(null); take(p); }}>Sí, cambiarme</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmTake(null)}>Cancelar</button>
            </span>
          ) : (
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setConfirmTake(p.id)}>Cambiarme</button>
          )}
          {isAdmin && mode === 'manage' && (
            <span className="org-admin">
              <button type="button" className="btn btn-ghost btn-sm" aria-label={`Editar ${p.title}`} onClick={() => setEditing({ ...p, parent_id: p.parent_id ?? '' })}><Pencil size={15} aria-hidden /></button>
              <button type="button" className="btn btn-ghost btn-sm" aria-label={`Añadir cargo bajo ${p.title}`}
                onClick={() => setEditing({ title: '', parent_id: p.id, csuite: false, is_unique: false, seats: 1, place: 'mesa' })}><Plus size={15} aria-hidden /></button>
              <button type="button" className={`btn btn-sm ${confirmDel === p.id ? 'btn-danger' : 'btn-ghost'}`} aria-label={`Borrar ${p.title}`} onClick={() => remove(p)}>
                {confirmDel === p.id ? '¿Seguro?' : <Trash2 size={15} aria-hidden />}
              </button>
            </span>
          )}
        </div>
      </div>
      {children(p.id).length > 0 && <ul>{children(p.id).map(node)}</ul>}
    </li>
  );

  // Lo que sale al tocar una tarjeta (pedir un cargo ocupado, editar o crear) va encima del árbol.
  const askPanel = ask && (
    <div className="org-requests" ref={panelRef}>
      {ask.holderName || 'Otra persona'} ya es {ask.position.title}. {mineId
        ? <>¿Se lo pides? Si acepta, os intercambiáis.{' '}
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={askFor}>Pedírselo</button></>
        : 'Elige antes otro cargo libre y luego se lo pides desde el organigrama.'}
    </div>
  );
  const editTitle = editing && (editing.id ? `Editar «${editing.title}»`
    : editing.parent_id != null && editing.parent_id !== '' ? `Nuevo cargo bajo «${(positions.find(x => x.id === editing.parent_id) || {}).title}»` : 'Nuevo cargo arriba del todo');

  return (
    <div className="cos">
      <header className="cos-head">
        <span className="pixel-font cos-logo">{company.name}</span>
        <span className="cos-spacer" />
        {onBack && <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>{mode === 'choose' ? '← Mis empresas' : '← Oficina'}</button>}
      </header>
      <main className="cos-main">
        <h1 className="cos-title">{mode === 'choose' ? '¿Qué eres en esta empresa?' : '🗂️ Organigrama'}</h1>
        {mode === 'choose' && mineId && (
          <div className="org-default" role="status">
            <p>Como has creado la empresa, te hemos puesto de <strong>{mineTitle}</strong>. Si prefieres otro cargo, elígelo abajo.</p>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={onDone}>Seguir como {mineTitle}</button>
          </div>
        )}
        <p className="muted">
          {mode === 'choose'
            ? 'Elige tu cargo. Si lo ocupa un ficticio 🤖, se va a su casa en cuanto llegas. No hace falta que esté ocupado el de arriba.'
            : 'Quién es quién. 👤 persona · 🤖 ficticio · ⭐ C-suite. Puedes cambiarte de cargo o pedirle uno a quien lo tenga.'}
        </p>
        {msg && <div className="cos-notice" role="status">{msg}</div>}
        {error && <div className="modal-error">{error}</div>}
        {reqs.incoming.length > 0 && (
          <section className="org-requests" aria-label="Peticiones recibidas">
            <strong>📨 Te piden tu cargo</strong>
            <ul>
              {reqs.incoming.map(r => (
                <li key={r.id}>
                  {r.from_name} quiere ser {r.position} (te quedarías su cargo).
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => answer(r.id, true)}>Aceptar</button>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => answer(r.id, false)}>Rechazar</button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {reqs.outgoing.length > 0 && (
          <p className="muted">⏳ Esperando respuesta: {reqs.outgoing.map(r => `${r.position} (${r.to_name})`).join(', ')}</p>
        )}
        {isAdmin && mode === 'manage' && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing({ title: '', parent_id: null, csuite: false, is_unique: false, seats: 1, place: 'mesa' })}>
            ➕ Cargo arriba del todo
          </button>
        )}
        {askPanel}
        {editing && <div ref={panelRef}><h2 className="org-edit-title">{editTitle}</h2>{form}</div>}
        {!data && !error && <p className="muted">Dibujando el organigrama…</p>}
        {scale < 1 && (
          <button type="button" className="btn btn-ghost btn-sm org-fit" onClick={() => setFit(!fit)}>
            {fit ? <><ZoomIn size={15} aria-hidden /> Ver a tamaño real</> : <><ZoomOut size={15} aria-hidden /> Ver entero</>}
          </button>
        )}
        <div className="org-scroll" ref={scrollRef}>
          <div className="org-fit-box" style={shrink && treeRef.current ? { height: treeRef.current.offsetHeight * scale } : undefined}>
            <div className="org-tree" ref={treeRef}
              style={shrink ? { transform: `scale(${scale})`, transformOrigin: 'top center' } : undefined}>
              <ul>{children(null).map(node)}</ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
