# Mad Office - SPECSv2: Mejoras y Correcciones

Este documento describe las mejoras y correcciones a implementar sobre el MVP original definido en `specs.md`.

## 1. Cambio de puerto

Cambiar el puerto de escucha de 443 a **80** tanto en local como en produccion.
- `docker-compose.yml`: mapear puerto 80:80
- Documentacion y URLs actualizadas
- GitHub Actions deploy workflow actualizado

## 2. Nuevo sistema de estados de animo (escala bipolar)

Reemplazar los 6 estados independientes (0-10) por **5 ejes bipolares** donde 0 es el extremo negativo y 10 el positivo:

| Eje | Valor 0 (negativo) | Valor 10 (positivo) | Valor por defecto |
|-----|--------------------|--------------------|-------------------|
| Alegria | Tristeza | Felicidad | 5 |
| Energia | Cansancio | Energico | 5 |
| Optimismo | Pesimismo | Optimista | 5 |
| Frustracion | Frustrado | Complacido | 5 |
| Estres | Estresado | Chill | 5 |

Esto garantiza coherencia emocional: no es posible tener felicidad 10 y tristeza 10 simultaneamente.

## 3. Nuevas acciones

Las acciones tienen una probabilidad de surgir en funcion de condiciones basadas en el estado de animo:

| Accion | Condiciones emocionales |
|--------|------------------------|
| Sentado | Ninguna (por defecto) |
| Rabieta | Frustracion < 4, Alegria < 3 |
| Celebrando | Alegria > 7 |
| Holgazaneando | Energia < 5 y Energia > 3 |
| Durmiendo | Energia <= 3 |
| Lavabo | Optimismo >= 7 |
| Corriendo | Energia > 8 |
| Reunido | Evento de reunion activo |
| Paseando | Estres < 4 |
| Pizarra | Evento de pizarra activo |

Las acciones de movimiento (paseando, corriendo, lavabo, reunido, pizarra) desplazan al avatar por la oficina en tiempo real. Todos los usuarios ven el movimiento via WebSockets.

## 4. Nuevas representaciones

Las representaciones son expresiones visuales que reflejan un estado de animo. Se muestran como overlays sobre el avatar y son compatibles con las acciones.

| Representacion | Condiciones emocionales |
|---------------|------------------------|
| Llorando | Alegria <= 3 |
| Enfadado | Frustracion <= 3 (frustrado) |
| Somnoliento | Energia <= 3 |
| Cantando | Alegria >= 7 |
| Tirandose del pelo | Optimismo <= 4 |
| Nube en la cabeza | Estres <= 4 (estresado) |

Nota: "Llorando" pasa de ser accion a representacion. La accion equivalente es "Rabieta" (montando una pataleta).

## 5. Movimiento de avatares en tiempo real

- Cuando la accion es **paseando** o **corriendo**, el avatar se mueve libremente por la oficina con interpolacion suave.
- Cuando la accion es **reunido**, el avatar se desplaza a la **sala de reuniones**.
- Cuando la accion es **lavabo**, el avatar se desplaza al **lavabo** (nuevo elemento de la oficina).
- Cuando la accion es **pizarra**, el avatar se desplaza a la **pizarra**.
- El movimiento se sincroniza en tiempo real via WebSocket (`position:update`).
- Velocidad de movimiento: ~1 pixel logico por frame a 30fps.

## 6. Velocidad de animacion

- Reducir la velocidad de los ticks de animacion. El loop de render se mantiene para interpolacion suave pero los cambios de frame de animacion (representaciones, efectos) ocurren cada **6 frames** en lugar de cada frame.
- Las transiciones de movimiento son suaves pero no instantaneas.

## 7. Solo usuarios conectados visibles

- Solo mostrar en la oficina los avatares de usuarios que estan conectados via WebSocket.
- Cuando un usuario se desconecta, su avatar desaparece de la oficina.
- El backend emite `user:online` y `user:offline` para gestionar presencia.
- El Status Engine solo genera eventos para usuarios conectados.

## 8. Ranking de estados de animo

- Anadir un boton en el panel lateral derecho que muestre un **ranking de estados de animo**.
- Al hacer clic se abre/cierra un panel con rankings:
  - Mas feliz (Alegria mas alta)
  - Mas energico (Energia mas alta)
  - Mas estresado (Estres mas bajo = mas estresado)
  - Mas frustrado (Frustracion mas baja = mas frustrado)
- Cada ranking muestra los usuarios ordenados con su valor.

## 9. Ciclo de dia y horarios

- Implementar un reloj virtual acelerado (1 minuto real = 1 hora virtual).
- Los avatares entran a la oficina al inicio de la jornada (9:00) y salen al final (18:00).
- Fuera del horario laboral la oficina aparece vacia o con luces apagadas.
- Mostrar la hora virtual en la cabecera.

## 10. Estandarizacion a espanol

