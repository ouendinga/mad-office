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
- **Horario configurable** (admin, ⚙️ Oficina): entrada, salida, hora y duración de la comida. Por
  defecto 9-18 con una hora para comer a las 14:00 (el de Álvaro). La mañana va de la entrada a la
  comida, la tarde empieza comiendo, los trayectos son la media hora antes y después.
- **Horas extra:** cualquier turno que planifica la tarde puede pedirlas (máx. 1 día por semana por
  reglas); quien se queda sigue 2 horas más, cansa más y vuelve a casa al acabar.

### Contrato del directo (`world`, por socket)

```
clock: { date, hhmm, weekday, block, dreamOpen, nextMorning,
         phase: 'casa' | 'ida' | 'oficina' | 'vuelta',          // media hora antes de entrar / después de salir
         weather: { temp, code, desc, precip, wind, isDay } | null,
         season: 'invierno' | 'primavera' | 'verano' | 'otono',
         city }
characters[]: { id, name, owner_user_id, avatar_config, desk_index, humor, energia, cafe, model,
         mode: 'oficina' | 'remoto' | 'ida' | 'vuelta' | 'casa',
         x, y, lugar, que, action, representation, bubble,      // x/y solo con mode 'oficina'
         call: { with: <id> | null, externo: <texto> | null } | null,
         trayecto: <texto> | null,                               // con mode 'ida'/'vuelta'
         stats: { energia, animo, saciedad, social, calma },     // 0-5, un decimal
         eat: { style, food } | ausente,                         // comiendo (eating.js)
         talk: { group, speaking, to } | ausente }               // en una conversación (chatter.js)
```

## Empresas (2026-11-14)

Varias empresas por instalación: cada grupo o cliente la suya, con su oficina (ciudad, horario),
su organigrama, su feed y su simulación. Decisiones de Álvaro:
- **Un personaje distinto por persona y empresa.** El avatar es de la persona (el mismo en todas).
- **Cualquiera con cuenta crea una empresa** y es su admin.
- **Entrar:** con invitación (enlace con caducidad y número de usos) o pidiéndolo a una empresa
  **pública** (opcionalmente a un cargo concreto); el admin acepta. Las privadas no se ven.
- **Organigrama en árbol.** Para ocupar un cargo no hace falta que el de encima esté ocupado. Hay cargos
  únicos (CEO…) y con plazas. Los huecos los ocupan **ficticios**, que se retiran cuando entra una
  persona y vuelven si se va. **Solo los C-suite ficticios piensan con IA**; el resto, en piloto automático.
- **Cargo único ocupado:** se le pide a quien lo tiene; si acepta, os intercambiáis los cargos.
- **Carga de trabajo: solo la marca el admin** (por día: tranquila, normal, alta, a tope, con nota).
  Las horas extra solo pueden darse con carga alta o a tope.
- **Teletrabajo por empresa:** días por semana (0-5) y días de oficina obligatorios.
- **Tablón «Se busca personal»:** vacantes de las empresas públicas que lo activen (lo decide el
  admin), con una oferta de broma que la IA escribe una sola vez por vacante.
- **Visitantes por reglas, sin IA:** repartidor (paquete para alguien), mantenimiento y limpieza.
- **Abrirlo a gente de fuera** (enlace mágico por correo) depende del estudio de viabilidad
  (`docs/negocio/estudio.md`): de momento, para Walmeric y colegas.

### Entrar sin la contraseña común (2026-11-14, como en Preventa)

La web publicada lleva delante la contraseña común de los paneles de Álvaro (`gate.js`), que **no se
le da a nadie**. Para compartirla:
- **Enlace de invitación** («Invitar» en la cabecera, o Ajustes → Invitaciones): quien lo abre se salta la puerta, ve a qué empresa
  le invitan y crea su cuenta **con contraseña propia** (mín. 8). Sin invitación no se crea cuenta
  desde fuera.
