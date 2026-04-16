# Mad Office - Documentacion Tecnica

## Arquitectura General

Mad Office sigue una arquitectura de tres capas desplegada con Docker Compose:

```
[Browser] <---> [Nginx (Frontend)] <---> [Express (Backend)] <---> [PostgreSQL]
                                    <---> [Socket.io (WebSocket)]
```

### Flujo de Datos

1. El usuario accede a la landing page (React SPA servida por Nginx)
2. Se registra/logea via API REST (`/api/auth`)
3. Personaliza su avatar (Canvas 2D con sistema de capas)
4. Entra a la oficina virtual (Canvas 2D + WebSocket)
5. El Status Engine genera eventos mock cada 15 segundos
6. Los cambios de estado se propagan via Socket.io a todos los clientes

## Base de Datos

### Schema (PostgreSQL 16)

#### Tabla `users`
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | SERIAL PK | Identificador unico |
| email | VARCHAR(255) UNIQUE | Email del usuario |
| name | VARCHAR(255) | Nombre del usuario |
| avatar_config | JSONB | Configuracion del avatar (skinTone, hairStyle, hairColor, clothes, accessory) |
| desk_index | INTEGER | Indice del escritorio asignado (0-7) |
| created_at | TIMESTAMP | Fecha de creacion |

#### Tabla `mood_states`
| Campo | Tipo | Rango | Descripcion |
|-------|------|-------|-------------|
| id | SERIAL PK | | Identificador |
| user_id | FK -> users | | Referencia al usuario |
| happiness | INTEGER | 0-10 | Nivel de felicidad |
| stress | INTEGER | 0-10 | Nivel de estres |
| frustration | INTEGER | 0-10 | Nivel de frustracion |
| excitement | INTEGER | 0-10 | Nivel de emocion |
| sadness | INTEGER | 0-10 | Nivel de tristeza |
| tiredness | INTEGER | 0-10 | Nivel de cansancio |
| current_action | VARCHAR(50) | | Accion actual del avatar |
| current_representation | VARCHAR(50) | | Representacion visual activa |
| action_started_at | TIMESTAMP | | Inicio de la accion actual |

#### Tabla `mock_events`
Almacena eventos generados por las integraciones mock (Jira, Gmail, Calendar).

#### Tabla `office_events`
Almacena eventos aleatorios de la oficina (tormentas, terremotos, etc.).

## Backend API

### Endpoints REST

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/api/auth/register` | Registro de usuario (email, name) |
| POST | `/api/auth/login` | Login con email |
| GET | `/api/users` | Lista usuarios con estado de animo |
| PUT | `/api/users/:id/avatar` | Actualizar configuracion del avatar |
| GET | `/api/moods/:userId` | Estado de animo de un usuario |
| GET | `/api/moods/:userId/events` | Eventos recientes de un usuario |
| GET | `/api/health` | Health check |

### Autenticacion

- JWT con expiracion de 24 horas
- Header: `Authorization: Bearer <token>`
- Sin password para el MVP (solo email)

### Eventos WebSocket

| Evento | Direccion | Payload | Descripcion |
|--------|-----------|---------|-------------|
| `auth` | Client -> Server | `token` | Autenticar conexion |
| `auth:success` | Server -> Client | `{userId}` | Autenticacion exitosa |
| `state:update` | Server -> All | `[users]` | Actualizacion de estados |
| `event:new` | Server -> All | `{event}` | Nuevo evento de integracion |
| `office_event` | Server -> All | `{event}` | Evento aleatorio de oficina |
| `action:changed` | Server -> All | `{userId, action}` | Cambio de accion |
| `representation:triggered` | Server -> All | `{userId, repr}` | Representacion activada |
| `reaction:send` | Client -> Server | `{emoji}` | Enviar reaccion (Fase II) |
| `chat:send` | Client -> Server | `{message}` | Enviar mensaje (Fase II) |

## Sistema de Sprites (Avatar Pixel Art)

### Estructura de Capas

Los avatares se componen en 4 capas renderizadas en Canvas:

1. **Cuerpo base** (16x16px): 4 tonos de piel, incluye cabeza, torso, brazos y piernas
2. **Ropa** (overlay sobre torso): 6 opciones con variaciones visuales
3. **Pelo** (overlay sobre cabeza): 8 estilos x 6 colores
4. **Accesorios** (overlay final): gafas, gorra, auriculares o ninguno

### Escalado

- Base: 16x16 pixeles
- Pantalla: escalado x4 = 64x64 (avatar generator) o x3 = 48x48 (oficina)
- `image-rendering: pixelated` para mantener estetica pixel art

### Colores de Piel

| Index | Color | Descripcion |
|-------|-------|-------------|
| 0 | #FFDBB4 | Claro |
| 1 | #E8A87C | Medio claro |
| 2 | #C68642 | Medio |
| 3 | #8D5524 | Oscuro |

## Motor de Estados (Status Engine)

### Ciclo de Ejecucion

El Status Engine se ejecuta cada **15 segundos**:

1. Itera sobre todos los usuarios
2. Con probabilidad 40%, genera un evento mock aleatorio
3. Aplica el impacto en el animo del usuario
4. Verifica si debe cambiar de accion (>30 min o cambio significativo)
5. Verifica representaciones visuales segun probabilidad
6. Emite estado actualizado a todos los clientes

### Determinacion de Acciones

La accion se determina por el estado de animo dominante:

| Estado Dominante | Acciones Posibles |
|-----------------|-------------------|
| Felicidad | Celebrando, Sentado |
| Estres | Trabajando duro, Paseando |
| Frustracion | Paseando, Furioso |
| Emocion | Celebrando, Trabajando duro |
| Tristeza | Llorando, Descansando |
| Cansancio | Durmiendo, Descansando |

### Representaciones Visuales

Cada estado de animo tiene 3 niveles de representacion con probabilidades crecientes:

| Nivel | Umbral | Probabilidad |
|-------|--------|-------------|
| Leve | >= 4 | 10% |
| Moderado | >= 7 | 20% |
| Intenso | >= 9 | 30% |

### Eventos de Oficina

Eventos aleatorios que afectan a toda la oficina o usuarios especificos:

- Mini tormenta (sobre un usuario)
- Terremoto (toda la oficina)
- Cafe derramado (un usuario)
- Entrega de pizza (toda la oficina)
- Caida del WiFi (toda la oficina)
- Sorpresa de cumpleanos (un usuario)
- Planta florece (toda la oficina)
- Simulacro de incendio (toda la oficina)
- Arcoiris (toda la oficina)
- Visita de gato (toda la oficina)

## Mapa de Oficina

### Dimensiones

- Canvas logico: 800x600 pixeles
- Se escala al contenedor disponible

### Distribucion

- **8 escritorios**: 2 filas de 4, zona central
- **Sala de reuniones**: Esquina inferior derecha (160x200)
- **Zona de descanso**: Esquina inferior izquierda (160x200)
- **Decoraciones**: Plantas, pizarra, maquina de cafe

## Despliegue

### Docker Compose

3 servicios:
1. **postgres**: PostgreSQL 16 Alpine con init.sql
2. **backend**: Node.js 20 Alpine, puerto 3001
3. **frontend**: Build React + Nginx Alpine, puerto 443->80

### Nginx

- Sirve el build de React
- Proxy inverso para `/api` y `/socket.io` al backend

### GitHub Actions

Workflow `deploy.yml` en push a `main`:
1. SSH al servidor (REDACTED_SERVER_IP:REDACTED_SSH_PORT)
2. Git pull en `/app`
3. Docker compose rebuild
