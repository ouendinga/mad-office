// Sucesos de FUERA: cosas que pasan en el mundo (una nevada, la final del fútbol, una huelga de
// transporte, una inspección…) y revolucionan la oficina durante el día. Como los incidentes, los
// deciden REGLAS (sin IA): cada mañana se tira una vez, con probabilidades que dependen de cosas
// reales (el tiempo de verdad de weather.js, el día de la semana, la época del año y los festivos
// nacionales). Como mucho uno al día.
//
// Lo que cambian (todo por reglas, determinista por persona):
//   late    → parte de la gente llega tarde (sale «de camino» en la lista y entra después);
//   remote  → teletrabajo forzado para una parte (no gasta IA en decidirlo);
//   off     → de puente: no viene ni piensa con IA (ahorra tokens), sale «de puente»;
//   gather  → durante una franja, cada uno decide según su carácter si se junta en un sitio
//             (la tele de la zona chill, la terraza, la cocina) y deja de trabajar;
//   fakeWork→ todos en su mesa haciendo como que trabajan (sin escapadas);
//   phone   → los que tratan con clientes se pasan la mañana al teléfono;
//   deskQue → lo que hace quien sigue en su mesa (abanicarse con un informe…);
//   stats   → lo que le mueve a cada uno al enterarse (una vez), y su reacción según su carácter.
// La IA no decide qué pasa: lo lee en su prompt («Fuera: …») y reacciona a su manera.

const { rng } = require('./autopilot');
const { traits } = require('./incidents');

// Festivos: nacionales, Semana Santa y autonómicos (holidays.js).
const holidays = require('./holidays');
const HOLIDAYS = holidays.NATIONAL;

const pick = (list, r) => list[Math.floor(r() * list.length)];
const addDaysUTC = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const isHoliday = (day, region = null) => holidays.isHoliday(day, region);
const isSnow = w => !!w && ((w.code >= 71 && w.code <= 77) || w.code === 85 || w.code === 86);
const isDownpour = w => !!w && [63, 65, 81, 82].includes(w.code);

// ¿Hoy hace puente? Lunes antes de un martes festivo o viernes después de un jueves festivo.
function bridgeDay(day, weekday, region = null) {
  return (weekday === 1 && isHoliday(addDaysUTC(day, 1), region)) || (weekday === 5 && isHoliday(addDaysUTC(day, -1), region));
}

const CLIENT_ROLE = /cuenta|client|comercial|venta|account|negocio|atenci|soporte|customer/;

