/**
 * Modo demo SOLO del frontend (`?demo=1` en la URL): rellena lo que el servidor aún no manda
 * del contrato del directo (doc/oficina-viva.md), para ver y probar escenas, tiempo, casa y
 * calle. Lo que el servidor ya mande, se respeta. Sin el parámetro no hace nada.
 *
 * Parámetros opcionales: weather=clear|partly|cloudy|fog|rain|heavyrain|snow|storm, temp=…,
 * wind=…, season=invierno|primavera|verano|otono, phase=casa|ida|oficina|vuelta, city=…,
 * en=<zona de office.json> (lleva a todos los de la oficina a esa zona, para ver su sala de cerca)
 */

import { getPlan } from './plan';

const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
export const DEMO = params.get('demo') === '1';

const WMO = { clear: 0, partly: 2, cloudy: 3, fog: 45, rain: 61, heavyrain: 65, snow: 73, storm: 95 };
const TRAYECTOS_IDA = [
  'El metro va tan lleno que lee el móvil del de al lado',
  'Persigue el bus 20 metros y lo pierde con dignidad',
  'Se encuentra a su jefe en el ascensor: silencio incómodo',
  'Compra un cruasán «para luego» y se lo come en el semáforo',
];
const TRAYECTOS_VUELTA = [
  'Se queda en la parada repasando el correo que no mandó',
  'Le pilla la lluvia sin paraguas: decide que es un spa',
  'Tararea en voz alta sin darse cuenta; nadie dice nada',
  'Llama a su madre y le cuenta la reunión entera',
];
const EXTERNOS = ['un cliente de Bilbao', 'el proveedor de café', 'un cliente muy enfadado'];

function phaseFromHHMM(hhmm) {
  const [h, m] = String(hhmm || '12:00').split(':').map(Number);
  const t = h * 60 + m;
  if (t >= 510 && t < 540) return 'ida';
  if (t >= 540 && t < 1080) return 'oficina';
  if (t >= 1080 && t < 1110) return 'vuelta';
  return 'casa';
}

export function augmentWorld(world) {
  if (!DEMO || !world) return world;
  const clock = { ...world.clock };
  const phase = params.get('phase') || clock.phase || phaseFromHHMM(clock.hhmm);
  clock.phase = phase;
  if (params.get('phase')) {
    // Para ver la oficina de día aunque el servidor diga que es de noche.
    clock.block = phase === 'oficina' ? 'manana' : 'noche';
    // En la calle, una hora dentro de la franja que avanza sola (un minuto cada 2 s).
    if (phase === 'ida' || phase === 'vuelta') {
      const m = Math.floor(Date.now() / 2000) % 30;
      clock.hhmm = phase === 'ida' ? `08:${String(30 + m).padStart(2, '0')}` : `18:${String(m).padStart(2, '0')}`;
    }
  }
  if (!clock.weather || params.get('weather')) {
    const kind = params.get('weather') || 'partly';
    clock.weather = {
      temp: Number(params.get('temp') || (kind === 'snow' ? -1 : 14)),
      code: WMO[kind] != null ? WMO[kind] : 2,
      desc: kind,
      precip: ['rain', 'heavyrain', 'storm', 'snow'].includes(kind) ? 2 : 0,
      wind: Number(params.get('wind') || 8),
      isDay: true,
    };
  }
  if (params.get('season') || !clock.season) clock.season = params.get('season') || clock.season;
  if (!clock.city || params.get('city')) clock.city = params.get('city') || 'Madrid';

  const chars = world.characters.map((c, i) => {
    const out = { ...c };
    if (!out.stats) {
      const f = k => Math.round((2 + ((c.id * 7 + k * 3) % 30) / 10) * 10) / 10;
      out.stats = { energia: f(1), animo: f(2), saciedad: f(3), social: f(4), calma: f(5) };
    }
    if (params.get('phase') || !out.mode) {
      if (phase === 'casa') out.mode = 'casa';
      else if (phase === 'ida' || phase === 'vuelta') out.mode = i === 1 ? 'remoto' : phase;
      else out.mode = i === 1 || i === 3 ? 'remoto' : 'oficina';
      if (out.mode === 'oficina' && (out.home || out.x == null)) {
        // de noche el servidor no manda posición: a su mesa (como deskPos de places.js)
        const d = getPlan().desks[(c.desk_index || 0) % getPlan().desks.length];
        out.home = false;
        out.x = (d.x + 1) * 32;
        out.y = d.y * 32 - 12;
        out.lugar = 'mesa';
        out.que = out.que || 'Trabaja (más o menos)';
        out.action = 'sentado';
      }
    }
    if (out.mode === 'ida' || out.mode === 'vuelta') {
      out.trayecto = out.trayecto || (out.mode === 'ida' ? TRAYECTOS_IDA : TRAYECTOS_VUELTA)[c.id % 4];
    }
    if (out.call === undefined) out.call = null;
    return out;
  });
  const zone = params.get('en') && getPlan().zones[params.get('en')];
  if (zone) {
    chars.filter(c => c.mode === 'oficina').forEach((c, i) => {
      const cols = Math.max(1, Math.ceil(zone.w / 2));
      c.x = (zone.x + (i % cols) * 2) * 32 + 16;
      c.y = (zone.y + Math.floor(i / cols) * 2) * 32 + 28;
      c.lugar = params.get('en');
      c.bubble = c.bubble || ['¿Alguien ha visto mi taza?', 'Esto lo hablamos offline.', '¡Qué guay!'][i % 3];
    });
  }
  // Llamadas de ejemplo: un remoto con alguien de la oficina; otro con un externo;
  // y uno de la oficina hablando con un cliente.
  const remotes = chars.filter(c => c.mode === 'remoto');
  const office = chars.filter(c => c.mode === 'oficina');
  if (remotes[0] && office[0] && !remotes[0].call) {
    remotes[0].call = { with: office[0].id, externo: null };
    office[0].call = { with: remotes[0].id, externo: null };
  }
  if (remotes[1] && !remotes[1].call) remotes[1].call = { with: null, externo: EXTERNOS[remotes[1].id % 3] };
  if (office[1] && !office[1].call) office[1].call = { with: null, externo: EXTERNOS[(office[1].id + 1) % 3] };
  return { ...world, clock, characters: chars };
}
