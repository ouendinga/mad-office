# Mad Office — Roadmap

> De MVP de hackathon a oficina virtual con reconocimiento social.
> Inspiración visual: WorkAdventure. Inspiración social: StarMeUp.
> Tiempos estimados con asistencia de AI. Sin fechas fijas.

---

## Visión

Mad Office combina dos ideas que hoy van separadas:

1. **Oficina virtual espacial** — ver a tu equipo en un mapa pixel art, moverse, interactuar por proximidad.
2. **Red social de reconocimiento** — dar estrellas, feedback, celebrar logros. Cultura de equipo visible.

> "StarMeUp te dice cómo está tu equipo. Mad Office te lo muestra."

---

## Estado actual (post-hackathon)

### Lo que funciona
- Landing + auth por email (sin password) + JWT
- Generador de avatares por capas (cuerpo, ropa, pelo, accesorios)
- Canvas 800×600 con 8 escritorios, sala de reuniones, zona de descanso, lavabo
- Sistema de ánimo bipolar (5 ejes, 0-10) con eventos mock
- Acciones automáticas (sentado, corriendo, reunido, paseando...) con movimiento interpolado
- Representaciones visuales (llorando, enfadado, ZZZ, nubes...)
- Chat en tiempo real + reacciones emoji flotantes
- Rankings de estado de ánimo
- Reloj virtual acelerado
- WebSocket para sincronización en tiempo real

### Lo que falta (carencias principales)
- **Rendering procedural**: todo se dibuja con `fillRect`/`arc`, sin texturas ni spritesheets
- **Sin control manual**: el usuario es espectador, no puede mover su avatar
- **Mapa fijo**: 800×600, 8 escritorios hardcodeados, sin scroll ni zoom
- **Sin walk animation**: los avatares se deslizan, no caminan
- **Sin profundidad visual**: todo plano, sin z-sorting ni oclusión
- **Sin customización de entorno**: oficina fija, no editable
- **Sin capa social**: no hay reconocimiento entre usuarios, ni perfiles ricos
- **Sin integraciones reales**: 100% datos mock
- **Onboarding inexistente**: usuario nuevo no entiende qué hacer
- **Mobile roto**: no responsive

---

## Fases

### Fase 0 — Motor gráfico
**Duración estimada: 2-3 semanas**
**Impacto: transformador — de demo a aplicación**

El cambio más visible. Reemplazar el rendering procedural por un sistema basado en tiles y spritesheets.

| Tarea | Detalle | Esfuerzo |
|-------|---------|----------|
| Sistema de tilemap | Motor que carga un JSON de mapa + PNG de tileset y renderiza por capas (suelo, paredes, objetos, decoración). Compatible con formato Tiled. | ~3 días |
| Spritesheet de avatares | Pre-renderizar los avatares como spritesheets con frames de animación: idle (2 frames), walk (4 frames × 4 direcciones), sentado, celebrando. Base 32×32 píxeles. | ~3 días |
| Assets base | Crear tileset de oficina: suelo madera/baldosa, paredes, escritorios, sillas, plantas, ventanas. Pixel art 16×16 por tile. Se puede partir de assets libres y customizar. | ~2 días |
| Cámara con scroll | Viewport que sigue al avatar del usuario. Mapa más grande que la pantalla. Zoom controlado. | ~1 día |
| Z-sorting | Ordenar elementos por coordenada Y para que objetos cercanos tapen a los lejanos. Avatares detrás de mesas, etc. | ~1 día |
| Refactor del render loop | Separar en capas: background tiles → furniture → avatars → overlays → UI. Caché de sprites en offscreen canvas. | ~1 día |

**Resultado**: la oficina pasa de rectángulos planos a un mapa con texturas, profundidad y avatares animados.

---

### Fase 1 — Control y presencia
**Duración estimada: 2-3 semanas**
**Impacto: de espectador a participante**

El usuario toma el control de su avatar y la oficina se siente viva.