const CATALOG = [
  {
    kind: 'nevada', icon: '❄️', sign: 'NEVADA',
    // Si nieva de verdad donde está la oficina, casi seguro; con helada y algo de precipitación, a veces.
    chance: x => (isSnow(x.w) ? 0.9 : (x.w && x.w.temp <= 1 && x.w.precip > 0 ? 0.4 : 0)),
    titles: ['❄️ ¡Está nevando! La ciudad va a paso de pingüino y media oficina llega tarde.',
      '❄️ Nevada en la ciudad: autobuses parados, gente con botas de montaña y teletrabajo forzado.'],
    prompt: 'nieva: muchos llegan tarde, algunos teletrabajan a la fuerza y a mediodía hay guerra de bolas de nieve en la terraza',
    late: { share: 0.55, min: [20, 70], text: 'Atrapado en la nieve: el bus va a paso de pingüino' },
    remote: { share: 0.25, que: 'Teletrabajo forzado por la nieve: manta, portátil y chocolate' },
    gather: { place: 'terraza', at: s => [s.SCHEDULE.lunch - 100, s.SCHEDULE.lunch - 70], base: 0.6, que: 'Guerra de bolas de nieve en la terraza',
      frases: ['¡Toma ya!', '¡A la cara no, a la cara no!', 'Esto es la guerra.', 'Tengo nieve hasta en el alma.', '¡Muñeco de nieve con corbata!'] },
    end: '❄️ Se acaba la guerra de bolas: empate técnico, tres bufandas perdidas y un muñeco de nieve con corbata.',
    stats: { animo: 0.3, energia: -0.2 },
    react: {
      default: ['¡Nieva! Parezco un niño.', 'Hoy no se trabaja, se mira por la ventana.', '¿Esto cuaja?'],
      malaLeche: ['Odio la nieve. Odio a la gente que ama la nieve.', 'Ya verás el parte de mañana: todo hielo.'],
      torpe: ['Me he caído dos veces en la puerta. Dos.', 'He venido patinando sin querer.'],
      manitas: ['He echado sal en la entrada. De nada.', 'Las cadenas del coche, a la primera.'],
    },
  },
  {
    kind: 'ola_calor', icon: '🥵', sign: 'OLA DE CALOR',
    chance: x => (x.w && x.w.temp >= 34 ? 0.85 : (x.w && x.w.temp >= 30 && [7, 8].includes(x.month) ? 0.35 : 0)),
    titles: ['🥵 Ola de calor: fuera hay 40 grados y dentro se pelean por el sitio junto al aire.',
      '🥵 Aviso por calor extremo. La oficina entera se abanica con lo primero que pilla.'],
    prompt: 'ola de calor: todo el mundo derretido, peleas por el aire acondicionado y escapadas a la nevera a por helados',
    deskQue: 'Se abanica con un informe trimestral',
    gather: { place: 'cafe', at: s => [s.BLOCKS.tarde.from + 90, s.BLOCKS.tarde.from + 120], base: 0.7, que: 'Asaltando el congelador a por un polo',
      frases: ['¿Quién se ha comido mi polo de limón?', 'Me meto dentro del congelador.', 'Un helado y vuelvo a ser persona.'] },
    stats: { energia: -0.5, calma: -0.2 },
    react: {
      default: ['Me derrito.', 'Esto es un horno con wifi.', '¿Ponemos el aire a 18?'],
      malaLeche: ['Como alguien suba el aire a 25, me voy.', 'El que diga «es que es verano» se lleva un polo a la cabeza.'],
      torpe: ['Se me ha derretido el chocolate en el teclado.', 'He venido en chanclas. Error.'],
      manitas: ['He tuneado el ventilador: ahora gira en tres ejes.'],
    },
  },
  {
    kind: 'final_futbol', icon: '⚽', sign: 'HOY HAY FINAL',
    // Las finales gordas caen entre abril y julio, entre semana; fuera de eso, algún partidazo de copa.
    chance: x => (x.weekday >= 2 && x.weekday <= 4 ? ([4, 5, 6, 7].includes(x.month) ? 0.06 : 0.012) : 0),
    titles: ['⚽ ¡Esta noche es la final! Hay porra en la cocina y nadie piensa en otra cosa.',
      '⚽ Día de final: camisetas debajo de la camisa, porra en la nevera y la previa en la tele de la zona chill.'],
    prompt: 'esta noche es la final del fútbol: hay porra, todos opinan y la última hora nadie trabaja, están viendo la previa en la tele de la zona chill',
    // La zona chill es pequeña: la mitad lo ve desde la cocina, con la tele del móvil.
    gather: { place: 'descanso', at: s => [s.BLOCKS.tarde.to - 60, s.BLOCKS.tarde.to], base: 0.85, que: 'Viendo la previa en la tele de la zona chill',
      alt: { place: 'cafe', que: 'Viendo la previa en el móvil desde la cocina (en la zona chill no cabe nadie más)' },
      frases: ['¡Que empiece ya!', 'Eso era penalti clarísimo. (Es la repetición de ayer.)', '¿Quién ha puesto 7-0 en la porra?', '¡Uyyy!', 'Yo solo vengo por las patatas.'] },
    porra: true,
    end: '⚽ Se acaba la jornada: todos salen corriendo a ver la final. La porra sigue abierta en la nevera.',
    stats: { animo: 0.4, social: 0.3 },
    react: {
      default: ['¿Has echado la porra?', 'Yo digo 2-1 y no me muevo.', 'Hoy salgo puntual. Como sea.'],
      malaLeche: ['A mí el fútbol ni fu ni fa. Pero la porra la gano yo.', '¿Otra vez fútbol? Me voy a la terraza.'],
      torpe: ['He traído la camiseta del equipo equivocado.', 'He apostado por el equipo que no juega.'],
      manitas: ['He conectado la tele al proyector. De nada.', 'El cable HDMI lo he traído yo.'],
    },
  },
  {
    kind: 'noticia_gorda', icon: '📰', sign: 'ÚLTIMA HORA',
    chance: () => 0.04,
    variants: [
      { title: '📰 Última hora: el bar de abajo cierra por reforma un mes. Pánico en el open space.', prompt: 'el bar de abajo cierra un mes por reforma y todos están en shock pensando dónde van a desayunar' },
      { title: '📰 Sale en las noticias que la empresa de enfrente tiene tobogán. Todos comentando.', prompt: 'la empresa de enfrente sale en las noticias porque tiene tobogán y todos lo comentan con envidia' },
      { title: '📰 Han visto a un famoso en la cafetería de la esquina. Media oficina «baja a por un café».', prompt: 'han visto a un famoso en la cafetería de la esquina y todo el mundo inventa excusas para bajar' },
    ],
    gather: { place: 'cafe', at: (s, r) => { const a = s.BLOCKS.manana.from + 45 + Math.floor(r() * 120); return [a, a + 30]; }, base: 0.65, que: 'Comentando la noticia en la cocina',
      frases: ['¿Os habéis enterado?', 'Yo ya lo sabía.', 'Esto lo cambia todo.', 'No puede ser verdad.'] },
    stats: { social: 0.4, calma: -0.1 },
    react: {
      default: ['¿Lo habéis visto?', 'No se habla de otra cosa.', 'Ya está en el grupo de WhatsApp.'],
      malaLeche: ['Pues a mí me da igual. (Lo he leído tres veces.)', 'Seguro que es un bulo.'],
      torpe: ['Lo he reenviado al grupo de la familia sin querer.'],
      manitas: ['Lo he comprobado en tres fuentes. Es verdad.'],
    },
  },
  {
    kind: 'cliente_enfadado', icon: '📞', sign: 'CLIENTE ENFADADO',
    chance: x => (x.weekday === 1 ? 0.07 : 0.04), // los lunes, más
    titles: ['📞 Un cliente muy enfadado llama sin parar. «¡Quiero hablar con el responsable del responsable!»',
      '📞 Llega un correo con asunto en MAYÚSCULAS y tres signos de exclamación. El cliente está que trina.'],
    prompt: 'un cliente muy enfadado llama sin parar; los que llevan cuentas y clientes están al teléfono agobiados y el resto cuchichea',
    phone: { at: s => [s.BLOCKS.manana.from + 30, s.BLOCKS.manana.to - 30], que: 'Al teléfono con el cliente enfadado',
      frases: ['Sí, sí, le entiendo perfectamente.', 'Le paso con mi responsable… que soy yo.', 'Lo miro y le digo algo. Hoy. Seguro.'] },
    end: '📞 El cliente enfadado por fin cuelga. «Lo hablamos mañana». Lleva diciendo eso desde marzo.',
    stats: { calma: -0.2 },
    phoneStats: { calma: -0.9, energia: -0.3 },
    react: {
      default: ['¿Quién es ese señor que grita?', 'Shhh, que está con el cliente.', 'Mejor no le molestes hoy.'],
      malaLeche: ['Si me lo pasan a mí, le cuelgo.', 'Otro que no lee los correos.'],
      torpe: ['Le he cogido el teléfono sin querer. Error.'],
      manitas: ['Le he mirado el problema: era un cable suelto. Como siempre.'],
    },
    phoneReact: ['Me va a explotar la oreja.', 'Tercera llamada. Y son las diez.', 'Respira. Sonríe. Miente un poco.'],
  },
  {
    kind: 'inspeccion', icon: '📋', sign: 'INSPECCIÓN',
    chance: x => (x.weekday >= 2 && x.weekday <= 4 ? 0.02 : 0.01),
    titles: ['📋 ¡Viene una inspección! Todos haciendo como que trabajan y la cocina, recogida como nunca.',
      '📋 Hay un señor con carpeta en recepción. Nadie sabe quién es, pero por si acaso, todos a trabajar.'],
    prompt: 'hay una inspección: todos fingen trabajar muchísimo, la cocina está recogida como nunca y el inspector apunta cosas en una carpeta',
    fakeWork: { at: s => [s.BLOCKS.manana.from + 90, s.BLOCKS.manana.from + 210], que: 'Haciendo como que trabaja muchísimo',
      frases: ['Sí, sí, este informe es crucial.', 'Todo en orden, todo perfecto.', '¿Archivar? Archivo cada día.', '(teclea muy fuerte)'] },
    end: '📋 El inspector se va. La cocina vuelve a su caos natural en cinco minutos.',
    visitor: { name: 'Inspector', kind: 'inspector', avatar: { skinTone: 0, hairStyle: 1, hairColor: 5, clothes: 4, accessory: 1 },
      place: 'recepcion', que: 'Apunta cosas en una carpeta', frase: 'Ustedes sigan, como si no estuviera.' },
    stats: { calma: -0.4 },
    react: {
      default: ['¡Que viene, que viene!', 'Esconde el táper.', 'Pon cara de Excel.'],
      malaLeche: ['A mí que me inspeccione lo que quiera.', 'Me ha mirado mal. Le he mirado peor.'],
      torpe: ['He tirado la carpeta del inspector. Ya me conoce.', 'He saludado al inspector como si fuera mi tío.'],
      manitas: ['He escondido todos los cables detrás de una planta.'],
    },
  },
  {
    kind: 'huelga_transporte', icon: '🚇', sign: 'HUELGA DE TRANSPORTE',
    chance: x => (x.month === 8 ? 0 : (x.weekday === 1 || x.weekday === 5 ? 0.03 : 0.015)),
    titles: ['🚇 Huelga de metro y autobuses. Servicios mínimos y máximos retrasos.',
      '🚇 Hoy hay huelga de transporte: la gente llega en patinete, en bici o andando desde muy lejos.'],
    prompt: 'hay huelga de metro y autobuses: muchos llegan tarde y sudando, algunos teletrabajan y todos cuentan su odisea',
    late: { share: 0.5, min: [30, 90], text: 'Odisea por la huelga: andén lleno y patinete sin batería' },
    remote: { share: 0.25, que: 'Teletrabaja: sin metro no hay oficina' },
    stats: { calma: -0.4, energia: -0.3 },
    react: {
      default: ['He tardado hora y media. Hora. Y. Media.', '¿Tú cómo has venido?', 'Mañana vengo en bici. (No.)'],
      malaLeche: ['Servicios mínimos, paciencia mínima.', 'Me ha pisado medio Madrid.'],
      torpe: ['He cogido el bus en sentido contrario.', 'Me he dormido en el bus y he llegado al final de la línea.'],
      manitas: ['He venido en un patinete que me he fabricado.'],
    },
  },
  {
    kind: 'puente', icon: '🏖️', sign: 'DÍA DE PUENTE',
    // Festivo nacional en martes (lunes de puente) o en jueves (viernes de puente): pasa siempre.
    chance: x => (bridgeDay(x.day, x.weekday, x.region) ? 1 : 0),
    titles: ['🏖️ Día de puente: media oficina se ha cogido el día y la otra media mira sus mesas vacías.'],
    prompt: 'es día de puente: media oficina se ha cogido el día; los que han venido trabajan a medio gas y con envidia',
    off: { share: 0.5, que: 'De puente (pero contesta un correo desde la playa, por si acaso)' },
    deskQue: 'Trabaja a medio gas mirando las mesas vacías',
    stats: { animo: -0.2, calma: 0.3 },
    react: {
      default: ['Qué silencio, ¿no?', '¿Y los demás?', 'El año que viene me cojo el puente yo.'],
      malaLeche: ['Mientras ellos en la playa, yo con el Excel. Lo apunto.', 'Que no me escriban, que yo tampoco.'],
      torpe: ['Pensaba que hoy era festivo. Ya que estoy, me quedo.'],
      manitas: ['Hoy por fin arreglo la silla que cojea. Nadie me interrumpe.'],
    },
  },
  {
    kind: 'diluvio', icon: '☔', sign: 'DILUVIA',
    chance: x => (isDownpour(x.w) ? 0.7 : 0),
    titles: ['☔ Diluvia: la gente llega empapada y recepción parece una tienda de paraguas.'],
    prompt: 'diluvia: todos llegan empapados, hay paraguas chorreando en recepción y algún atasco por la lluvia',
    late: { share: 0.35, min: [10, 35], text: 'Esquivando charcos como en un videojuego' },
    stats: { animo: -0.2 },
    react: {
      default: ['Vengo empapado hasta los calcetines.', '¿Alguien tiene un secador?', 'Mi paraguas ha muerto en acto de servicio.'],
      malaLeche: ['El del coche que ha pisado el charco tiene que estar orgulloso.'],
      torpe: ['Me he dejado el paraguas en casa. Otra vez.', 'He resbalado en recepción. Con estilo.'],
      manitas: ['He montado un tendedero con clips en mi mesa.'],
    },
  },
  {
    kind: 'rumor_subida', icon: '🤫', sign: 'RUMOR',
    chance: () => 0.02,
    titles: ['🤫 Corre el rumor de que va a haber subida… de vales de café. Nadie habla de otra cosa.'],
    prompt: 'corre el rumor de que va a haber subida (de vales de café, nada serio); todos cuchichean y hacen cábalas en la cocina',
    gather: { place: 'cafe', at: (s, r) => { const a = s.BLOCKS.tarde.from + 30 + Math.floor(r() * 90); return [a, a + 25]; }, base: 0.55, que: 'Cuchicheando sobre el rumor de la subida',
      frases: ['Me lo ha dicho alguien que lo sabe.', '¿Vales de café dobles?', 'Yo no he dicho nada, ¿eh?'] },
    stats: { animo: 0.3, social: 0.3 },
    react: {
      default: ['¿Tú sabes algo?', 'Yo no me lo creo… pero ¿y si sí?', 'Shhh, que viene alguien.'],
      malaLeche: ['Lo creeré cuando lo vea.', 'Seguro que es otra taza con el logo.'],
      torpe: ['Lo he contado en voz alta en la reunión. Ups.'],
      manitas: ['He hecho una hoja de cálculo con todos los escenarios.'],
    },
  },
  {
    kind: 'loteria', icon: '🎄', sign: 'SORTEO DE NAVIDAD',
    // El 22 de diciembre, el sorteo de la Lotería de Navidad: siempre, si es laborable.
    chance: x => (x.day.slice(5) === '12-22' ? 1 : 0),
    titles: ['🎄 Sorteo de la Lotería de Navidad: la radio en la cocina, los décimos en la mano y los niños cantando.'],
    prompt: 'es el sorteo de la Lotería de Navidad: la radio suena en la cocina, todos miran su décimo y sueñan con el Gordo',
    gather: { place: 'cafe', at: s => [s.BLOCKS.manana.from + 30, s.BLOCKS.manana.from + 120], base: 0.6, que: 'Escuchando el sorteo con el décimo en la mano',
      frases: ['¡Ese número es el mío! Ah, no.', '¿Ha salido el Gordo?', 'Salud, que es lo que importa.', 'Si toca, no me veis más. (Es broma.)'] },
    stats: { animo: 0.4, social: 0.4 },
    react: {
      default: ['¿Has mirado el décimo?', 'Este año toca, lo noto.', 'Me ha tocado la pedrea. Me invito a un café.'],
      malaLeche: ['Yo no juego. (Juego tres décimos.)'],
      torpe: ['He perdido el décimo. Está en algún bolsillo.'],
      manitas: ['He montado un escáner de números con la webcam.'],
    },
  },
];
const BY_KIND = Object.fromEntries(CATALOG.map(d => [d.kind, d]));

