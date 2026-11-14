// Visitantes por reglas (sin IA, sin coste): el repartidor con un paquete para alguien,
// mantenimiento que arregla algo y la limpieza al final del día. Aparecen un rato en un sitio de
// la oficina; quien esté cerca se entera (y el destinatario del paquete, siempre).

const { rng } = require('./autopilot');

const KINDS = {
  repartidor: { name: 'Repartidor', avatar: { skinTone: 2, hairStyle: 4, hairColor: 0, clothes: 5, accessory: 2 } },
  mantenimiento: { name: 'Mantenimiento', avatar: { skinTone: 1, hairStyle: 4, hairColor: 5, clothes: 3, accessory: 2 } },
  limpieza: { name: 'Limpieza', avatar: { skinTone: 3, hairStyle: 6, hairColor: 0, clothes: 2, accessory: 0 } },
};

const FIXES = [
  { place: 'cafe', que: 'Desmonta la cafetera «para ver qué le pasa»', frase: 'Esto lo ha tocado alguien.' },
  { place: 'servidores', que: 'Cambia un fluorescente que parpadea desde marzo', frase: '¿Y nadie lo ha avisado?' },
  { place: 'mesa', que: 'Revisa la impresora del open space', frase: 'Tiene papel atascado desde el Pleistoceno.' },
  { place: 'lavabo', que: 'Arregla la cisterna que no para', frase: 'Esto es un clásico.' },
];
const PARCELS = ['una caja enorme', 'un sobre misterioso', 'un paquete que suena al moverlo', 'una caja con «FRÁGIL» por todas partes'];

// events del día: [{ key, kind, name, avatar, place, from, to, que, frase, forId }]
function visitorsFor(day, companyId, sch, chars) {
  const r = rng(`visitas|${companyId}|${day}`);
  const { BLOCKS } = sch;
  const span = (a, b) => a + Math.floor(r() * Math.max(1, b - a));
  const out = [];
  const people = chars.filter(c => !c.retired);
  if (people.length && r() < 0.6) {
    const to = people[Math.floor(r() * people.length)];
    const from = span(BLOCKS.manana.from + 30, BLOCKS.manana.to - 60);
    out.push({
      key: `${day}|repartidor`, kind: 'repartidor', place: 'recepcion', from, to: from + 20, forId: to.id,
      que: `Trae ${PARCELS[Math.floor(r() * PARCELS.length)]} para ${to.name}`, frase: `¡Paquete para ${to.name}!`,
    });
  }
  if (r() < 0.35) {
    const fix = FIXES[Math.floor(r() * FIXES.length)];
    const from = span(BLOCKS.tarde.from + 60, BLOCKS.tarde.to - 60);
    out.push({ key: `${day}|mantenimiento`, kind: 'mantenimiento', place: fix.place, from, to: from + 40, que: fix.que, frase: fix.frase });
  }
  out.push({
    key: `${day}|limpieza`, kind: 'limpieza', place: 'mesa', from: BLOCKS.tarde.to - 30, to: BLOCKS.tarde.to + 45,
    que: 'Pasa la mopa entre las mesas', frase: '¡Cuidado, que está mojado!',
  });
  return out.map(e => ({ ...e, name: KINDS[e.kind].name, avatar: KINDS[e.kind].avatar }));
}

module.exports = { KINDS, visitorsFor };