| Tarea | Detalle | Esfuerzo |
|-------|---------|----------|
| Movimiento manual | Click-to-move (pathfinding A* simple) + WASD/flechas como alternativa. Walk animation sincronizada con dirección. | ~3 días |
| Colisiones | Mapa de colisiones por tile (paredes, muebles). Avatares no atraviesan objetos. | ~1 día |
| Sincronización de posición | Emitir posición por WebSocket con throttle (~100ms). Interpolación en clientes remotos. | ~2 días |
| Zonas interactivas | Al entrar en una zona (cocina, reunión, terraza) aparece indicador visual + se activa la zona. Burbujas de proximidad como WorkAdventure. | ~2 días |
| Onboarding | Tutorial de primera visita: cómo moverte, qué significan los moods, cómo interactuar. Overlay con pasos, se muestra solo una vez. | ~1 día |
| Escritorios dinámicos | El mapa asigna escritorios según usuarios registrados. Si hay >8, se generan más filas. | ~2 días |
| Responsive básico | Layout adaptable: sidebar colapsable en pantallas pequeñas, canvas escalado. No full mobile aún. | ~2 días |

**Resultado**: el usuario camina por la oficina, explora zonas, ve a sus compañeros moverse en tiempo real.

---

### Fase 2 — Customización visual
**Duración estimada: 2-3 semanas**
**Impacto: identidad y pertenencia**

Los usuarios hacen suya la oficina y su avatar.

| Tarea | Detalle | Esfuerzo |
|-------|---------|----------|
| Avatar mejorado | Sprites 32×32 con más opciones: expresiones faciales, más ropa, más peinados, tonos de piel ampliados. Editor de avatar rediseñado. | ~3 días |
| Caras/expresiones dinámicas | Los ojos/boca del avatar cambian según el mood dominante. Cara triste, sonriente, dormida, enfadada. Se renderiza como capa sobre el sprite base. | ~2 días |
| Editor de escritorio | Cada usuario personaliza su escritorio: color del monitor, pegatinas, planta personal, foto, taza. Guardado en DB como config JSON. | ~3 días |
| Skins de oficina | Templates de mapa prediseñados: oficina moderna, coworking, terraza mediterránea, loft industrial. Seleccionable por admin. | ~2 días |
| Tilesets temáticos españoles | Suelo de baldosa hidráulica, paredes encaladas, macetas con geranios, ventana con persiana, máquina de café expresso, barra de bar. | ~2 días |
| Upload de assets custom | Los usuarios suben PNGs (con validación de tamaño/formato) para usar como decoración de su zona o foto de avatar. Almacenamiento en servidor. | ~3 días |

**Resultado**: cada oficina tiene personalidad. Los usuarios se reconocen por sus avatares y escritorios.

---

### Fase 3 — Capa social
**Duración estimada: 3-4 semanas**
**Impacto: de herramienta a red social — aquí está el negocio**

Reconocimiento, feedback y engagement entre compañeros.

| Tarea | Detalle | Esfuerzo |
|-------|---------|----------|
| Sistema de estrellas | Click en avatar cercano → dar estrella con categoría (colaboración, innovación, actitud, liderazgo). Animación de estrella volando. Persistido en DB. | ~3 días |
| Perfil enriquecido | Bio, rol, equipo, skills, estrellas recibidas, badges. Modal al hacer click en avatar. | ~2 días |
| Badges y logros | Sistema de achievements: "Primera estrella dada", "10 estrellas recibidas", "Asistió a 5 reuniones", "Café con 3 personas distintas". Diseño pixel art. | ~3 días |
| Feed de actividad | Panel lateral con eventos sociales: "David dio una estrella a Carlos por innovación", "El equipo celebró un deploy exitoso". Persistente, scrollable. | ~2 días |
| Proximity chat mejorado | Chat contextual: si estás en la zona de café, chat solo con gente en esa zona. Chat general + canales por zona. | ~3 días |
| Reacciones a mensajes | Responder a mensajes del chat con emoji, quote, o hilo. | ~2 días |
| Leaderboard social | Ranking de estrellas (semanal/mensual), persona más reconocida, equipo más activo. | ~1 día |
| Notificaciones in-map | Eventos sociales visibles en el mapa: animación de estrella sobre avatar, confeti en celebraciones, toast de logros. | ~2 días |

**Resultado**: los usuarios interactúan, se reconocen mutuamente, hay motivo para volver cada día.

---

### Fase 4 — Integraciones y datos reales
**Duración estimada: 3-4 semanas**
**Impacto: de simulación a herramienta real**

El mood deja de ser mock y refleja la realidad del equipo.