// Contexto de reglas para un día: { day, weekday, month, w } (w = tiempo actual o null).
function dayContext(day, weekday, weather, region = null) {
  return { day, weekday, month: Number(day.slice(5, 7)), w: weather || null, region };
}

// El suceso de hoy (o null). Determinista por empresa y día: se mira en orden y gana el primero
// que sale (los que dependen del calendario o del tiempo van antes).
function rollDay(x, companyId) {
  // Lo seguro por calendario (el puente, el sorteo de Navidad) va siempre por delante.
  const sure = CATALOG.find(def => def.chance(x) >= 1);
  if (sure) return sure;
  const r = rng(`fuera|${companyId}|${x.day}`);
  for (const def of CATALOG) {
    const p = def.chance(x);
    if (p > 0 && r() < p) return def;
  }
  return null;
}

// Franja del día en que el suceso se nota (para la vista y el prompt).
function windowOf(def, sch, r) {
  const g = def.gather || def.fakeWork || def.phone;
  if (g) return g.at(sch, r);
  return [sch.BLOCKS.manana.from, sch.BLOCKS.tarde.to];
}

// Lo que se guarda al empezar: texto elegido, franja y el prompt.
function materialize(def, { companyId, day, sch }) {
  const r = rng(`fuera-txt|${companyId}|${day}|${def.kind}`);
  const v = def.variants ? pick(def.variants, r) : { title: pick(def.titles, r), prompt: def.prompt };
  const [from, to] = windowOf(def, sch, r);
  return { title: v.title, prompt: v.prompt, from_min: from, to_min: to };
}

