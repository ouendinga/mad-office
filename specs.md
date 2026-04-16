# Mad Office - Especificacion MVP

Plataforma de oficina virtual con avatares pixel art automatizados. Los avatares reflejan el estado de animo real de cada miembro del equipo basandose en integraciones con Jira, correo y calendario. Incluye un generador de avatares personalizado.

## Forma de trabajo

- Copia este documento como specs.md en base al que has de trabajar y utilizalo como referencia para tu trabajo
- Has de generar documento README.md mantenerlo con forma de despliegue
- El directorio de documentacion sera doc
- Genera un documento de mejoras a las especificaciones spec_improvement.md con las mejoras que creas convenientes y que surjan durante la implementacion
- Genera un documento de documentacion tecnica technical_doc.md
- El proyecto se descarga en local, se trabaja en local, se comitea y se hace push al repositorio para tenerlo disponible en el servidor

## Especificacion funcional

### Funcionalidades Core

- **Oficina virtual**: Mapa 2D en Canvas con escritorios, sala de reuniones y zona de descanso. Cada usuario aparece como un avatar pixel art sentado en su escritorio asignado.
- **Generador de avatares**: Al unirse, cada usuario personaliza su avatar eligiendo entre opciones de pelo, color de piel, ropa y accesorios. Los sprites se componen por capas (base + pelo + ropa + accesorio) y se renderizan en Canvas.
- **Estados automatizados**: El avatar cambia de estado automaticamente segun las actividades detectadas en los diferentes entornos a los que la plataforma tenga acceso (Gmail, Google docs, Jira, ...)
- **Eventos, Estados de animo y Acciones**: Ha de haber una relacion entre los eventos que ocurren en las diferentes interacciones con los estados de animo que expresan los avatares. Los diferentes estados de animo se pueden representar con diferentes acciones a lo largo del tiempo.
  - Si el estado de animo es frustrado, que le salga una nube encima de la cabeza y al X tiempo si sigue asi, pues que haya otra expresion de esa frustracion visual.
  - Si un avatar permanece demasiado tiempo en el mismo estado de animo, cambia a otra accion o representacion de ese estado de animo.

### Fase II

- **Movimiento en tiempo real**: Los avatares pueden moverse libremente por la oficina en funcion de sus sentimientos. Todos ven el movimiento en tiempo real via WebSockets.
- **Reacciones emoji**: Los usuarios pueden enviar emojis que aparecen como burbujas sobre su avatar.
- **Chat basico**: Mensajes de texto en un panel lateral visible para todos.

## Especificaciones del Generador de Avatares

Base del sprite: 16x16 pixeles, escalado x4 a 64x64 en pantalla. Sistema de capas (de abajo hacia arriba):

- **Capa 1**: Cuerpo base (4 tonos de piel)
- **Capa 2**: Ropa (6 opciones: camiseta, camisa, hoodie, traje, vestido, polo)
- **Capa 3**: Pelo (8 estilos x 6 colores)
- **Capa 4**: Accesorios (gafas, gorra, auriculares, ninguno)

## Mapa de la Oficina

Elementos:
- 8 escritorios distribuidos en 2 filas de 4
- 1 sala de reuniones (esquina inferior derecha)
- 1 zona de descanso (esquina inferior izquierda)
- Decoracion: plantas, pizarra, maquina de cafe (elementos estaticos)

El generador se muestra como pantalla inicial al unirse. El avatar generado se guarda en el estado del servidor y se transmite a todos los clientes.

## Especificaciones sobre estados de los avatares y eventos

- **Estado de animo**: Es lo que esta sintiendo el avatar en ese momento. Por ejemplo frustrado, feliz, estresado. La actividad real del usuario determinara el estado de animo.
  - Los estados de animo seran cuantificables con un valor de 0 al 10 siendo 0 que no lo siente en absoluto y 10 que es lo unico que siente.
  - Todos los estados de animo tendran siempre un valor.

- **Accion**: Es lo que esta haciendo el avatar en ese momento por ejemplo dormir, sentado, caminando. El usuario cambiara de accion en los siguientes casos:
  - Si concluye la accion que esta haciendo. Por ejemplo caminar tiene un destino.
  - Si cambia su estado de animo significativamente.
  - Transcurridos 30 minutos ejecutando la misma accion.
  - El estado de animo sera el principal determinante de la siguiente accion.

