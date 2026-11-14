// Piloto automático: el día sin IA. No gasta nada. Lo usa el personaje mientras su turno
// está en cola, si no hay despertador encendido o si se ha gastado el tope.

const { fromMinutes } = require('./clock');

// Generador determinista por personaje y día, para que el plan no cambie al reiniciar.
function rng(seedStr) {
  let h = 2166136261;
  for (const c of seedStr) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const TEMPLATES = {
  manana: [
    { min: 540, lugar: 'mesa', que: 'Llega y enciende el ordenador' },
    { min: 630, lugar: ['cafe', 'cafe', 'terraza'], que: ['Primer café del día', 'Café y cotilleo en la cocina', 'Café al sol en la terraza'] },
    { min: 660, lugar: 'mesa', que: 'Trabaja (más o menos)' },
    { min: 735, lugar: ['reuniones', 'lavabo', 'recepcion', 'servidores'], que: ['Reunión que podía ser un correo', 'Escapada estratégica', 'Va a ver si ha llegado un paquete', 'Va a mirar por qué parpadea una luz'] },
    { min: 780, lugar: 'mesa', que: 'Hace como que contesta correos' },
  ],
  tarde: [
    { min: 840, lugar: ['cafe', 'terraza', 'cafe'], que: ['Come de táper', 'Come al aire libre', 'Calienta el táper en el micro'] },
    { min: 900, lugar: 'mesa', que: 'Lucha contra la modorra' },
    { min: 990, lugar: ['descanso', 'lavabo', 'reuniones', 'despacho'], que: ['Siestecilla en el puf', 'Se pierde un rato', 'Reunión de seguimiento del seguimiento', 'Le llaman al despacho del jefe'] },
    { min: 1020, lugar: 'mesa', que: 'Recta final del día' },
  ],
};

function pick(v, i) {
  return Array.isArray(v) ? v[i % v.length] : v;
}

function autopilotPlan(character, day, block) {
  const r = rng(`${character.id}|${day}|${block}`);
  const muletillas = (character.ficha && character.ficha.muletillas) || [];
  return TEMPLATES[block].map((t, i) => {
    const variant = Math.floor(r() * 3);
    const jitter = i === 0 ? 0 : Math.floor(r() * 20) - 10;
    const min = t.min + jitter;
    const frase = muletillas.length && r() < 0.6 ? muletillas[Math.floor(r() * muletillas.length)] : '';
    return { min, hora: fromMinutes(min), lugar: pick(t.lugar, variant), con: null, que: pick(t.que, variant), frase };
  });
}

module.exports = { autopilotPlan, rng };