// --- Lo que le toca a cada uno (determinista por suceso y persona) ---

const roll = (row, c, what) => rng(`fuera|${row.id}|${c.id}|${what}`)();

function lateMinutes(def, row, c) {
  if (!def.late || roll(row, c, 'tarde') >= def.late.share) return 0;
  const [a, b] = def.late.min;
  return a + Math.floor(roll(row, c, 'cuanto') * (b - a));
}

// 'remoto' (teletrabajo forzado), 'puente' (no viene) o null.
function modeFor(def, row, c) {
  if (def.off && roll(row, c, 'puente') < def.off.share) return 'puente';
  if (def.remote && roll(row, c, 'casa') < def.remote.share) return 'remoto';
  return null;
}

// ¿Se apunta a lo que se junta (la tele, la terraza, la cocina)? Según su vida social y su carácter.
function joins(def, row, c) {
  if (!def.gather) return false;
  const t = traits(c);
  let p = def.gather.base + (((c.stats && c.stats.social) ?? 3) - 3) * 0.08;
  if (t.malaLeche) p -= 0.3;
  if (t.torpe && def.kind === 'nevada') p += 0.15; // el torpe no se pierde una guerra de bolas
  return roll(row, c, 'va') < Math.max(0.05, Math.min(0.95, p));
}