- **«Ya tengo cuenta»** en la puerta: correo + su contraseña. 5 fallos por IP → 15 min de espera.
- Quien tiene sesión (token de 30 días) ya no ve la puerta: la sesión basta, también en el directo.
- Sin contraseña propia (Álvaro, el primero) se entra solo con el correo, **pero solo tras la puerta**.
- Al compartir el enlace por WhatsApp sale una tarjeta con logo (`og.png`); la web es `noindex`.

### Modo pruebas (solo el dueño)

Para probar sin esperar a un día laborable. Lo ve solo `users.is_admin` (el primero que se registró)
en las empresas que lleva, botón «🧪 Pruebas»:
- **Reloj de la empresa:** saltar a una hora (en el día laborable más cercano), +1 h, velocidad
  ×1-×60 y volver a la hora real. Se guarda en `companies.settings.reloj = {realAt, officeAt, speed}`;
  las demás empresas siguen con la hora real. La oficina lo avisa («🧪 reloj de pruebas»).
- **Jugadores de prueba** (máx. 12 por empresa): cuentas inventadas (`users.is_test`, correo
  `@pruebas.invalid`, no pueden entrar por login) con personaje ya aprobado y la ficha de un ficticio.
  **Sin IA por defecto** (`characters.sin_ia`, piloto automático, gratis); se puede encender.
  «Entrar como» para jugar con su cuenta; una barra arriba lleva de vuelta a la del dueño.
- **Escenas:** repetir la transformación (con su avatar y SUS respuestas guardadas en
  `characters.interview`; «termina» sola a los 7 s) y la de «¡Contratado!». Sin IA ni despertador:
  sirve para ver si los motivos salen bien sin tener que rehacer la entrevista.

### API

Fuera de una empresa: `GET /api/me` (persona + `companies[]` con rol, personaje y cargo) ·
`PUT /api/me/avatar` · `POST /api/companies {name, visibility}` · `GET /api/public/companies` ·
`GET /api/jobs` (tablón) · `POST /api/companies/:cid/join {position_id?, message}` ·
`GET|POST /api/invitations/:code` · `POST /api/auth/register {email, name, password?, invite?}` ·
`POST /api/auth/login {email, password?}` · `PUT /api/auth/password {password}`.

Dentro (`/api/companies/:cid`, solo miembros; ⭐ = solo admin):
`GET /` · ⭐`PUT / {name, visibility, settings: {remotePerWeek, officeDays, jobBoard}}` ·
`GET /org` · ⭐`POST|PUT|DELETE /org/positions[/:id] {title, parent_id, csuite, is_unique, seats, place}` ·
`GET /org/requests` · `POST /org/requests {position_id}` · `POST /org/requests/:id {accept}` ·
`GET /workload` · ⭐`PUT|DELETE /workload/:day {level 0-3, note}` ·
⭐`GET|POST|DELETE /invitations` · ⭐`GET /join-requests` · ⭐`POST /join-requests/:id {accept}` ·
`GET|PUT /settings/location` (⭐ PUT) · `GET|PUT /settings/hours` (⭐ PUT) ·
`GET /feed` · `GET /characters/:id` · `GET /characters/:id/history` · `GET /turns/:id` ·
`/me`: `GET /` · `POST /position {position_id}` (409 `code: 'ocupado'`) · `POST /interview` ·
`PUT /ficha` · `PUT /settings` · `GET|PUT /dream` · `POST /dream/help` · `GET /usage`.
Modo pruebas (solo el dueño, admin de la empresa): `GET /pruebas` ·
`PUT /pruebas/reloj {hhmm, day:'laborable'} | {plus} | {speed} | {reset}` ·
`POST /pruebas/jugadores {name?, position_id?, ia?}` · `PUT|DELETE /pruebas/jugadores/:uid` ·
`POST /pruebas/jugadores/:uid/entrar` (token del jugador).