- Todos los estados, eventos, acciones y representaciones deben estar en espanol.
- Descripciones de eventos mock en espanol.
- Nombres de eventos de oficina en espanol.
- Labels y textos internos del backend en espanol.

## 11. Reacciones emoji

- Los usuarios pueden enviar emojis que aparecen como burbujas flotantes sobre su avatar.
- Selector de emojis en la interfaz (panel inferior o boton junto al avatar).
- Las burbujas aparecen con animacion de subida y fade-out (3 segundos).
- Evento WebSocket: `reaction:send` / `reaction:new`.

## 12. Chat basico

- Panel de chat en el lateral visible para todos los usuarios conectados.
- Mensajes de texto con nombre de usuario y timestamp.
- Scroll automatico hacia abajo al recibir nuevos mensajes.
- Input de texto en la parte inferior del panel.
- Toggle para mostrar/ocultar el chat.

## 13. Visibilidad de representaciones en el panel lateral

- En la lista de equipo del panel lateral, debajo de la accion de cada usuario, mostrar un texto que identifique la representacion activa.
- Ejemplo: si tiene nube en la cabeza, mostrar "Estresado" debajo de la accion.
- Usar color e icono acorde al tipo de representacion.

## 14. Perfil de usuario y configuracion

- En la cabecera, al lado del nombre del usuario y el boton de salir, anadir un boton de configuracion.
- Al hacer clic se abre un panel/modal con:
  - Datos de registro (email, nombre) editables
  - Acceso al generador de avatares para cambiar el avatar
  - Boton guardar cambios

## 15. Accion "Reunido" y sala de reuniones

- Cuando un evento de reunion se activa, los avatares afectados se desplazan a la sala de reuniones.
- Los avatares se sientan en las sillas de la sala de reuniones.
- Al terminar la reunion, vuelven a su escritorio.

## 16. Aumento de resolucion de sprites

- Aumentar la base del sprite de 16x16 a **24x24** pixeles para facilitar la representacion de emociones y detalles faciales.
- Escalar x3 en la oficina (72x72) y x4 en el generador (96x96).

## 17. Efectos visuales en eventos aleatorios

- Cuando salta un evento aleatorio, se debe mostrar un efecto visual en el mapa:
  - Tormenta: gotas de lluvia sobre el avatar afectado
  - Terremoto: sacudida del canvas
  - Pizza: icono de pizza flotante
  - etc.
- Los efectos duran entre 3-5 segundos.

## 18. Eventos y acciones de pizarra

- Anadir eventos que muevan a uno o varios avatares a la zona de la pizarra.
- Nuevo evento: "Sesion de brainstorming en la pizarra"
- Los avatares se desplazan a la pizarra, permanecen un tiempo, y vuelven.

## 19. Nuevo usuario aparece en la oficina

- Cuando un usuario se registra, crea su avatar y accede a la oficina, su avatar debe aparecer inmediatamente en un escritorio disponible.
- Si no hay escritorios disponibles, se asigna a una zona libre.

## 20. Oficina dinamica

- El numero de escritorios es dinamico segun el numero de usuarios.
- Si hay mas de 8 usuarios, se amplian los escritorios automaticamente.
- Si hay demasiados usuarios, dividir en salas/pestanas.

## 21. Mobiliario mejorado de la oficina

Mejorar los elementos decorativos y funcionales:
- **Sofa** en la zona de descanso (reemplaza rectangulos simples)
- **Estantes** con libros en las paredes
- **Pizarra** mejorada con mas detalle
- **Plantas** con macetas mas detalladas
- **Cafetera** mejorada
- **Lavabo** (nuevo elemento para la accion "lavabo")

## 22. Lavabo

- Anadir un lavabo como nueva zona de la oficina (similar a sala de reuniones y zona de descanso).
- Ubicacion: esquina superior derecha o zona disponible.
- Los avatares se desplazan alli cuando su accion es "lavabo".

## 23. Actualizacion de eventos mock a espanol y nuevo sistema

Todos los eventos mock deben actualizarse para:
- Descripciones en espanol
- Impactos adaptados al nuevo sistema bipolar (los valores negativos bajan el eje, los positivos lo suben)
- Ejemplo: un bug reportado baja Alegria (-2), baja Estres (-3), baja Frustracion (-2)

## 24. Actualizacion de eventos de oficina a espanol

Todos los eventos aleatorios de oficina con descripciones en espanol e impactos adaptados al sistema bipolar.

## Prioridad de implementacion

1. Sistema bipolar de estados de animo (base para todo lo demas)
2. Nuevas acciones y representaciones
3. Cambio de puerto a 80
4. Estandarizacion a espanol
5. Movimiento de avatares en tiempo real
6. Solo usuarios conectados
7. Chat basico y reacciones emoji
8. Ranking de estados
9. Perfil de usuario
10. Mejoras visuales (sprites, mobiliario, efectos)
11. Ciclo dia/noche
12. Oficina dinamica