// Los que se pasan la mañana al teléfono con el cliente: los de clientes y cuentas; si no hay
// ninguno, uno cualquiera (siempre el mismo).
function phoneCrew(def, row, chars) {
  if (!def.phone) return new Set();
  const role = c => `${c.position_title || ''} ${(c.ficha && c.ficha.puesto) || ''}`.toLowerCase();
  let crew = chars.filter(c => CLIENT_ROLE.test(role(c)));
  if (!crew.length && chars.length) crew = [chars.slice().sort((a, b) => roll(row, a, 'tel') - roll(row, b, 'tel'))[0]];
  return new Set(crew.slice(0, 3).map(c => c.id));
}

// Qué hace ahora por culpa del suceso (o null). mode: 'oficina' | 'remoto' (su día);
// own: 'remoto' | 'puente' | null (lo que le impuso el suceso); onPhone: si está en la tropa del teléfono.
function override(def, row, c, m, { mode, own = null, onPhone = false, lugar = 'mesa' } = {}) {
  const fr = list => list[Math.floor(roll(row, c, `fr${Math.floor(m / 10)}`) * list.length)];
  if (own === 'puente') return { que: def.off.que, frase: '' };
  if (mode !== 'oficina') return own === 'remoto' ? { que: def.remote.que } : null;
  const inWin = m >= row.from_min && m < row.to_min;
  if (def.fakeWork && inWin) return { lugar: 'mesa', con: null, que: def.fakeWork.que, frase: fr(def.fakeWork.frases) };
  if (def.phone && inWin && onPhone) return { lugar: 'mesa', con: null, que: def.phone.que, externo: 'el cliente enfadado', frase: fr(def.phone.frases) };
  if (def.gather && inWin && joins(def, row, c)) {
    const g = def.gather.alt && roll(row, c, 'sitio') < 0.5 ? def.gather.alt : def.gather;
    return { lugar: g.place, con: null, que: g.que, frase: fr(def.gather.frases) };
  }
  if (def.deskQue && lugar === 'mesa') return { que: def.deskQue };
  return null;
}

