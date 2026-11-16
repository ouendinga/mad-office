import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrickWall, Square, DoorOpen, Trees, BoxSelect, Armchair, Eraser, Move, Undo2, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { capi } from '../api';
import { buildStatic, objectSprite, objectDef, T } from '../engine/OfficeArt';
import '../styles/designer.css';

// Diseñador de oficinas (solo en ordenador; en el móvil, la oficina se ve pero no se edita).
// Se pintan paredes, suelos, puertas y salas, y se ponen muebles. Lo demás (mesas, aforos, dónde se
// coloca la gente) lo deduce el servidor del dibujo; él también decide si el plano vale.

const TOOLS = [
  { id: 'sala', label: 'Sala', icon: BoxSelect, help: 'Arrastra para dibujar una sala: pone sus paredes y su suelo.' },
  { id: 'mueble', label: 'Mueble', icon: Armchair, help: 'Elige un mueble a la derecha y haz clic donde quieras ponerlo.' },
  { id: 'mover', label: 'Mover', icon: Move, help: 'Arrastra un mueble para moverlo.' },
  { id: 'borrar', label: 'Borrar mueble', icon: Eraser, help: 'Haz clic en un mueble para quitarlo.' },
  { id: 'pared', label: 'Pared', icon: BrickWall, help: 'Pinta pared casilla a casilla (arrastra).' },
  { id: 'suelo', label: 'Suelo', icon: Square, help: 'Pinta suelo casilla a casilla (arrastra).' },
  { id: 'puerta', label: 'Puerta', icon: DoorOpen, help: 'Haz clic en una pared para abrir una puerta.' },
  { id: 'fuera', label: 'Exterior', icon: Trees, help: 'Pinta césped: lo de fuera del edificio.' },
];
const WALL_COLORS = ['#E9DCC8', '#E7E0D2', '#D9C7A8', '#E3E7EE', '#F0E6D6', '#E4D3EE', '#CFE6EA', '#B9C0CD', '#D9D4C7'];
const MIN_ZOOM = 1;

// Un plano de plantilla, en el formato del diseñador (cada sala con su tipo).
export function toDrawn(plan) {
  return {
    cols: plan.cols, rows: plan.rows, grid: plan.grid.slice(), description: plan.description || '',
    rooms: plan.rooms.map(r => ({ type: r.type || r.id, label: r.label, x: r.x, y: r.y, w: r.w, h: r.h, floor: r.floor, wall: r.wall })),
    objects: plan.objects.map(o => ({ ...o })),
  };
}
export function blankPlan() {
  const cols = 30;
  const rows = 20;
  const grid = Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => (x === 0 || y === 0 || x === cols - 1 || y === rows - 1 ? '#' : '.')).join(''));
  grid[rows - 1] = `${grid[rows - 1].slice(0, 14)}D${grid[rows - 1].slice(15)}`;
  return {
    cols, rows, grid, description: '',
    rooms: [{ type: 'openspace', label: 'Open space', x: 1, y: 1, w: cols - 2, h: rows - 2, floor: 'carpet', wall: '#E3E7EE' }],
    objects: [{ type: 'office_chair', x: 3, y: 3, w: 2 }, { type: 'desk', x: 3, y: 4, w: 2 }, { type: 'office_chair', x: 7, y: 3, w: 2 }, { type: 'desk', x: 7, y: 4, w: 2 }],
  };
}

const setTile = (grid, x, y, ch) => {
  const row = grid[y];
  grid[y] = row.slice(0, x) + ch + row.slice(x + 1);
};

// El plano para pintarlo: cada sala necesita id (el pintor la busca por su rectángulo).
const forArt = p => ({ ...p, rooms: p.rooms.map((r, i) => ({ ...r, id: r.type || `sala${i}` })) });

