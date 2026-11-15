// Pensamientos sin IA (para quien va en piloto automático): salen de cómo está (hambre, sueño,
// agobio, ganas de gente) y de su ficha (manías, objetivo). Privados, como los de la IA: solo los
// ve el dueño del personaje. Uno de vez en cuando, no a cada paso.

const { rng } = require('./autopilot');

const BY_STATE = [
  ['saciedad', 1.5, ['Como no coma algo me como el teclado.', '¿Quedará algo en la máquina?', 'Mi estómago acaba de hacer un ruido en plena reunión.']],
  ['energia', 1.5, ['Un café más y veo sonidos.', 'Si cierro los ojos cinco segundos nadie lo nota.', '¿Es legal dormir debajo de la mesa?']],
  ['calma', 1.5, ['Respira. Uno, dos… ¿quién ha puesto otra reunión?', 'Si alguien dice «sinergia» me voy.', 'Necesito unas vacaciones de mis vacaciones.']],
  ['social', 1.5, ['Hoy no he hablado con nadie. ¿Existo?', 'Igual voy a la cocina «a por agua».', 'Echo de menos hasta las reuniones.']],
  ['animo', 4.3, ['Hoy es mi día. Lo noto.', 'Qué bien está todo. Sospechoso.', 'Me voy a comer el mundo (después del café).']],
];
const BY_PLACE = {
  reuniones: ['Esta reunión podía haber sido un correo.', 'Asiento a todo y no he entendido nada.'],
  cafe: ['El café de aquí sabe a lunes.', 'Me quedo aquí hasta que me echen.'],
  terraza: ['Ojalá trabajar aquí siempre.', '¿Y si me hago pastor?'],
  lavabo: ['Este es el único sitio donde no me escriben.'],
  servidores: ['Si parpadea, no la toques.'],
  despacho: ['¿Me van a subir el sueldo o a echar?'],
};

// ¿Piensa algo ahora? c: personaje (con stats y ficha); a: acción que empieza; key: semilla única.
function thoughtFor(c, a, key) {
  const r = rng(`piensa|${c.id}|${key}`);
  if (r() > 0.3) return null;
  const s = c.stats || {};
  for (const [k, limit, list] of BY_STATE) {
    const low = k !== 'animo';
    if (s[k] != null && (low ? s[k] < limit : s[k] > limit) && r() < 0.8) return list[Math.floor(r() * list.length)];
  }
  const f = c.ficha || {};
  const roll = r();
  if (roll < 0.3 && f.objetivo) return `Lo tengo claro: ${String(f.objetivo).replace(/\.$/, '').toLowerCase()}.`;
  if (roll < 0.55 && f.manias && f.manias.length) return `Necesito ${String(f.manias[Math.floor(r() * f.manias.length)]).replace(/\.$/, '').toLowerCase()}. Ya.`;
  const list = BY_PLACE[a.lugar];
  return list ? list[Math.floor(r() * list.length)] : null;
}

module.exports = { thoughtFor };