Directo: `io(..., { auth: { token, companyId } })`; `world` trae además `company {id, name}` y, en
cada personaje, `position {id, title, csuite}`, `npc` y, en los visitantes, `visitor {kind, forId}`.

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
| 3b. Oficina viva v2: zoom por salas, calle, teletrabajo, llamadas, oír de cerca, pensamientos, estados, tiempo real, horario, horas extra | ✅ 2026-11-14 |
| 3c. Empresas: varias por instalación, invitaciones, organigrama con ficticios, tablón, carga de trabajo, visitantes | ✅ 2026-11-14 |
| 4. Conector A: claves de API cifradas y endpoint compatible con OpenAI (Globant) | pendiente |
| 3d. Entrar por invitación con contraseña propia (sin la común), modo pruebas del dueño, logo y favicon | ✅ 2026-11-14 |
| 5. Abrir a gente de fuera: enlace mágico por correo y un despertador por persona que solo resuelva sus turnos | pendiente (la invitación con contraseña propia ya permite invitar a compis sin dar la común) |
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

## Pedido el 2026-11-15, por hacer

- ✅ (incidentes y eventos, 2026-11-16) **Sitcom:** que entretenga como una serie. Cosas que pasan fuera provocan cosas en la oficina y
  los personajes reaccionan a su manera. Ejemplos: corte de luz, nevada, final del fútbol, una
  noticia, un cliente enfadado o una inspección. Ver cómo encaja con el ahorro de tokens: el
  suceso lo elige una regla y la IA solo lo usa en el turno que ya hace.
- ✅ **La espera de la ficha como una transformación** (estilo Sailor Moon): `Transformacion.js`.
  Las respuestas, por palabras clave (`engine/motifs.js`), dan motivos en pixel art («montaña» →
  montaña) que giran alrededor de la silueta; al llegar la ficha, fogonazo y «¡X ha nacido!».
- ✅ **¡Contratado!** Al aprobar la ficha por primera vez: escena en casa, la noticia llega por carta,
  SMS, correo o paloma mensajera (al azar), con empresa y cargo, y se anuncia en la oficina
  («📰 X se incorpora a … como …»). Sin IA.
- ✅ **Que no actúen todos a la vez:** el piloto automático usa una plantilla común (todos llegan a
  las 9:00 en punto, café a las 10:30…). Ritmo propio por persona (sacado de la ficha), orden
  que cambia cada día y aforo por sala. Fase 0 de `doc/disenador-de-oficinas.md`.
- ✅ («Tu vista», 2026-11-16) **La lupa = lo que ve y oye TU personaje:** te sigue, enseña solo su sala y a quien oye
  (`hearing.js`), cada uno en su sitio real (hoy salen 14 apilados). Fase 0.
- ✅ (huecos por sala y aforo) **Posiciones:** las zonas de estar se montan sobre los muebles (Carmen sale encima del
  mostrador de recepción). Puntos por mueble y aforo. Fase 0.
- ✅ (Sistemas pasa por servidores; canaleta de cables) **Servidores:** nunca hay nadie (el piloto la sortea 1 de cada 4 a las 12:15, y la IA casi no
  la elige) y las «3 rayas de colores» (`cable_floor`) no se entienden como cables: dibujarlas
  como canaleta con su caja, o quitarlas.
- ✅ **Varias oficinas y diseñador de oficinas:** estudio en `doc/disenador-de-oficinas.md`.
- **«¡A la oficina!» no le metió en la oficina (dueño, 2026-11-15):** no se reproduce en la pila
  de pruebas con el mismo camino; se vuelve a mirar en la revisión de flujos.
- ✅ **Ritmo (2026-11-15):** el piloto automático da a cada uno su hora de café, de comida y de
  salidas, y su sitio según el cargo. Cada cuarto de hora hay escapadas cortas sin IA
  (`world/micro.js`), y partidas de ping-pong y de consola.
