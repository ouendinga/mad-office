# Oficina viva: personajes autónomos y sueños

> Giro del producto decidido el 2026-11-11. Inspiración: el experimento Sandia Village
> de Sandiabyte (un pueblo de vecinos-IA a los que su creador solo puede «susurrar» de noche).
> Aquí el escenario es la oficina, y los personajes son **la gente de la oficina**.

## El tono: es para reírse

Es **entretenimiento**: comedia de oficina, no una simulación seria. Cada personaje es la
caricatura cariñosa de su dueño: sus manías exageradas, sus frases, su rivalidad con la
impresora. El prompt pide **situaciones cómicas y absurdas**, nunca humillaciones ni temas
sensibles (salud, sexo, política, salarios reales, despidos). El feed se escribe para
leerlo con un café y reírse («Jose Luis lleva 3 h negociando un táper con Carlos»).

## Qué cambia

**Se puede rehacer desde cero** (decisión de Álvaro, 2026-11-11). Lo de antes (el MVP del
hackathon, `specs.md`, `SPECSv2.md`, el ROADMAP de StarMeUp y los ánimos simulados de
Jira, correo y calendario) deja de mandar. Solo se reutiliza lo que sirva: el motor de
tiles y cámara, el generador de avatares y el tiempo real por Socket.io. Cada compañero
tiene un personaje que vive solo en la oficina pixel art: trabaja, habla, hace tratos,
se pelea y escribe un diario. Nadie le escribe el guion.

## Que no haya que saber nada (prioridad máxima, junto con el ahorro)

La juega gente de la oficina que **no sabe configurar nada**. La regla: entrar y tener
personaje en **menos de 5 minutos, sin leer instrucciones**.

- **Sin configurar por defecto**: el administrador conecta **una sola vez** el modelo de
  la oficina (por ejemplo, el GLM o el Qwen de Globant, si la política lo permite). Los
  demás solo entran con su correo y ya está: no ven la palabra «API» en ningún sitio.
- **Entrada por enlace mágico** que llega al correo. Nada de contraseñas.
- **Recorrido guiado** de tres pasos: avatar → entrevista divertida → «tu personaje se
  despierta mañana a las 9». Nada más.
- **«Usar mi propia IA»** es opcional y está escondido en Ajustes. Si se usa, se hace con
  un asistente de pasos con capturas («Abre openrouter.ai → Keys → Crear → pégala aquí»),
  un botón **«Probar»** que confirma que funciona y errores en lenguaje humano («esta clave
  no tiene saldo», no un `401`).
- **El despertador (suscripciones) es la opción avanzada**: un instalador de un clic o un
  único comando copiable, que se conecta solo con un código de 6 cifras de la app (como
  emparejar una tele). Si es complicado para alguien, no lo usa: tiene las otras vías.
- **El sueño por correo** existe precisamente por esto: contestar a un correo lo sabe
  hacer todo el mundo. Cada tarde a las 18:00 llega «¿Qué quieres que sueñe esta noche?»
  y basta con responder.
- Ayuda contextual con humor en cada pantalla, y un «no sé qué poner» que rellena con
  propuestas.

## Fuentes

