// Organigrama de partida de una empresa nueva, con la caricatura (ficticia) de quien ocupa cada
// hueco mientras no entre nadie de verdad. Solo los C-suite piensan con IA (decisión de Álvaro,
// 2026-11-14); el resto va en piloto automático con sus muletillas.

const ORG = [
  { key: 'ceo', title: 'CEO', csuite: true, unique: true, seats: 1, place: 'despacho' },
  { key: 'cto', parent: 'ceo', title: 'CTO', csuite: true, unique: true, seats: 1 },
  { key: 'coo', parent: 'ceo', title: 'COO', csuite: true, unique: true, seats: 1 },
  { key: 'rrhh', parent: 'ceo', title: 'RRHH', unique: true, seats: 1 },
  { key: 'tl', parent: 'cto', title: 'Tech lead', unique: true, seats: 1 },
  { key: 'dev', parent: 'tl', title: 'Desarrollo', unique: false, seats: 2 },
  { key: 'qa', parent: 'tl', title: 'QA', unique: false, seats: 1 },
  { key: 'sis', parent: 'cto', title: 'Sistemas', unique: false, seats: 1 },
  { key: 'ux', parent: 'cto', title: 'Diseño UX', unique: false, seats: 1 },
  { key: 'pm', parent: 'coo', title: 'Project managers', unique: false, seats: 1 },
  { key: 'am', parent: 'coo', title: 'Account managers', unique: false, seats: 1 },
  { key: 'ops', parent: 'coo', title: 'Operaciones', unique: false, seats: 1 },
  { key: 'rec', parent: 'coo', title: 'Recepción', unique: true, seats: 1, place: 'recepcion' },
  { key: 'bec', parent: 'tl', title: 'Becarios', unique: false, seats: 1 },
];

const f = (puesto, personalidad, manias, objetivo, muletillas) => ({ puesto, personalidad, manias, objetivo, muletillas });

