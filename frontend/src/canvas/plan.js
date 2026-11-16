// El plano de la oficina que se está pintando. Empieza con la Clásica (copia local, para pintar
// algo antes de que llegue la de la empresa) y Office.js pone la de la empresa con setPlan().
// Quien dibuja mira planVersion() para saber si tiene que rehacer lo que tenía en caché.

import clasica from '../assets/maps/office.json';

let plan = clasica;
let version = 0;

export const getPlan = () => plan;
export const planVersion = () => version;

export function setPlan(next) {
  if (!next || !Array.isArray(next.grid)) return;
  if (JSON.stringify(next) === JSON.stringify(plan)) return;
  plan = next;
  version += 1;
}