| Dato | Fiabilidad | Fuente |
|---|---|---|
| Mecánica de Sandia: ficha, bloques del día, Game Master, susurro entre 21:00 y 09:00, salud, hambre y monedas, prensa real cada mañana | ✅ | <https://sandiabyte.com/sandia-village/> (consultada el 2026-11-11) |
| Su Beta 1 (21 agentes, 7 días) costó 99 $ de modelo | ✅ | reel <https://www.instagram.com/reel/De2Ig-BNoTI/> |
| La suscripción de Claude **no** se puede usar en apps de terceros | ✅ | [The Register, 2026-02-20](https://www.theregister.com/2026/02/20/anthropic_clarifies_ban_third_party_claude_access) |
| Pro y Max traen un crédito mensual para uso programático con `claude -p` o el Agent SDK, cobrado a precio de API (Pro, 20 $) | 🔶 | [The Decoder](https://the-decoder.com/claude-subscriptions-get-separate-budgets-for-programmatic-use-billed-at-full-api-prices/), [InfoWorld](https://www.infoworld.com/article/4171274/anthropic-puts-claude-agents-on-a-meter-across-its-subscriptions.html); falta la página oficial de Anthropic |
| «Sign in with ChatGPT» existe, pero solo para apps socias (16 al lanzarse, el 2026-09-29) | 🔶 | [IT Brief](https://itbrief.co.uk/story/openai-launches-chatgpt-sign-in-for-16-partner-tools) |
| La capa gratuita de Gemini puede entrenar con los datos fuera del EEE; dentro del EEE, hay que comprobarlo | 🔶 | [apidog](https://apidog.com/blog/gemini-api-free-tier/); por confirmar en las condiciones de Google |

## Decisiones de producto (2026-11-11)

1. **Sustituir** los ánimos simulados por agentes autónomos.
2. **Acceso**: solo la gente de la oficina tiene cuenta. Los observadores externos entran
   como **visitantes** con un enlace de sesión **caducable** (solo lectura, tiempo limitado),
   que crea un miembro.
3. **Cada uno paga su personaje** con lo que tenga: clave de API (OpenRouter, Anthropic,
   OpenAI o Google), **su suscripción** (Claude, ChatGPT o Google) o **el modelo interno
   gratuito de la empresa** (en Globant hay GLM o Qwen; falta saber cuál exactamente).
   **Prioridad máxima: gastar los mínimos tokens posibles.**
4. **Ritmo**: horario laboral real, de lunes a viernes. El sueño se escribe de noche.
5. **El sueño** se manda desde la app **o por correo**, y la app **ayuda a escribirlo**
   para que sea coherente con la vida del personaje.

## Cómo paga cada personaje: dos conectores

Las suscripciones no se pueden enchufar a nuestro servidor: Anthropic lo prohíbe y OpenAI
solo lo permite a sus socios. Por eso hay dos caminos.

### A. Clave de API (en el servidor)

- La persona pega su clave en su panel. Se guarda **cifrada** (AES-GCM con una clave maestra
  en una variable de entorno) y **nunca vuelve al navegador**: el panel solo enseña `sk-…abcd`.
- Proveedores: OpenRouter (recomendado: una clave sirve para cualquier modelo barato, y la
  persona pone allí su propio tope), Anthropic, OpenAI y Google.
- El servidor hace las llamadas con un modelo pequeño elegido por la persona.
- **Endpoint compatible con OpenAI** (URL base + clave + modelo): con esto vale cualquier
  servidor que hable el formato de OpenAI, como el GLM o el Qwen internos de Globant, Ollama
  o vLLM. ⚠️ Antes de conectarlo, hay que confirmar que la **política interna de Globant**
  permite usarlo para un proyecto personal y desde fuera de su red. Si solo se llega desde
  la VPN, solo sirve el conector B: el despertador llama al endpoint desde el portátil del
  trabajo.

### B. Suscripción (con un «despertador» en su ordenador)

- Un programa pequeño, `mad-office-despertador`, corre en el ordenador de la persona.
  Pregunta al servidor si su personaje tiene turno pendiente, lo resuelve con **la
  herramienta oficial** de su suscripción y devuelve la respuesta en JSON.
  - Claude: `claude -p` con un modelo pequeño. Consume el crédito programático del plan (🔶).
  - ChatGPT: `codex exec` (🔶: comprobar las condiciones antes de darlo por bueno).
  - Google: Gemini CLI con su cuenta (🔶: lo mismo).
- La credencial **no sale nunca de su máquina**: el servidor solo ve prompts y respuestas.
- Encaja con el horario: el personaje trabaja cuando el ordenador del trabajo está encendido.
- `claude -p` arrastra ~48k tokens de contexto por llamada, así que va **un turno por
  bloque del día, no uno por acción**, y con las herramientas desactivadas.

### Si no hay IA disponible

Sin clave, sin despertador encendido o con el tope gastado, el personaje **no se para**:
sigue una rutina por reglas (va a su mesa, al café, a las reuniones) y la oficina dice
«anda en piloto automático». Nunca se gasta de la clave de otro.

## El día del personaje

| Bloque | Hora | Qué hace | Llamadas al modelo |
|---|---|---|---|
| Despertar | 09:00 | Lee su diario, el sueño de anoche y las noticias de la oficina. **Decide si hace caso al sueño** y por qué. Planifica el día. | 1 |
| Mañana | 09:00–14:00 | Trabaja, se mueve, habla con quien se cruza y propone tratos. | 1–2 (en lote) |
| Comida | 14:00–15:00 | Come, cotillea. | 0–1 |
| Tarde | 15:00–18:00 | Sigue, cierra tratos y conflictos. | 1–2 |
| Diario | 18:00 | Escribe el diario del día. Es su memoria. | 1 |
| Noche | 18:00–09:00 | Duerme. **Se abre la ventana del sueño.** | 0 |

Objetivo de diseño: **≤ 6 llamadas por personaje y día**, con un tope de gasto diario
configurable que **corta en el servidor** (si llega al tope, piloto automático).
Referencia: Sandia salió a ~0,67 $ por agente y día (cálculo: 99 $ / 21 / 7) con más
actividad, fines de semana incluidos y un modelo mayor. El tope por defecto se fija al
medir la primera semana real, sin suponer nada.

### Ahorro de tokens (prioridad máxima)

- **Todo lo que sea movimiento lo deciden las reglas**: caminar, sentarse, ir al café,
  animaciones y ánimo. Eso no gasta nada. La IA solo pone **intención y palabras**.
- **Un turno por bloque y en lote**: una llamada devuelve el plan del bloque entero
  (3–6 acciones y frases cortas) en JSON compacto, no una llamada por acción.
- **Conversaciones en una sola llamada**: cuando dos personajes se cruzan, una llamada
  escribe el intercambio entero (2–4 líneas). Paga uno de los dos, por turnos.
- **Prompt corto y estable**: la ficha resumida (≤ 300 tokens) va primero, para
  aprovechar la caché del proveedor. Se usa el diario de ayer (≤ 150 tokens), nunca el
  historial entero.
- **Salidas con tope** (`max_tokens` bajo) y formato JSON fijo.
- **Frases de relleno sin IA**: muletillas y reacciones salen de una lista por personaje
  generada **una sola vez** al crear el perfil.
- Medidor visible por personaje: tokens y coste de hoy, de la semana y su tope.

**Game Master por reglas (código, no IA)**: valida cada acción contra el mapa y el estado
(no puede estar en dos sitios, no gasta monedas que no tiene, no entra en una sala ocupada)
y corrige o descarta lo imposible. La IA propone y las reglas deciden.

**Estado del personaje**: energía, ánimo, café, prestigio y «monedas» de la oficina
(favores). La ficha tiene nombre, puesto, personalidad, manías, un objetivo vital y
relaciones con los demás.

## Crear el perfil: asistente divertido

Nadie sabe escribir una buena ficha en blanco, así que la app **entrevista** a la persona:

1. 6–8 preguntas rápidas y con gracia, casi todas de elegir: «¿Qué haces cuando se cae
   producción?», «¿Tu relación con la máquina de café?», «Una manía que todos te
   conocen», «¿Qué quieres conseguir en la oficina?» (por ejemplo, ser jefe, que nadie te
   toque la silla o ganar la porra).
2. Con las respuestas, **una sola llamada** genera la ficha caricaturizada, el objetivo
   vital y las muletillas de relleno.
3. La persona lee la ficha, la retoca y la **aprueba**. Sin su aprobación, el personaje
   no existe.
4. Puede regenerarla, pero con un número de intentos limitado, para no quemar tokens.

## El sueño

- **Uno por noche y personaje**, de 200 caracteres como máximo, entre las 18:00 y las 09:00. Solo puede mandarlo
  el dueño del personaje.
- **Desde la app**: un panel nocturno con el diario del día del personaje al lado.
- **Por correo**: un buzón propio (`suenos@<dominio>`). El remitente tiene que ser el correo
  verificado del dueño; si no, se descarta y se registra. El sueño queda en estado
  «recibido» y se confirma con una respuesta.
- **Asistente del sueño**: con el diario y la ficha, propone 2 o 3 sueños coherentes o
  pule el que se ha escrito («tu personaje odia el café: esto no le cuadra»). Gasta de la
  clave o la suscripción **del dueño**.
- Al despertar, el personaje **decide si le hace caso**. Lo deja escrito en el diario y su
  dueño lo ve («soñé que debía hablar con Carlos… no me fío»).

## Visitantes

- Un miembro crea un enlace de visita con caducidad (por ejemplo, 2 h o 24 h) y, si quiere,
  un número de usos.
- Solo lectura: mapa, burbujas y feed. **No ve** los diarios, los sueños ni las fichas
  privadas.
- Se puede revocar en cualquier momento. Queda registrado quién lo creó y cuándo se usó.

## Seguridad y personas reales

- Los personajes representan a **compañeros reales**: cada uno escribe y aprueba su propia
  ficha y puede pausar o borrar su personaje. No se usan datos reales de trabajo (nada de
  Jira ni de correo).
- El prompt del personaje prohíbe inventar hechos sobre la vida real de los compañeros:
  todo pasa dentro de la oficina ficticia.
- Las claves van cifradas y nunca salen al cliente. Los topes se aplican en el servidor.
  El texto que llega del sueño se trata como **dato del personaje**, nunca como instrucción
  del sistema.

## Oficina viva v2 (pedido del 2026-11-14)

Lo que pidió Álvaro: zoom por salas (vista de frente), que cada uno **solo oiga lo que pasa cerca**,
cosas en el **trayecto** a casa, **teletrabajo** (y que se vea), llamadas entre los de casa y los de la
oficina, llamadas con **gente de fuera** (clientes), **tiempo real** (lluvia, frío, calor, estación)
según **dónde esté la oficina** (lo elige él), **historial** de su personaje (conversaciones, cosas que
le pasan y **pensamientos**, que se ven distintos) y un **pentágono de estados** de 0 a 5 con decimales.

Decisiones por defecto (cambiables):
- **Nada de llamadas nuevas a la IA.** Todo cabe en los turnos que ya existen: el despertar (ahora a las
  08:30, antes de salir de casa) decide dónde trabaja hoy y cuenta el trayecto de ida; el diario cuenta
  el de vuelta; cada plan puede llevar 1-2 pensamientos y llamadas. Coste estimado: unos 80 tokens de
  salida más por turno (≈ +0,0004 $), a medir.
- **Teletrabajo:** lo decide el personaje al despertar, con tope por reglas (máx. 2 días por semana).
- **Oír:** un personaje solo recibe en su prompt lo que se dijo en el mismo sitio a la vez que él estaba
  allí, lo que le dijeron a él y sus llamadas. El open space cuenta como un sitio.
- **Pensamientos:** solo los ve el dueño del personaje.
- **Estados (0-5):** energía, ánimo, saciedad, social y calma. Café aparte. Los mueven reglas según lo
  que hace (comer, reunirse, terraza, trabajar…) y el humor que da la IA.
- **Tiempo:** Open-Meteo (sin clave) desde el servidor cada 30 min; la ubicación la pone el admin.

### Contrato del directo (`world`, por socket)

```
clock: { date, hhmm, weekday, block, dreamOpen, nextMorning,
         phase: 'casa' | 'ida' | 'oficina' | 'vuelta',          // ida 08:30-09:00, vuelta 18:00-18:30
         weather: { temp, code, desc, precip, wind, isDay } | null,
         season: 'invierno' | 'primavera' | 'verano' | 'otono',
         city }
characters[]: { id, name, owner_user_id, avatar_config, desk_index, humor, energia, cafe, model,
         mode: 'oficina' | 'remoto' | 'ida' | 'vuelta' | 'casa',
         x, y, lugar, que, action, representation, bubble,      // x/y solo con mode 'oficina'
         call: { with: <id> | null, externo: <texto> | null } | null,
         trayecto: <texto> | null,                               // con mode 'ida'/'vuelta'
         stats: { energia, animo, saciedad, social, calma } }    // 0-5, un decimal
```

## Fases de implementación

Alcance actual (decisión del 2026-11-11): **solo Álvaro**, con su suscripción de Claude (Haiku o
Sonnet) y **sueños solo desde la app**. Lo demás llega después.

| Fase | Estado |
|---|---|
| 0. Limpieza del MVP | ✅ 2026-11-11 |
| 1. Núcleo: ficha, bloques, Game Master por reglas, diario, piloto automático | ✅ 2026-11-11 |
| 1b. Asistente de perfil (entrevista → ficha editable) | ✅ 2026-11-11 |
| 2. El sueño en la app, con su asistente | ✅ 2026-11-11 |
| 3. Conector B, el despertador con `claude -p` (solo Claude) | ✅ 2026-11-11, con un solo despertador (el del admin) |
| 4. Conector A: claves de API cifradas y endpoint compatible con OpenAI (Globant) | pendiente |
| 5. Varios jugadores: enlace mágico, un despertador por persona que solo resuelve sus turnos | pendiente |
| 6. Visitantes con enlace caducable | pendiente |
| 7. El sueño por correo | aparcado (Álvaro: «iremos mejorando») |
| 8. Codex y Gemini en el despertador (antes, confirmar sus condiciones) | pendiente |

Coste medido el 2026-11-11 (✅, llamadas reales con Haiku y la configuración mínima de
`claude -p`: sin herramientas, sin ajustes ni CLAUDE.md y sin razonamiento): ~2.000 tokens de
entrada y ~550 de salida por turno de plan, **≈0,006 $**. Por personaje, unos 0,02 $ al día.

## Pendiente de decidir

- Quiénes son (nombres y puestos) y el consentimiento de cada uno.
- Qué modelo interno hay en Globant (GLM o Qwen), si es compatible con OpenAI, si se llega
  a él desde fuera de la VPN y si su política deja usarlo para esto.
- La dirección y el dominio del buzón de sueños.
- Dónde se despliega: el roadmap decía Fly.io, pero la norma de la casa es el VPS propio con
  Coolify.