- ✅ (primera tanda, 2026-11-16: `world/incidents.js`, `events.js`, `officeLife.js`) **Incidentes con estado (la sitcom, concretada el 2026-11-15):** un catálogo de sucesos con su
  probabilidad y su causa. Cada suceso cambia el ESTADO de un objeto o de una sala; el cambio se
  ve en el mapa, los demás lo perciben (entra en lo que «oyen» y en sus prompts) y dura hasta que
  se arregla, o cambia la forma de usar ese sitio. Ejemplos:
  - La máquina de refrescos se estropea. Hay que llamar al técnico, que llega como visita al día
    siguiente; hasta entonces va con un cartel de «no funciona» y la gente la aporrea.
  - X cocina mal y la lía con el micro. La cocina «huele»: se pinta una nube verde, dura N
    minutos, y quien llega después reacciona.
  - Alguien abre la ventana y el viento se lleva los pósits del panel. El panel queda vacío hasta
    que alguien los recoloca.
  - Alguien con mala leche (o con prisa) le mueve los pósits a otro.
  - La impresora se atasca, se va la luz, se acaba el café, se inunda el baño…

  Las reglas deciden qué pasa (dado + probabilidad + quién está), con tabla y tope por día. La IA
  solo lo usa en el turno que ya hace. Estado persistente: tabla `office_state(company_id,
  object, state, since, until, cause)`.
- ✅ (2026-11-16, `world/eating.js`) **Que se les vea comer de verdad**, cada uno con su estilo: el
  servidor decide si come y cómo (rápido, a bocaditos, táper, palillos, se mancha, con el móvil, habla
  con la boca llena, bocata) por su ficha, sus rasgos y su id; el sprite tiene bocado, masticado
  (mofletes) y su ritmo, migas y vaho. Pendiente: otras animaciones con estilo propio.
- ✅ (2026-11-16, `world/chatter.js`) **Que se vea que hablan:** conversaciones sin IA entre quienes
  están juntos (corrillos de 2-4 en las salas, visitas a la mesa, ping-pong, consola): bocadillos
  alternos de 2-4 frases con las muletillas, los incidentes abiertos, los eventos y el tiempo; ritmo
  de oficina (silencios de 30-80 s). Al feed (`charla`) solo una línea por conversación con tema y
  como mucho una por sitio cada 45 min; la oye quien estaba en la sala (`hearing.js`).
- ✅ (Loft, Clásica, Cubículos, Planta grande) **Plantillas de oficina:** más y menos lujo, capacidad y espacios, incluida una de **cubículos**
  de las de antes. Ver `doc/disenador-de-oficinas.md`.
- **Revisión de UX/UI y de flujos:** `doc/revision-ux-2026-11-15.md`.
- ✅ (afterwork de los viernes, taller, team building, cumpleaños; el admin los crea en Empresa → Eventos) **Eventos de oficina en la terraza** (pedido el 2026-11-16): afterworks, talleres, team building…
  Algunos salen solos por reglas (el viernes por la tarde, un cumpleaños) y otros los configura el
  admin desde un calendario: qué, cuándo y dónde. Van con los incidentes con estado: los
  personajes se enteran, van o no según su carácter, y lo comentan.
- ✅ (2026-11-16) **Incidentes, segunda tanda:** 20 tipos con varias versiones de texto (nevera, wifi, planta,
  fluorescente, paquete, obras, mosca, perro, fuente, calefacción) e indicadores de ánimo en la lupa.
  ✅ (2026-11-16) Que la IA proponga incidentes pequeños que una regla valide: ver «Percances que
  propone la IA» más abajo.