// Su reacción al enterarse, según su carácter: { text, stats }.
function reaction(def, row, c, { onPhone = false } = {}) {
  const r = rng(`fuera-r|${row.id}|${c.id}`);
  if (onPhone && def.phoneReact) return { text: pick(def.phoneReact, r), stats: def.phoneStats || def.stats || null };
  const t = traits(c);
  const own = ['malaLeche', 'torpe', 'manitas'].find(k => t[k] && def.react[k]);
  const list = own && r() < 0.75 ? def.react[own] : def.react.default;
  return { text: pick(list, r), stats: def.stats || null };
}

// La porra de la final: unas cuantas apuestas (sin IA).
function porra(row, chars) {
  const r = rng(`porra|${row.id}`);
  const who = chars.slice().sort((a, b) => roll(row, a, 'porra') - roll(row, b, 'porra')).slice(0, 4);
  if (!who.length) return null;
  const bets = who.map(c => `${c.name} ${Math.floor(r() * 4)}-${Math.floor(r() * 3)}`);
  return `⚽ La porra de la final: ${bets.join(', ')}. ${pick(['El bote: 12 euros y un donut.', 'Quien gane paga los cafés. (Así funciona aquí.)', 'Alguien ha apostado por un empate a siete.'], r)}`;
}

module.exports = {
  CATALOG, BY_KIND, HOLIDAYS, isHoliday, bridgeDay, dayContext, rollDay, materialize, windowOf,
  lateMinutes, modeFor, joins, phoneCrew, override, reaction, porra,
};
