// Quién oye qué. Un personaje solo se entera de lo que se dijo en el MISMO sitio mientras él
// estaba allí, de lo que le dijeron a él y de sus llamadas. El open space (las mesas) cuenta
// como un solo sitio. Quien teletrabaja solo se entera de sus llamadas.
// Además de dar realismo, ahorra tokens: el prompt lleva menos ruido.

// Sitio "acústico" de una acción.
function roomOf(lugar) {
  return lugar === 'mesa' ? 'openspace' : lugar;
}

// Dónde estaba alguien a un minuto dado, según su plan del bloque (la acción en curso).
function whereAt(actions, min) {
  let cur = null;
  for (const a of actions || []) if (a.min <= min) cur = a;
  return cur ? roomOf(cur.lugar) : null;
}

// events: filas del feed con { character_id, con_id, lugar, min, text, kind, private }
// listener: { id, mode }; plans: acciones del día del oyente (mañana + tarde, ordenadas).
function heardBy(events, listener, plans) {
  return events.filter(e => {
    if (e.private) return e.character_id === listener.id; // los pensamientos, solo el suyo
    if (e.character_id === listener.id || e.con_id === listener.id) return true;
    // Lo de fuera (la nevada, la final, la huelga) lo sabe todo el mundo, también desde casa.
    if (e.kind === 'fuera' && !e.lugar) return true;
    if (listener.mode === 'remoto') return false;
    // Lo que pasa en toda la oficina (un apagón) lo nota todo el que esté dentro.
    if (e.kind === 'incidente' && !e.lugar) return true;
    if (e.min == null || !e.lugar || e.lugar === 'casa') return false;
    if (!['accion', 'incidente', 'evento', 'charla', 'fuera'].includes(e.kind)) return false;
    return whereAt(plans, e.min) === roomOf(e.lugar);
  });
}

module.exports = { roomOf, whereAt, heardBy };