- ✅ (2026-11-16, `world/outside.js`) **Sucesos de FUERA que revolucionan la oficina:** como mucho uno al
  día, tirado por reglas a las 08:00 con datos reales (tiempo de Open-Meteo, día de la semana, época,
  festivos nacionales) y guardado en `office_outside` (migración 008). Catálogo y probabilidad por día:

  | Suceso | Cuándo | Qué cambia |
  |---|---|---|
  | ❄️ Nevada | 90 % si nieva (WMO 71-77, 85-86); 40 % con ≤ 1 °C y precipitación | 55 % llega tarde (20-70 min), 25 % teletrabajo forzado, guerra de bolas en la terraza antes de comer |
  | 🥵 Ola de calor | 85 % con ≥ 34 °C; 35 % con ≥ 30 °C en julio-agosto | se abanican en la mesa, asalto al congelador a media tarde; el aire se rompe más |
  | ⚽ Final de fútbol | 6 % martes-jueves de abril a julio; 1,2 % el resto | porra por la mañana; la última hora, la previa en la tele de la zona chill (y la mitad, en la cocina) |
  | 📰 Noticia gorda | 4 % | media hora comentándola en la cocina (3 versiones) |
  | 📞 Cliente enfadado | 7 % los lunes, 4 % el resto | los de clientes/cuentas, al teléfono toda la mañana y estresados |
  | 📋 Inspección | 2 % martes-jueves, 1 % el resto | dos horas todos en su mesa «como que trabajan», sin escapadas; el inspector en recepción; la cocina reluce |
  | 🚇 Huelga de transporte | 3 % lunes y viernes, 1,5 % el resto (nunca en agosto) | 50 % llega tarde (30-90 min), 25 % teletrabaja |
  | 🏖️ Puente | siempre: lunes antes de martes festivo o viernes tras jueves festivo | la mitad no viene (ni gasta IA); el resto, a medio gas |
  | ☔ Diluvio | 70 % con lluvia fuerte (WMO 63, 65, 81, 82) | 35 % llega tarde (10-35 min); paraguas en recepción |
  | 🤫 Rumor de subida (de vales de café) | 2 % | cuchicheos en la cocina por la tarde |
  | 🎄 Lotería de Navidad | siempre el 22 de diciembre | la radio en la cocina con el sorteo |

  Lo seguro por calendario va primero; el resto, en ese orden con un dado por empresa y día. Cada
  uno reacciona a su manera (frases por rasgo: mala leche, torpe, manitas) y le mueve el pentágono
  una vez. Se ve en el mapa (arte propio y carteles), en «Ahora en la oficina», en el feed (kind
  `fuera`, que oye todo el mundo, también desde casa) y en el prompt («Fuera pasa algo gordo: …»,
  una línea). El modo pruebas los provoca («Que pase hoy»).
- ✅ (2026-11-16) **Percances que propone la IA:** en el turno de plan que ya se hace, el JSON admite un
  campo opcional `incidente` { tipo, hora, texto } con un tipo de un catálogo cerrado de 8 percances
  que le pasan a él (café en el teclado, nevera abierta, silla que baja, cable pisado, persiana,
  maceta, grapadora, palomitas quemadas). `gameMaster.validateIncidentProposal` decide al recibirlo
  (hora de un momento de su plan y en el sitio de ese percance, objeto en el plano, no en casa,
  carácter: lo de torpes al que no lo es le pasa la mitad de los días y la ficha que lo contradice
  lo veta; el texto es dato: sin temas sensibles, insultos, enlaces, órdenes al sistema ni nombres de
  otros) y `incidents.canStartSmall` al llegar la hora (4 por oficina y día, 1 por persona, no
  repetido, sitio abierto). Sin llamadas nuevas: ~30 tokens más por turno.
- ✅ (2026-11-16) **Qué se ve de los demás:** de otro personaje, solo lo que se nota desde fuera (puesto,
  personalidad, manías, muletillas, «se le nota cansado»); su objetivo, diario, números, pensamientos y
  sueños, solo su dueño y quien lleva la empresa. Lo decide el servidor (`routes/office.js`).
- **Revisión de legibilidad del pixel art (2026-11-16):** hechos canaleta de cables, taza y planta,
  silla, indicadores de ánimo en la rejilla de 32, rubor según la piel, rótulos al zócalo y
  sombrilla. ✅ (16-11) sombra de los árboles sin aro (la sombra y las hojas caídas se pintan tras
  el contorno: opciones `shadow` y `after` de `def`), lámpara del jefe en la esquina de la mesa,
  sillas de reuniones de frente arriba y por detrás abajo (`prepareObjects` marca la fila de debajo
  de la mesa), urinario alto con tubería frente al lavabo ancho con pie, palas con mango y red con
  cinta y postes, y la escala: el lienzo va a la resolución del dispositivo y la escala se redondea
  a píxeles enteros del dispositivo (medios en px CSS con devicePixelRatio 2); si eso encoge el
  mapa más de un 15 %, se amplía a entero y se reduce con suavizado («sharp bilinear», `drawCrisp`).
  Pendiente: la lupa sin indicadores de ánimo.
