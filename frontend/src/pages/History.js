import React, { useCallback, useEffect, useState } from 'react';
import { capi, HUMOR_EMOJI } from '../api';
import StatsPentagon from '../components/StatsPentagon';
import '../styles/history.css';

// Historial de un personaje: lo que hizo, lo que le dijeron, llamadas, trayectos, sueños,
// diarios y (si es el tuyo) lo que pensó. Los pensamientos se ven distintos: nube y cursiva.
const KIND = {
  accion: { icon: '🗨️', label: 'Hizo' },
  le_dicen: { icon: '👂', label: 'Le dijeron' },
  llamada: { icon: '📞', label: 'Llamada' },
  pensamiento: { icon: '💭', label: 'Pensó' },
  trayecto: { icon: '🚶', label: 'De camino' },
  sueno: { icon: '🌙', label: 'Sueño' },
  sistema: { icon: '⚙️', label: 'Aviso' },
};

function fmtDay(day) {
  return new Date(`${day}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function History({ characterId, onBack }) {
  const [ch, setCh] = useState(null);
  const [data, setData] = useState({ items: [], diaries: [], dreams: [], next: null, mine: false });
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('todo');

  const load = useCallback(async before => {
    try {
      const r = await capi(`/characters/${characterId}/history${before ? `?before=${before}` : ''}`);
      setData(prev => (before
        ? { ...r, items: [...prev.items, ...r.items], diaries: [...prev.diaries, ...r.diaries], dreams: [...prev.dreams, ...r.dreams] }
        : r));
    } catch (e) {
      setError(e.message);
    }
  }, [characterId]);

  useEffect(() => {
    capi(`/characters/${characterId}`).then(setCh).catch(e => setError(e.message));
    load();
  }, [characterId, load]);

  const shown = data.items.filter(it => {
    if (filter === 'todo') return true;
    if (filter === 'pensamientos') return it.kind === 'pensamiento';
    if (filter === 'lo que hace') return ['accion', 'llamada'].includes(it.kind);
    if (filter === 'conversaciones') return ['accion', 'le_dicen', 'llamada'].includes(it.kind) && /«/.test(it.text);
    return ['trayecto', 'sueno', 'llamada'].includes(it.kind);
  });
  const byDay = new Map();
  for (const it of shown) {
    if (!byDay.has(it.day)) byDay.set(it.day, []);
    byDay.get(it.day).push(it);
  }

  return (
    <div className="hist">
      <header className="hist-head">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>← Oficina</button>
        <h1 className="hist-title">{ch ? `${HUMOR_EMOJI[ch.humor] || ''} ${ch.name}` : 'Historial'}</h1>
      </header>

      <div className="hist-layout">
        <aside className="hist-side">
          {ch && (
            <>
              <p className="hist-puesto">{ch.ficha.puesto}</p>
              <StatsPentagon stats={ch.stats} />
              <p className="hist-objetivo"><strong>Objetivo:</strong> {ch.ficha.objetivo}</p>
            </>
          )}
          {!data.mine && <p className="muted">Los pensamientos solo los ve su dueño.</p>}
        </aside>

        <main className="hist-main">
          <div className="hist-filters" role="tablist" aria-label="Qué ver">
            {['todo', 'lo que hace', 'conversaciones', 'pensamientos', 'cosas que le pasan'].map(f => (
              <button key={f} type="button" role="tab" aria-selected={filter === f}
                className={`onb-chip ${filter === f ? 'is-on' : ''}`} onClick={() => setFilter(f)}
                disabled={f === 'pensamientos' && !data.mine}>{f}</button>
            ))}
          </div>
          {error && <div className="modal-error">{error}</div>}
          {byDay.size === 0 && !error && <p className="muted">Aún no le ha pasado nada que contar.</p>}
          {[...byDay.entries()].map(([day, items]) => {
            const diary = data.diaries.find(d => d.day === day);
            const dream = data.dreams.find(d => d.day === day);
            return (
              <section key={day} className="hist-day">
                <h2 className="hist-day-title">{fmtDay(day)}</h2>
                {dream && filter === 'todo' && (
                  <div className="hist-item hist-dream">
                    🌙 Le susurraste: «{dream.text}»{dream.followed != null && <> — {dream.followed ? 'te hizo caso' : 'pasó'}: <em>{dream.reason}</em></>}
                  </div>
                )}
                <ol className="hist-list">
                  {items.map(it => (
                    <li key={it.id} className={`hist-item hist-${it.kind}`}>
                      <span className="hist-time">{it.hhmm || ''}</span>
                      <span className="hist-icon" title={(KIND[it.kind] || {}).label}>{(KIND[it.kind] || KIND.accion).icon}</span>
                      <span className="hist-text">{it.kind === 'pensamiento' ? `«${it.text}»` : it.text}</span>
                    </li>
                  ))}
                </ol>
                {diary && filter === 'todo' && <blockquote className="hist-diary">📔 {diary.text}</blockquote>}
              </section>
            );
          })}
          {data.next && <button type="button" className="btn btn-ghost" onClick={() => load(data.next)}>Ver más antiguo</button>}
        </main>
      </div>
    </div>
  );
}