function renderPlan(canvas, plan, zoom, hover, drag) {
  const art = buildStatic(forArt(plan));
  const actx = art.getContext('2d');
  const items = plan.objects.map((o, i) => ({ o, i, d: objectDef(o.type) })).filter(x => x.d)
    .sort((a, b) => (a.d.flat || a.d.wall ? -1 : 0) - (b.d.flat || b.d.wall ? -1 : 0) || (a.o.y + (a.o.h || 1)) - (b.o.y + (b.o.h || 1)));
  for (const { o, i } of items) {
    const s = objectSprite(o, i + 1, 0);
    actx.drawImage(s.canvas, o.x * T + s.dx, o.y * T + s.dy);
  }
  canvas.width = plan.cols * T * zoom;
  canvas.height = plan.rows * T * zoom;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(art, 0, 0, canvas.width, canvas.height);
  // rejilla
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= plan.cols; x++) { ctx.beginPath(); ctx.moveTo(x * T * zoom + 0.5, 0); ctx.lineTo(x * T * zoom + 0.5, canvas.height); ctx.stroke(); }
  for (let y = 0; y <= plan.rows; y++) { ctx.beginPath(); ctx.moveTo(0, y * T * zoom + 0.5); ctx.lineTo(canvas.width, y * T * zoom + 0.5); ctx.stroke(); }
  // salas: su borde y su nombre
  ctx.font = '700 11px Inter, sans-serif';
  for (const r of plan.rooms) {
    ctx.strokeStyle = 'rgba(0, 206, 201, 0.55)';
    ctx.strokeRect(r.x * T * zoom + 1, r.y * T * zoom + 1, r.w * T * zoom - 2, r.h * T * zoom - 2);
    ctx.fillStyle = 'rgba(15,15,26,0.7)';
    const label = r.label || r.type;
    ctx.fillRect(r.x * T * zoom + 3, r.y * T * zoom + 3, ctx.measureText(label).width + 8, 15);
    ctx.fillStyle = '#7FE7E4';
    ctx.fillText(label, r.x * T * zoom + 7, r.y * T * zoom + 14);
  }
  if (drag) {
    const x = Math.min(drag.x0, drag.x1); const y = Math.min(drag.y0, drag.y1);
    const w = Math.abs(drag.x1 - drag.x0) + 1; const h = Math.abs(drag.y1 - drag.y0) + 1;
    ctx.fillStyle = 'rgba(108,92,231,0.25)';
    ctx.fillRect(x * T * zoom, y * T * zoom, w * T * zoom, h * T * zoom);
    ctx.strokeStyle = '#A29BFE'; ctx.lineWidth = 2;
    ctx.strokeRect(x * T * zoom, y * T * zoom, w * T * zoom, h * T * zoom);
  } else if (hover) {
    ctx.strokeStyle = '#F2C14E'; ctx.lineWidth = 2;
    ctx.strokeRect(hover.x * T * zoom, hover.y * T * zoom, (hover.w || 1) * T * zoom, (hover.h || 1) * T * zoom);
  }
}

