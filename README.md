# Mad Office

Oficina pixel art donde cada compañero tiene un personaje de IA que vive solo, en clave de
comedia: trabaja, cotillea, hace tratos y escribe su diario sin guion. Su dueño solo puede
**susurrarle un sueño cada noche** (de 18:00 a 09:00, máximo 200 caracteres). Por la mañana,
el personaje decide si le hace caso.

El diseño completo y sus decisiones están en [doc/oficina-viva.md](doc/oficina-viva.md).

## Publicada

<https://mad-office.alvarosolis.dev>, detrás de la contraseña común de los paneles. Cómo se
publica: [deploy/README.md](deploy/README.md). Para que los personajes piensen allí:
`./despertador/arrancar.sh --prod`.

## Arrancarlo (local)

Hace falta Docker y, para que los personajes piensen, Claude Code con tu suscripción.

```bash
cp .env.example .env
# Rellena DB_PASSWORD, JWT_SECRET y RUNNER_TOKEN (cada .env.example dice cómo generarlos)
docker compose up -d --build
./despertador/arrancar.sh          # déjalo abierto en horario de oficina
```

Abre <http://localhost:8081>. **El primero que se registra es el admin**, y luego el registro se
cierra (`ALLOW_REGISTRATION=true` para abrirlo). Por ahora, entrar solo pide el correo:
**no lo expongas a Internet** hasta que exista el enlace mágico. Por eso solo escucha en
`127.0.0.1`.

## Cómo funciona

- **Reloj**: hora real de Madrid, de lunes a viernes. La mañana va de 09:00 a 14:00, la tarde de
  14:00 a 18:00 y el resto es noche.
- **Simulación** (`backend/src/world/sim.js`): mueve a todos según su plan. Andar, ánimo y
  café son reglas que no gastan nada.
- **La IA solo planifica**, en 3 turnos al día por personaje: *despertar* (con el sueño y la
  decisión de hacerle caso), *tarde* y *diario*. Además, bajo demanda, la *ficha* (entrevista)
  y la *ayuda para el sueño*.
- **Game Master por reglas** (`backend/src/world/gameMaster.js`): todo lo que devuelve la IA
  pasa por él (horas, lugares, compañeros, longitudes). La IA propone y las reglas deciden.
- **Piloto automático**: sin IA (turno en cola, despertador apagado o tope gastado), el
  personaje sigue una rutina por reglas. La oficina nunca se para.
- **El despertador** (`despertador/`) corre en tu máquina, recoge los turnos y los resuelve
  con `claude -p` (Haiku por defecto). Tu sesión de Claude no sale de tu ordenador.
- **Tope de gasto** diario por persona (`DAILY_CAP_USD`, 0,25 $ por defecto), aplicado en el
  servidor. Los cuatro compañeros ficticios (Marisa, Paco, Lucía y Toni) los paga el admin.

**Coste medido** (2026-11-11, Haiku): ~2.000 tokens de entrada y ~550 de salida por turno de
plan, **≈0,006 $**, y la ficha ≈0,005 $. Con 3 turnos al día salen unos 0,02 $ por personaje y
día.

## Probar sin gastar

```bash
# Reloj acelerado en el .env: CLOCK_SPEED=60 (1 min real = 1 h de oficina)
# y CLOCK_START=2026-11-16T08:58:00+01:00
./despertador/arrancar.sh --fake    # respuestas de mentira con la forma correcta
```

## Verificación

```bash
cd backend && npm test                      # reloj, Game Master y piloto automático
```

El e2e registra un usuario, y el primero de una base vacía se queda de admin. **No lo pases
contra tu oficina**: levanta una pila aparte con su propio `.env` (otro `RUNNER_TOKEN`,
`PORT=8082` y `ALLOW_REGISTRATION=true`):

```bash
docker compose -p mad-office-pruebas --env-file pruebas.env up -d --build
RUNNER_TOKEN=… MAD_OFFICE_URL=http://localhost:8082 node despertador/despertador.js --fake &
cd tests && BASE_URL=http://localhost:8082 npx playwright test
docker compose -p mad-office-pruebas --env-file pruebas.env down -v   # al acabar
```

## Estructura

```
backend/db/migrations/   esquema (se aplica solo al arrancar)
backend/src/world/       reloj, lugares, simulación, Game Master y piloto automático
backend/src/ai/          prompts + esquemas JSON, cola de turnos
backend/src/routes/      auth, me (personaje, ficha, sueño, gasto), office, runner
despertador/             el conector de suscripción (claude -p)
frontend/src/            React + canvas (tiles reutilizados; personajes 32x32 en engine/Character.js)
tests/e2e/               Playwright
```
