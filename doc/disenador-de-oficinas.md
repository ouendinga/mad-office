# Diseñador de oficinas: estudio

> Pedido el 2026-11-15: varias oficinas para elegir (salas en otros sitios, con otras formas y
> aforos) y un diseñador para dibujar paredes, suelos, tamaños de salas y muebles. Es un
> desarrollo grande. Aquí está el estudio previo; todavía no hay nada construido.

## Qué hay hoy

| Pieza | Dónde | Problema para tener varias oficinas |
|---|---|---|
| Mapa: rejilla 40×26 (`#` pared, `.` suelo, `D` puerta, `,` exterior, `=`), 10 salas con suelo y color de pared, 103 objetos de unos 42 tipos, 16 mesas y zonas de estar | `frontend/src/assets/maps/office.json` | Ya son datos, pero solo hay un mapa y va metido en el bundle |
| Mesas y zonas, **copiadas** | `backend/src/world/places.js` (`DESKS`, `ZONES`) | Son constantes duplicadas; un test comprueba que coincidan con el mapa |
| Dónde se coloca cada persona | `zonePos`/`zoneSpot`: un rectángulo por sala | Las zonas se montan sobre los muebles (Carmen sale pintada encima del mostrador de recepción) y no tienen aforo |
| La lupa (la sala vista de frente) | `frontend/src/engine/RoomScenes.js`: 10 escenas **dibujadas a mano**, cada una con sus huecos | Con otra planta o con salas nuevas no hay escena |
| Sitios que entiende la IA | `PLACES` en `places.js`, que entra en el prompt y en el esquema JSON | Es un vocabulario fijo, y eso está bien: hay que conservarlo |

## Idea

Una oficina es un **documento de datos** (JSON) y todo se deriva de él: el mapa, los
puntos donde se ponen las personas, el aforo, la lupa y lo que la IA puede elegir.

- **Tipos de sala fijos** (`mesa`/open space, `cafe`, `reuniones`, `descanso`, `terraza`,
  `recepcion`, `despacho`, `servidores`, `lavabo`). Se pueden dibujar donde se quiera, con la
  forma y el tamaño que se quiera, y se pueden repetir (por ejemplo, dos salas de reuniones).
  La IA sigue eligiendo del mismo vocabulario y una regla decide cuál de las dos le toca.
- **Catálogo de muebles con metadatos.** Cada tipo dice:
  - qué casillas ocupa y si bloquea el paso;
  - qué **puntos** da (`sentado` o `de pie`, y en qué casilla); por ejemplo, una mesa da una
    silla, una barra de café da 3 puntos de pie y un sofá da 2 asientos;
  - cómo se pinta en el mapa y cómo se pinta de frente en la lupa.
- **Aforo = puntos.** El aforo de una sala es el número de puntos que dan sus muebles,
  no un rectángulo. Nadie se pone encima de un mueble.
- **La lupa sale de los datos.** Se proyecta la sala:
  - la pared del fondo se pinta con su color y lleva sus cuadros y ventanas;
  - los muebles van por filas, según su fondo;
  - cada persona ocupa su punto real.

  Así el mapa y la lupa coinciden siempre. Coste: las escenas a mano son más bonitas.
  Se pueden conservar como «decorado especial» de las salas de las plantillas.
- **Validación por reglas, en el servidor** (la IA no interviene). Una oficina solo se
  publica si:
  - todo es alcanzable desde la entrada (búsqueda en anchura por las casillas);
  - hay mesas para todos los puestos;
  - tiene al menos open space y café;
  - las puertas están en paredes;
  - el tamaño tiene un tope (por ejemplo, 80×60 casillas y 600 objetos).

## Modelo de datos

- Tabla `office_layouts`:
  - columnas `id`, `company_id` (NULL = plantilla), `name`, `data JSONB`, `version`,
    `created_by`, `created_at`;
  - en `companies`: `layout_id`.
- `data`: `{ cols, rows, grid[], rooms[{id, kind, x, y, w, h, floor, wall}], objects[{type, x, y, rot}] }`.
  Las mesas y los puntos **no se guardan**: se calculan a partir de los objetos.
- El backend deja de usar `DESKS`/`ZONES` y lee la oficina de su empresa (con caché).
  Se van `places.test.js` y su sincronización a mano.
- **Cambiar la oficina con gente dentro.** El cambio se publica como versión nueva y se aplica
  en el cambio de bloque, o esa noche. Las mesas se reasignan por orden y nadie se queda sin
  sitio.

## El diseñador (en la app)

- **Herramientas:** pared, suelo (con su textura), puerta, exterior; sala (rectángulo con tipo
  y nombre); poner, mover, girar y borrar muebles desde el catálogo; deshacer y rehacer.
- **Panel de avisos en vivo:** «la cocina no tiene salida», «faltan 3 mesas para 16 puestos»,
  «aforo del café: 4».
- **Vista previa** con personas de prueba moviéndose, que aprovecha el modo pruebas que ya
  existe. Botón «Publicar».
- **Plantillas de partida:** Loft (unas 8 personas), Clásica (la actual, unas 16), Cubículos (oficina de las de antes) y Planta
  grande (unas 30). Se elige al crear la empresa o en sus ajustes, y se puede copiar para
  editarla.
- **Solo el admin de la empresa.**
- **Móvil.** Elegir plantilla y ver la oficina, 100 % en móvil. Dibujar con el dedo una
  rejilla de 40 casillas a 360 px no es usable, así que el editor completo sería de escritorio y en
  móvil quedaría en solo lectura. ⚠️ Es una excepción a la norma «móvil primero» y la tiene
  que aprobar Álvaro.