- **Representacion**: Llamamos representacion a los cambios en el avatar que representan un estado de animo. Por ejemplo, llorar es una representacion de la tristeza. Estas son compatibles con las acciones.
  - El usuario tendra una baja posibilidad de ejecutar una representacion en funcion de su estado de animo. Cuando mas pronunciado sea el mismo mayor sera la probabilidad.

- **Eventos**: Cada cierto tiempo ocurriran eventos aleatorios en la oficina como una pequena tormenta localizada sobre una persona o un terremoto.
  - Estos eventos pueden alterar el estado de animo de un avatar si este se ve afectado.

## Especificaciones tecnicas

### Stack Tecnologico

- Frontend: React 18 + HTML5 Canvas (sprites pixel art 16x16 escalados)
- Backend: Node.js + Express
- Tiempo real: Socket.io (WebSockets con fallback)
- docker-compose con 3 servicios: frontend, backend, postgres (PostgreSQL 16)

### Landing Page

El proyecto debe tener una landing page con una descripcion de producto que te invite a registrarte + un login de acceso a la plataforma.

### Comunicacion en Tiempo Real (WebSocket Events)

### Arquitectura de Integraciones

Para el MVP se usan datos mock que simulan APIs reales. El Status Engine consulta las integraciones cada 15 segundos y recalcula el estado de cada usuario.

### Datos de Mock para el MVP

Deben generarse eventos que vayan saltando cada cierto tiempo a los distintos usuarios de forma aleatoria y meter usuarios base (David, Alfredo, Jose Antonio, Jose Luis, Carlos).

## Repositorio

El repositorio se encuentra en git@github.com:ouendinga/mad-office.git

## Gestion del servidor

- La conexion al servidor es mediante ssh. La cadena de conexion es: ssh -p REDACTED_SSH_PORT ubuntu@REDACTED_SERVER_IP.
- Instala git, docker

## Despliegue del proyecto

- En el servidor el proyecto estara ubicado en /app
- Despliegue por git pull en el servidor desde el repositorio git con github Actions.
- Hay que incluir la clave publica de github actions en el servidor "REDACTED_SSH_PUBLIC_KEY"
- Instalacion / actualizacion del stack mediante docker compose.
- La aplicacion debe escuchar por el puerto 443.

## QA / Testing

- Playwright (headless): Ejecucion de pruebas E2E para validar el happy path y casos borde del frontend.
- Pruebas de Integracion y Servicios: Validacion de endpoints y comunicacion en tiempo real mediante WebSockets.
- Gestion de Datos de Prueba: Uso de mocks y simuladores para dependencias externas, garantizando pruebas independientes.
- Reportabilidad y Cobertura: Generacion de reportes detallados con metricas de cobertura de API (Swagger Coverage).
- Documentacion: Mantenimiento de la documentacion tecnica y funcional de las pruebas en el repositorio local.

## Landing Page

### Header
- Logo con el texto Mad Office
- Botones Login / Registro

### Seccion Hero
- Headline principal. Ej: "Mad Office - Tu oficina, en cualquier lugar del mundo"
- Subheadline (1-2 lineas): explica que es y para quien
- CTA primario: boton grande "Registrate"

### Seccion como funciona
- 3 cards en fila con icono, numero de paso, titulo y descripcion: (1) Registrate, (2) Crea tu avatar y unete, (3) Trabaja con tu equipo. El paso 3 lleva etiqueta "Automatico".

### Seccion Features
- Grid de 3 tarjetas con icono outline, titulo y descripcion de max 2 lineas:
  - Conexion con Google Calendar, Jira y Gmail
  - Estados automatizados
  - Eventos de estados de animos y acciones

### Seccion Testimonios
- 3 cards con avatar de iniciales, nombre, empresa, estrellas y texto de opinion. Usa datos ficticios.

### Footer
- Logo mas texto "Mad Office" texto copyright (c) 2025 Mad Office. Todos los derechos reservados.

### Modales
- Al hacer clic en Registro se abre un modal centrado con overlay oscuro semitransparente. El modal tiene: titulo "Crear cuenta", campo de texto Email, campo de texto Nombre, boton submit "Registrarse" color primario, y una X para cerrar en la esquina superior derecha.
- Al hacer clic en Login se abre un modal centrado con overlay oscuro semitransparente. El modal tiene: titulo "Iniciar sesion", campo de texto Email, boton submit "Entrar" color primario, y una X para cerrar en la esquina superior derecha.
- Ambos modales se cierran tambien al hacer clic fuera del modal. Usar JavaScript vanilla para abrir y cerrar los modales.