| Tarea | Detalle | Esfuerzo |
|-------|---------|----------|
| OAuth (Google/Microsoft) | Auth real con SSO. Eliminar login por email sin password. | ~2 días |
| Integración Jira | API de Jira: issues asignadas, sprints, bugs. Alimenta mood de estrés/frustración según carga de trabajo. | ~3 días |
| Integración Slack | Presencia en Slack → presencia en oficina. Mensajes del canal del equipo en el feed. | ~3 días |
| Integración Calendar | Eventos de Google Calendar → reuniones en la sala de reuniones automáticamente. | ~2 días |
| Consentimiento y privacidad | Cada integración es opt-in. Panel de permisos. El usuario controla qué datos alimentan su mood. GDPR friendly. | ~2 días |
| API pública | REST API documentada para que otros servicios lean estado del equipo, envíen estrellas, etc. | ~3 días |
| Webhooks | Notificar a sistemas externos cuando ocurren eventos (estrella dada, mood bajo en equipo, etc.). | ~2 días |

**Resultado**: la oficina refleja el día a día real del equipo. Los datos son reales, no simulados.

---

### Fase 5 — Producto
**Duración estimada: 4-6 semanas**
**Impacto: de proyecto personal a producto desplegable**

| Tarea | Detalle | Esfuerzo |
|-------|---------|----------|
| Multi-tenant | Cada empresa/equipo tiene su instancia: su mapa, sus usuarios, su config. Subdominio o path por tenant. | ~5 días |
| Admin panel | Gestión de usuarios, roles, mapas, integraciones. Dashboard de analytics. | ~5 días |
| Editor de mapas in-app | Interfaz visual para colocar tiles, muebles, zonas. No depender de Tiled externo. Drag & drop. | ~5 días |
| Mobile (PWA) | Vista responsive completa. Instalar como app. Touch para moverse. Push notifications. | ~5 días |
| Analytics y reporting | Métricas de engagement: estrellas/semana, mood trends, zonas más visitadas, horas pico. Exportable. | ~3 días |
| Sonido ambiental | Ruido de oficina sutil (teclados, murmullos). Efectos: notificación de estrella, evento de oficina. Mutable. | ~2 días |
| Performance a escala | Optimizar para 50-100 usuarios simultáneos: spatial partitioning, delta updates, connection pooling, Redis pub/sub. | ~3 días |
| CI/CD robusto | Tests automáticos en PR, staging environment, rollback automático, health monitoring. | ~3 días |

**Resultado**: producto desplegable para cualquier equipo, con panel de admin y analytics.

---

## Dependencias entre fases

```
Fase 0 (Motor gráfico)
  └─→ Fase 1 (Control y presencia)
        ├─→ Fase 2 (Customización visual)
        └─→ Fase 3 (Capa social)
              └─→ Fase 4 (Integraciones reales)
                    └─→ Fase 5 (Producto)
```

- **Fases 2 y 3 pueden hacerse en paralelo** si hay más de una persona.
- **Fase 4 requiere Fase 3** porque las integraciones alimentan features sociales.
- **Fase 0 es bloqueante** para todo lo demás — sin tilemap/sprites no se puede construir encima.

---

## Decisiones técnicas pendientes

| Decisión | Opciones | Cuándo decidir |
|----------|----------|----------------|
| Motor de rendering | Canvas 2D puro vs Pixi.js vs Phaser | Fase 0, antes de empezar |
| Formato de mapas | Tiled JSON vs formato propio | Fase 0 |
| Tamaño base de sprites | 24×24 (SPECSv2) vs 32×32 (más detalle) | Fase 0 |
| State management frontend | useState actual vs Zustand vs Redux | Fase 1 |
| Base de datos | PostgreSQL solo vs + Redis para estado real-time | Fase 1 |
| Assets: crear vs comprar vs libres | Pixel art propio vs asset packs vs mezcla | Fase 0/2 |
| Auth | OAuth propio vs Auth0/Clerk vs mantener email-only | Fase 4 |
| Hosting | Fly.io (free tier, Docker nativo, WebSocket OK) vs Railway vs EC2 | Fase 5 |

---

## Notas para colaboradores

- **Convenciones**: seguir `CLAUDE.md` del workspace (commits con gitmoji, código en inglés, comentarios en español).
- **Specs vigentes**: `SPECSv2.md` define el comportamiento del MVP actual. Este roadmap lo extiende.
- **Branch strategy**: feature branches desde `main`. PRs con review.
- **Tests**: Playwright E2E en `tests/e2e/`. Añadir tests para cada feature nueva.
- **Assets**: pixel art nuevo va en `frontend/src/assets/`. Spritesheets como PNG + JSON de metadatos.