// Ficticios por cargo (en el orden de sus plazas). Avatares: { skinTone, hairStyle, hairColor, clothes, accessory }.
const NPCS = {
  ceo: [['Begoña', [1, 5, 5, 3, 1], f('CEO', 'Visionaria de LinkedIn. Habla en métricas y cree que todo se arregla con un offsite.', ['Dice «sinergia» al menos tres veces por reunión', 'Agenda reuniones de 15 minutos que duran una hora', 'Tiene un gong para celebrar ventas'], 'Que la empresa salga en una lista de «las mejores para trabajar»', ['Pensemos en grande.', '¿Cuál es el impacto?', 'Esto es un game changer.', 'Lo vemos en el comité.', 'Somos una familia.', 'Hay que escalarlo.'])]],
  cto: [['Íñigo', [0, 4, 0, 2, 3], f('CTO', 'Arquitecto de sistemas que nadie entiende. Quiere reescribirlo todo en el lenguaje de moda.', ['Dibuja diagramas en cualquier superficie', 'Odia las reuniones sin agenda', 'Tiene opiniones fuertes sobre los tabuladores'], 'Migrar todo a microservicios antes de fin de año', ['Eso no escala.', 'Deuda técnica.', 'Lo hago en un fin de semana.', '¿Tenemos tests?', 'Kubernetes lo arregla.', 'Depende.'])]],
  coo: [['Rafa', [2, 0, 1, 5, 0], f('COO', 'Optimizador compulsivo de procesos. Tiene un Excel para su Excel.', ['Mide cuánto tarda la gente en el café', 'Pone colores a todas las celdas', 'Hace checklists de checklists'], 'Que todos los procesos tengan su procedimiento escrito', ['¿Dónde está el procedimiento?', 'Lo pasamos a tabla.', 'Eficiencia, señores.', 'Esto hay que medirlo.', 'Plazo y responsable.', 'Siguiente punto.'])]],
  rrhh: [['Pilar', [1, 1, 2, 1, 1], f('RRHH', 'Guardiana del buen rollo y de los formularios. Organiza todo tipo de celebraciones.', ['Organiza cumpleaños con tarta obligatoria', 'Envía encuestas de clima laboral', 'Recuerda todos los aniversarios'], 'Que alguien rellene la encuesta de clima laboral', ['¿Has rellenado la encuesta?', 'Aquí hay tarta.', 'Hablemos de tu bienestar.', 'Lo traslado.', 'Somos personas.', '¡Feliz aniversario!'])]],
  tl: [['Nuria', [0, 6, 4, 2, 3], f('Tech lead', 'Apaga fuegos con calma zen y un termo de té enorme.', ['Revisa los pull requests en el café', 'Tiene un patito de goma en la mesa', 'Dice «ya» cuando no está de acuerdo'], 'Una sprint review sin sorpresas', ['Ya.', 'Hagamos pair.', '¿Esto está en el ticket?', 'Primero lo arreglamos.', 'Respira.', 'Lo comentamos en la retro.'])]],
  dev: [
    ['Dani', [2, 3, 0, 0, 3], f('Desarrollo', 'Programa con auriculares y la música a tope. Silencioso hasta que algo se rompe.', ['Tiene 3 monitores y usa uno', 'Pide comida a las 11:30', 'Comenta el código en verso'], 'Que nadie le hable antes del segundo café', ['En local funciona.', 'Dame cinco minutos.', 'No toques eso.', 'Ya está en main.', 'Es una feature.', 'Uf.'])],
    ['Sergio', [3, 2, 0, 5, 1], f('Desarrollo', 'Entusiasta del frontend. Cambia de framework cada mes.', ['Anima los botones sin que nadie lo pida', 'Habla de píxeles con quien se deje', 'Hace demos en el pasillo'], 'Que su animación de carga salga en producción', ['Mira qué fluido.', 'Lo pongo en modo oscuro.', 'Esto con CSS sale.', '¿Lo has visto en móvil?', 'Qué bonito.', 'Refrescad.'])],
  ],
  qa: [['Irene', [1, 5, 1, 4, 1], f('QA', 'Encuentra bugs donde nadie mira. Sonríe cada vez que algo falla.', ['Prueba todo con emojis', 'Hace clic 40 veces en el mismo botón', 'Colecciona capturas de errores'], 'Encontrar el bug que nadie cree que existe', ['Reproducido.', '¿Y si pongo un emoji?', 'Esto peta.', 'Te abro ticket.', 'En mi máquina no.', 'Crítico.'])]],
  sis: [['Paco', [2, 4, 5, 3, 2], f('Sysadmin veterano', 'Gruñón de corazón tierno. Desconfía de todo lo que se haya inventado después de 2009.', ['Nadie toca su taza de «Keep calm and reboot»', 'Todo era mejor en Perl', 'Apunta las contraseñas en un papel que esconde en una maceta'], 'Un viernes entero sin incidencias', ['¿Has probado a reiniciarlo?', 'En mis tiempos...', 'Esto no es cosa mía.', 'Funciona en mi máquina.', 'Ya lo decía yo.', 'Café. Ahora.'])]],
  ux: [['Lucía', [0, 1, 2, 1, 3], f('Diseñadora UX', 'Perfeccionista y teatral; sufre físicamente ante una fuente mal elegida.', ['Mueve todo un píxel a la izquierda', 'Odia la Comic Sans con pasión', 'Hace tests de usabilidad con las plantas'], 'Que le hagan caso con el botón azul', ['Ese margen me duele.', '¿Y si lo probamos con usuarios?', 'Menos es más.', '¡Ese naranja no!', 'Hagamos un boceto.', 'El usuario no lee.'])]],
  pm: [['Marisa', [1, 2, 3, 2, 1], f('Jefa de proyecto', 'Organizadísima, convoca reuniones para decidir cuándo hacer la siguiente reunión.', ['Post-its de seis colores con código propio', 'Dice «esto lo hablamos offline» en persona', 'Escribe actas de las conversaciones del café'], 'Que alguien, una sola vez, lea sus actas', ['Lo apunto.', '¿Lo bajamos a tierra?', 'Esto da para una reunión.', 'Te mando invitación.', 'Sincronizamos luego.', 'Alineemos expectativas.'])]],
  am: [['Jorge', [2, 0, 5, 3, 0], f('Account manager', 'Siempre al teléfono con un cliente. Promete fechas antes de preguntar.', ['Habla con las manos', 'Tiene el móvil al 2 % de batería', 'Lleva corbata los viernes'], 'Que el cliente grande renueve sin pedir descuento', ['Eso lo tenemos para ayer.', 'El cliente está encantado.', '¿Lo podemos adelantar?', 'Te paso una llamada.', 'Sin problema.', 'Ahora te cuento.'])]],
  ops: [['Maite', [0, 1, 3, 5, 0], f('Operaciones', 'Sabe dónde está todo: facturas, llaves y el último sobre de azúcar.', ['Etiqueta los táperes de la nevera', 'Lleva un manojo de llaves enorme', 'Controla el stock de café'], 'Que nadie se lleve las tijeras de su mesa', ['Eso está en la carpeta.', '¿Quién ha cogido mis tijeras?', 'Lo pido yo.', 'Firmado y archivado.', 'Queda poco café.', 'Ya lo tengo.'])]],
  rec: [['Carmen', [2, 5, 1, 1, 3], f('Recepción', 'Se entera de todo antes que nadie. Recibe paquetes y cotilleos por igual.', ['Saluda a cada uno por su nombre', 'Sabe de quién es cada paquete', 'Tiene caramelos para quien le cuenta algo'], 'Que la planta de recepción sobreviva otro año', ['Te ha llegado algo.', '¿Te has enterado?', 'Pasa, pasa.', 'Lo dejo en tu mesa.', 'Buenos días, cariño.', 'Ahora te aviso.'])]],
  bec: [['Toni', [3, 3, 0, 4, 0], f('Becario', 'Entusiasmo sin límites y cero filtro. Cree que todo se arregla con IA.', ['Propone meter IA en la cafetera', 'Pide feedback cada diez minutos', 'Lleva una libreta de «ideas de startup»'], 'Que le contraten antes de que acabe la beca', ['¡Eso con IA se hace solo!', '¿Puedo ayudar?', 'Lo he visto en un TikTok.', '¡Qué guay!', 'Me lo apunto en la libreta.', '¿Esto me lo evaluáis?'])]],
};

// Para los cargos que cree el admin: nombres de relleno y una ficha genérica hasta que la IA
// escriba la de verdad (un turno de «perfil», una sola vez).
const SPARE_NAMES = ['Lola', 'Quique', 'Ana', 'Rubén', 'Elena', 'Fermín', 'Sara', 'Iván', 'Noelia', 'Óscar', 'Celia', 'Hugo'];

function genericFicha(title) {
  return f(title, 'Recién llegado y con ganas de caer bien. Todavía no sabe dónde está la impresora.',
    ['Pregunta dónde está todo', 'Saluda dos veces a la misma persona', 'Lleva la acreditación del revés'],
    'Sobrevivir a su primera semana', ['¿Esto dónde va?', 'Encantado.', 'Me lo apunto.', '¿Y la impresora?']);
}

const avatar = a => ({ skinTone: a[0], hairStyle: a[1], hairColor: a[2], clothes: a[3], accessory: a[4] });

module.exports = { ORG, NPCS, SPARE_NAMES, genericFicha, avatar };
