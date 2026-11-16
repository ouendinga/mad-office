// La mudanza: cambiar de oficina es un día especial, no un botón. La tarde de antes se empaqueta
// (cajas por la oficina); esa mañana van andando a la nueva con sus cosas, con un camión en la
// puerta y cosas que les pasan por el camino; al llegar, cajas por desempaquetar hasta mediodía.
// Todo por reglas, sin IA. Se guarda en companies.settings.mudanza = { to, day, from }.

const { rng } = require('./autopilot');

// Lo que lleva cada uno por la calle (el «trayecto» de ese día).
const CARGA = [
  n => `${n} lleva una caja que pone «FRÁGIL: TAZAS» y va pisando huevos.`,
  n => `${n} carga con la planta del open space como si fuera un bebé.`,
  n => `${n} lleva su silla rodando por la acera. Ya ha atropellado a una paloma.`,
  n => `${n} va con el monitor en brazos y no ve dónde pisa.`,
  n => `${n} lleva la caja de los cables. Nadie sabe qué hay dentro.`,
  n => `${n} ha perdido el cargador del portátil entre las dos oficinas.`,
  n => `${n} empuja el carrito de las cajas y una rueda chirría todo el camino.`,
  n => `${n} lleva el trofeo del jefe y saluda a los coches como si fuera la Copa.`,
  n => `${n} lleva el kanban enrollado bajo el brazo. Se le caen pósits por la calle.`,
  n => `${n} va con dos bolsas de táperes «para no tirarlos».`,
  n => `${n} lleva la cafetera abrazada. Prioridades.`,
  n => `${n} ha traído una carretilla del trastero de su suegro.`,
];

// Lo que pasa a todos (al feed), unas cuantas por mudanza.
const SUCESOS = [
  '🚚 El camión de la mudanza aparca en doble fila. Multa al canto.',
  '🛋️ El sofá de la zona chill no cabe por la puerta. Lo meten de pie entre cuatro.',
  '📦 Se cae una caja en el paso de cebra: lluvia de pósits.',
  '🪴 La planta del jefe viaja en el asiento del copiloto del camión, con el cinturón puesto.',
  '🔌 Nadie sabe en qué caja va el router.',
  '☕ La cafetera va la primera en el camión. Nadie se queja.',
  '🧾 El de la mudanza pide firmar un papel que nadie lee.',
  '🐦 Una paloma se cuela en el camión y viaja gratis hasta la nueva oficina.',
  '🗝️ Las llaves de la oficina nueva no abren. Diez minutos de pánico. Era la otra llave.',
];

// Trayecto de mudanza de una persona (determinista: el mismo en cada tick).
function cargaDe(c, day) {
  return CARGA[Math.floor(rng(`carga|${day}|${c.id}`)() * CARGA.length)](c.name);
}

// Sucesos del día, con su minuto dentro de la franja del trayecto [from, to).
function sucesosDe(day, companyId, from, to) {
  const r = rng(`mudanza|${companyId}|${day}`);
  const pool = SUCESOS.slice();
  const out = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const text = pool.splice(Math.floor(r() * pool.length), 1)[0];
    out.push({ min: from + Math.floor(((i + 0.5) / 3) * Math.max(1, to - from)), text });
  }
  return out;
}

module.exports = { cargaDe, sucesosDe, CARGA, SUCESOS };