### Alternativas descartadas

- **Tiled / LDtk (editores externos):** son buenos para que NOSOTROS hagamos las plantillas,
  pero un jugador no técnico no los va a usar. Como mucho, un importador para las plantillas.
- **Plantillas fijas sin editor:** sale barato y da «varias oficinas», pero no resuelve lo de
  dibujar. Es la fase 2 de abajo, así que no se pierde nada.

## Fases

| Fase | Qué | Tamaño |
|---|---|---|
| 0 | En el mapa actual: puntos por mueble y aforo (nadie encima de un mueble); piloto automático con ritmo propio por persona y aforo; la lupa sigue a tu personaje y enseña solo su sala y a quien oye | 1–2 días |
| 1 | La oficina como datos en la base: `office_layouts`; el backend lee la de su empresa; fuera las constantes | 1–2 días |
| 2 | Las 3 plantillas (Loft, Clásica, Planta grande) hechas en JSON; elegir en crear empresa y en ajustes | 2–3 días |
| 3 | Lupa generada a partir de los datos (proyección), con las escenas a mano como decorado opcional | 2–3 días |
| 4 | Diseñador MVP: paredes, suelos, puertas, salas, catálogo, validación, vista previa y publicar | 1–2 semanas |
| 5 | Pulido: girar muebles, colores por sala, copiar plantillas, quizá varias plantas | según uso |

La fase 0 vale por sí sola y no se tira nada después: los puntos por mueble son la base del
catálogo de la fase 4.

## Preguntas para Álvaro

1. ¿Los tres tamaños de plantilla (8 / 16 / 30) están bien?
2. ¿Un editor solo de escritorio, con el móvil en solo lectura, es aceptable?
3. Al cambiar la oficina con gente dentro: ¿se aplica al momento o por la noche?

## Hecho (2026-11-16)

- **Fases 1 y 2.** El plano es dato de cada empresa: `backend/src/layouts/<id>.json`, leído con
  `world/layout.js`, guardado en `companies.settings.oficina` y servido por `GET /oficina`. Las
  funciones de `places.js` reciben el plano. El navegador lo pide con `canvas/plan.js`. Hay
  cuatro plantillas:
  - Clásica, 16 mesas, hecha a mano;
  - Loft, 8 mesas;
  - Cubículos, 12 mesas, con mamparas;
  - Planta grande, 30 mesas.

  Las tres últimas salen de `tools/planos.py`, que comprueba que nadie quede sobre una pared;
  `test/oficinas.test.js` comprueba que todo se alcanza desde la entrada.
- **Galería «Oficinas».** Botón en la cabecera, con miniaturas, mesas y salas de cada plano.
- **Mudanza.** Sustituye a la pregunta «¿se aplica al momento o por la noche?»: el cambio es un
  día de mudanza.
  - La tarde de antes se empaqueta (cajas por la oficina).
  - Esa mañana van por la calle con cajas y un camión en la puerta. Cada uno lleva algo y pasan
    sucesos (`world/mudanza.js`).
  - Al salir de casa ya cambia el plano, y desempaquetan hasta la hora de comer.
  - Quien no tiene mesa en la nueva teletrabaja.
  - En modo pruebas, «Verla ya».
- **Decidido por Álvaro:** el diseñador será solo para ordenador; en el móvil, la oficina se ve
  pero no se edita.

- **Fase 3 (lupa).** Ya no es una escena dibujada aparte: es un zoom de la oficina real, así que
  sirve con cualquier plano y cada persona sale en su sitio. «Tu vista» sigue a tu personaje y deja
  en penumbra lo que queda fuera de su sala. `engine/RoomScenes.js` se ha quedado sin uso.
- **Fase 4 (diseñador).** Es `pages/Designer.js`, solo para ordenador: en el móvil, la oficina se
  ve pero no se edita.
  - **Herramientas:** sala (arrastrando: pone paredes y suelo), mueble (catálogo de unos 50),
    mover, borrar, pared, suelo, puerta y exterior.
  - **Edición:** deshacer, cambiar el tamaño, renombrar salas y cambiarles el suelo.
  - **Validación en vivo** desde el servidor (`world/planCheck.js`), con frases legibles («No se
    puede entrar en «X»: ponle una puerta», «Una mesa no tiene sitio libre detrás…»). Con errores
    no se puede guardar.
  - **Qué se deduce del dibujo:** las mesas, los huecos de cada sala, el sillón del jefe y el
    mostrador, y los sitios para las escapadas.
  - **Guardado:** en la tabla `office_plans`, con identificador `p<n>`. Para usarla se programa una
    mudanza.
  - **Desde la galería:** «Empezar en blanco», «Copiar y editar» cualquier plantilla, y editar o
    borrar las propias (no la vuestra actual ni aquella a la que os mudáis).

  El validador encontró dos puertas tapadas en las plantillas (el kanban del Loft y la encimera de
  la Planta grande), ya arregladas.

- ✅ (2026-11-16) **Girar muebles.** Se giran sobre su centro la alfombra, la mesa de reuniones, el
  ping-pong y la mampara; el resto se dibuja de frente y lo dice al intentarlo. **Color de pared por
  sala** desde el panel. **Miniaturas** de cada mueble en el catálogo. Suelos con nombre en español.
