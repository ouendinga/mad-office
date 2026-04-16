# Mad Office - Mejoras a las Especificaciones

Documento con mejoras sugeridas y observaciones surgidas durante la implementacion.

## Mejoras Implementadas

### 1. Sistema de autenticacion simplificado para MVP

**Especificacion original**: No se definia el sistema de autenticacion mas alla del modal de login.

**Mejora aplicada**: Se implemento autenticacion JWT sin password para el MVP. Solo se requiere email para login/registro. Esto simplifica la experiencia de usuario para la demo mientras mantiene la estructura para agregar passwords en produccion.

**Recomendacion futura**: Implementar OAuth 2.0 con Google (SSO) ya que las integraciones reales usaran Google APIs.

### 2. Representaciones visuales con niveles de intensidad

**Especificacion original**: Se mencionan representaciones pero no se detallan niveles.

**Mejora aplicada**: Se implementaron 3 niveles de intensidad por cada estado de animo:
- Nivel leve (umbral >= 4, probabilidad 10%)
- Nivel moderado (umbral >= 7, probabilidad 20%)
- Nivel intenso (umbral >= 9, probabilidad 30%)

Cada nivel tiene una representacion visual distinta (ej: tristeza -> lagrima -> nube de lluvia -> inundacion de lagrimas).

### 3. Indicadores de estado de animo en el mapa

**Especificacion original**: No se definia como visualizar el estado de animo en el mapa.

**Mejora aplicada**: Se anadio un punto de color debajo del nombre de cada avatar que indica el estado de animo dominante. Colores:
- Verde: Felicidad
- Naranja: Estres
- Rojo: Frustracion
- Amarillo: Emocion
- Azul: Tristeza
- Lila: Cansancio

### 4. Panel lateral con informacion detallada

**Especificacion original**: No se definia interfaz para ver detalles de estados.

**Mejora aplicada**: Panel lateral con:
- Lista de equipo con indicador de estado
- Barras de progreso para cada estado de animo al seleccionar un usuario
- Log de eventos recientes en tiempo real

### 5. Notificaciones de eventos de oficina

**Especificacion original**: Se mencionan eventos aleatorios pero no su visualizacion.

**Mejora aplicada**: Los eventos de oficina se muestran como notificaciones toast flotantes sobre el mapa, con animacion de fade in/out y desaparicion automatica tras 10 segundos.

## Mejoras Sugeridas para Futuras Iteraciones

### 1. Persistencia de sesion mejorada

Actualmente la sesion se mantiene con JWT en localStorage. Se recomienda:
- Implementar refresh tokens
- Agregar logout en el servidor (invalidar token)
- Cookie httpOnly para mayor seguridad

### 2. Avatar animado

El avatar actual es estatico. Se sugiere:
- Animacion de respiracion (movimiento sutil del sprite)
- Animacion de escritura cuando la accion es "working_hard"
- Parpadeo aleatorio de ojos
- Transiciones suaves entre estados

### 3. Personalicion de escritorio

Permitir que los usuarios personalicen su escritorio virtual:
- Cambiar color del monitor
- Agregar objetos decorativos (planta, foto, juguete)
- Personalizar fondo de pantalla del monitor

### 4. Integraciones reales progresivas

Plan de implementacion sugerido:
1. **Google Calendar**: OAuth 2.0 + Calendar API para detectar reuniones
2. **Gmail**: Analisis de frecuencia y tipo de correos (no contenido)
3. **Jira**: Webhook para eventos de tickets

### 5. Sistema de logros

Gamificacion para incentivar el uso:
- "Primera semana en la oficina"
- "Avatar mas feliz del dia"
- "Sobrevivio 3 tormentas seguidas"

### 6. Configuracion de sensibilidad

Permitir que cada usuario ajuste la sensibilidad del sistema de animo:
- Escala de impacto de eventos
- Frecuencia de cambio de accion
- Desactivar representaciones especificas

### 7. Dashboard de analytics

Panel de administracion con metricas:
- Estado de animo promedio del equipo por dia/semana
- Correlacion entre eventos y cambios de animo
- Horas pico de estres/felicidad

### 8. Modo oscuro / claro

La aplicacion actual solo tiene tema oscuro. Agregar toggle para tema claro.

### 9. Notificaciones push

Notificar cuando un companero cambia de estado significativamente o cuando ocurre un evento de oficina importante.

### 10. Accesibilidad

- Soporte para lectores de pantalla (ARIA labels)
- Navegacion por teclado en el generador de avatares
- Descripciones textuales alternativas para los estados visuales
- Contraste de colores WCAG AA