export default function Designer({ planId, base, onBack }) {
  const [plan, setPlan] = useState(base || null);
  const [name, setName] = useState('');
  const [tool, setTool] = useState('sala');
  const [roomType, setRoomType] = useState('cocina');
  const [furniture, setFurniture] = useState('desk');
  const [catalog, setCatalog] = useState(null);
  const [check, setCheck] = useState(null);
  const [history, setHistory] = useState([]);
  const [hover, setHover] = useState(null);
  const [drag, setDrag] = useState(null);
  const [zoom, setZoom] = useState(2);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [id, setId] = useState(planId || null);
  const canvasRef = useRef(null);
  const painting = useRef(false);
  const narrow = typeof window !== 'undefined' && window.innerWidth < 900;

  useEffect(() => { capi('/planos/catalogo').then(setCatalog).catch(e => setError(e.message)); }, []);
  useEffect(() => {
    if (!planId) { setName(n => n || 'Nuestra oficina'); return; }
    capi(`/planos/${planId}`).then(r => { setPlan(r.plan); setName(r.name); }).catch(e => setError(e.message));
  }, [planId]);

  // Cada cambio: se vuelve a pintar y, al rato, el servidor dice si vale.
  useEffect(() => {
    if (!plan || !canvasRef.current) return;
    renderPlan(canvasRef.current, plan, zoom, hover, drag);
  }, [plan, zoom, hover, drag]);
  useEffect(() => {
    if (!plan) return undefined;
    const t = setTimeout(() => capi('/planos/validar', { method: 'POST', body: { plan } }).then(setCheck).catch(() => {}), 400);
    return () => clearTimeout(t);
  }, [plan]);

  const change = useCallback(fn => {
    setPlan(p => {
      setHistory(h => [...h.slice(-40), p]);
      const next = { ...p, grid: p.grid.slice(), rooms: p.rooms.map(r => ({ ...r })), objects: p.objects.map(o => ({ ...o })) };
      fn(next);
      return next;
    });
  }, []);
  const undo = () => setHistory(h => { if (!h.length) return h; setPlan(h[h.length - 1]); return h.slice(0, -1); });

  const tileAt = e => {
    const r = canvasRef.current.getBoundingClientRect();
    const sx = (e.clientX - r.left) * (canvasRef.current.width / r.width);
    const sy = (e.clientY - r.top) * (canvasRef.current.height / r.height);
    return { x: Math.floor(sx / (T * zoom)), y: Math.floor(sy / (T * zoom)) };
  };
  const objectAt = (p, x, y) => {
    for (let i = p.objects.length - 1; i >= 0; i--) {
      const o = p.objects[i];
      if (x >= o.x && x < o.x + (o.w || 1) && y >= o.y && y < o.y + (o.h || 1)) return i;
    }
    return -1;
  };
  const inside = (p, x, y) => x >= 0 && y >= 0 && x < p.cols && y < p.rows;

  const paintTile = (x, y) => {
    if (!inside(plan, x, y)) return;
    const ch = { pared: '#', suelo: '.', fuera: ',' }[tool];
    if (!ch || plan.grid[y][x] === ch) return;
    change(p => setTile(p.grid, x, y, ch));
  };

  const onDown = e => {
    if (!plan) return;
    const { x, y } = tileAt(e);
    if (!inside(plan, x, y)) return;
    if (tool === 'sala') { setDrag({ x0: x, y0: y, x1: x, y1: y }); return; }
    if (['pared', 'suelo', 'fuera'].includes(tool)) { painting.current = true; paintTile(x, y); return; }
    if (tool === 'puerta') {
      if (plan.grid[y][x] !== '#') { setError('Las puertas van en una pared.'); return; }
      setError('');
      change(p => setTile(p.grid, x, y, 'D'));
      return;
    }
    if (tool === 'borrar') {
      const i = objectAt(plan, x, y);
      if (i >= 0) change(p => { p.objects.splice(i, 1); });
      return;
    }
    if (tool === 'mover') {
      const i = objectAt(plan, x, y);
      if (i >= 0) setDrag({ move: i, dx: x - plan.objects[i].x, dy: y - plan.objects[i].y, x0: x, y0: y, x1: x, y1: y });
      return;
    }
    if (tool === 'mueble' && catalog) {
      const c = catalog.objects.find(o => o.type === furniture);
      change(p => p.objects.push({ type: furniture, x, y, ...(c.w > 1 ? { w: c.w } : {}), ...(c.h > 1 ? { h: c.h } : {}) }));
    }
  };
  const onMove = e => {
    if (!plan) return;
    const { x, y } = tileAt(e);
    if (drag) setDrag(d => ({ ...d, x1: x, y1: y }));
    if (painting.current) paintTile(x, y);
    const c = tool === 'mueble' && catalog ? catalog.objects.find(o => o.type === furniture) : null;
    setHover(inside(plan, x, y) ? { x, y, w: c ? c.w : 1, h: c ? c.h : 1 } : null);
  };
  const onUp = () => {
    painting.current = false;
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (d.move != null) {
      const nx = d.x1 - d.dx; const ny = d.y1 - d.dy;
      if (nx === plan.objects[d.move].x && ny === plan.objects[d.move].y) return;
      change(p => { p.objects[d.move].x = Math.max(0, nx); p.objects[d.move].y = Math.max(0, ny); });
      return;
    }
    // Sala: el rectángulo es el interior; alrededor, pared (respetando puertas).
    const x = Math.min(d.x0, d.x1); const y = Math.min(d.y0, d.y1);
    const w = Math.abs(d.x1 - d.x0) + 1; const h = Math.abs(d.y1 - d.y0) + 1;
    if (w < 2 || h < 2) { setError('Una sala necesita al menos 2×2 casillas.'); return; }
    setError('');
    const rt = (catalog && catalog.rooms.find(r => r.type === roomType)) || { label: roomType };
    const floor = { cocina: 'tiles', banos: 'bath', servidores: 'server', terraza: 'deck', recepcion: 'marble', despacho: 'parquet', openspace: 'carpet' }[roomType] || 'wood';
    change(p => {
      for (let yy = y - 1; yy <= y + h; yy++) {
        for (let xx = x - 1; xx <= x + w; xx++) {
          if (!inside(p, xx, yy)) continue;
          const border = xx === x - 1 || yy === y - 1 || xx === x + w || yy === y + h;
          if (border) { if (p.grid[yy][xx] !== 'D' && roomType !== 'terraza') setTile(p.grid, xx, yy, '#'); } else setTile(p.grid, xx, yy, roomType === 'terraza' ? '=' : '.');
        }
      }
      // Fuera las salas que quedan tapadas del todo por la nueva.
      p.rooms = p.rooms.filter(r => !(r.x >= x && r.y >= y && r.x + r.w <= x + w && r.y + r.h <= y + h));
      p.rooms.push({ type: roomType, label: roomType === 'pasillo' ? '' : rt.label, x, y, w, h, floor, wall: WALL_COLORS[p.rooms.length % WALL_COLORS.length] });
    });
  };

  const resize = (cols, rows) => {
    if (!catalog) return;
    const { minCols, maxCols, minRows, maxRows } = catalog.limits;
    cols = Math.max(minCols, Math.min(maxCols, cols | 0));
    rows = Math.max(minRows, Math.min(maxRows, rows | 0));
    change(p => {
      p.grid = Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => (p.grid[y] && p.grid[y][x]) || ',').join(''));
      p.cols = cols; p.rows = rows;
      p.rooms = p.rooms.filter(r => r.x + r.w <= cols && r.y + r.h <= rows);
      p.objects = p.objects.filter(o => o.x + (o.w || 1) <= cols && o.y + (o.h || 1) <= rows);
    });
  };

  const save = async () => {
    setBusy(true); setError(''); setMsg('');
    try {
      const r = await capi(id ? `/planos/${id}` : '/planos', { method: id ? 'PUT' : 'POST', body: { name, plan } });
      if (!id) setId(r.id);
      setMsg('Guardada. Para usarla, programa la mudanza desde «Oficinas».');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toolHelp = useMemo(() => (TOOLS.find(t => t.id === tool) || {}).help, [tool]);

  if (narrow) {
    return (
      <div className="cos"><main className="cos-main">
        <h1 className="cos-title">Diseñador de oficinas</h1>
        <p className="muted">El diseñador se usa en un ordenador: en el móvil, la oficina se ve pero no se edita.</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>← Volver</button>
      </main></div>
    );
  }

  return (
    <div className="dz">
      <header className="dz-head">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>← Oficinas</button>
        <input className="dz-name" value={name} maxLength={60} onChange={e => setName(e.target.value)} aria-label="Nombre de la oficina" />
        <span className="cos-spacer" />
        <button type="button" className="btn btn-ghost btn-sm" disabled={!history.length} onClick={undo}><Undo2 size={16} aria-hidden /> Deshacer</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy || !plan || (check && check.errors.length > 0)} onClick={save}><Save size={16} aria-hidden /> Guardar</button>
      </header>
      <div className="dz-body">
        <nav className="dz-tools" aria-label="Herramientas">
          {TOOLS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} type="button" className={`dz-tool ${tool === t.id ? 'is-on' : ''}`} onClick={() => setTool(t.id)} aria-pressed={tool === t.id}>
                <Icon size={18} aria-hidden /> {t.label}
              </button>
            );
          })}
          <label className="dz-zoom">Zoom
            <input type="range" min={MIN_ZOOM} max={4} step={0.5} value={zoom} onChange={e => setZoom(Number(e.target.value))} />
          </label>
        </nav>
        <div className="dz-canvas-wrap">
          <p className="dz-help">{toolHelp}</p>
          {plan ? (
            <canvas ref={canvasRef} className="dz-canvas" onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={() => { onUp(); setHover(null); }} />
          ) : <p className="muted">Cargando el plano…</p>}
        </div>
        <aside className="dz-side">
          {error && <div className="modal-error">{error}</div>}
          {msg && <p className="set-msg" role="status">{msg}</p>}
          {check && (
            <section className="dz-sec">
              <h3>{check.errors.length ? <><AlertTriangle size={16} aria-hidden /> Falta arreglar</> : <><CheckCircle2 size={16} aria-hidden /> Se puede usar</>}</h3>
              {check.desks != null && <p className="muted">{check.desks} mesas de trabajo.</p>}
              <ul className="dz-list">
                {check.errors.map(m => <li key={m} className="dz-err">{m}</li>)}
                {check.warnings.map(m => <li key={m} className="dz-warn">{m}</li>)}
              </ul>
            </section>
          )}
          {tool === 'sala' && catalog && (
            <section className="dz-sec">
              <h3>Tipo de sala</h3>
              <div className="dz-chips">
                {catalog.rooms.map(r => (
                  <button key={r.type} type="button" className={`onb-chip ${roomType === r.type ? 'is-on' : ''}`} onClick={() => setRoomType(r.type)}>{r.label}</button>
                ))}
              </div>
            </section>
          )}
          {tool === 'mueble' && catalog && (
            <section className="dz-sec">
              <h3>Muebles</h3>
              <div className="dz-chips">
                {catalog.objects.map(o => (
                  <button key={o.type} type="button" className={`onb-chip ${furniture === o.type ? 'is-on' : ''}`} onClick={() => setFurniture(o.type)}>{o.label}</button>
                ))}
              </div>
              <p className="muted dz-note">Las mesas necesitan la casilla de arriba libre (ahí se sienta la persona). Lo de pared (ventanas, cuadros, tele) va encima de una pared.</p>
            </section>
          )}
          {plan && (
            <section className="dz-sec">
              <h3>Salas</h3>
              <ul className="dz-rooms">
                {plan.rooms.map((r, i) => (
                  <li key={`${r.type}${r.x},${r.y}`}>
                    <input value={r.label || ''} maxLength={40} placeholder={r.type} aria-label="Nombre de la sala"
                      onChange={e => change(p => { p.rooms[i].label = e.target.value; })} />
                    <select value={r.floor} aria-label="Suelo" onChange={e => change(p => { p.rooms[i].floor = e.target.value; })}>
                      {catalog && catalog.floors.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <button type="button" className="btn btn-ghost btn-sm" aria-label={`Quitar la sala ${r.label || r.type}`}
                      onClick={() => change(p => { p.rooms.splice(i, 1); })}>✕</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {plan && catalog && (
            <section className="dz-sec">
              <h3>Tamaño</h3>
              <div className="dz-size">
                <label>Ancho<input type="number" value={plan.cols} min={catalog.limits.minCols} max={catalog.limits.maxCols} onChange={e => resize(Number(e.target.value), plan.rows)} /></label>
                <label>Alto<input type="number" value={plan.rows} min={catalog.limits.minRows} max={catalog.limits.maxRows} onChange={e => resize(plan.cols, Number(e.target.value))} /></label>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
