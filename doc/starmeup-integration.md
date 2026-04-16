# StarMeUp — Integración con Mad Office

## Visión

Mad Office como capa visual/espacial complementaria a StarMeUp: las estrellas y reconocimientos ocurren en el contexto de la oficina virtual, y se sincronizan con StarMeUp para que tengan impacto real.

## API Pública de StarMeUp

| Aspecto | Detalle |
|---|---|
| Portal developer | https://developers.starmeup.com/ |
| Base URL | `https://integration.starmeup.com/` |
| Autenticación | JWT Bearer Token ("Community Token") |
| Header | `Authorization: Bearer {community-token}` |
| Formato | JSON sobre HTTPS |
| Versión | v1 |
| Soporte | support@starmeup.com |

### Recursos disponibles en la API

- **StarMeUp** — reconocimiento (estrellas)
- **BetterMe** — feedback continuo
- **BeThere** — presencia/engagement
- **Feed** — actividad social
- **Admin** — gestión de usuarios
- **Workflows** — automatizaciones

### Respuestas

- Objeto único: `{"result": {object}}`
- Listas: paginadas con `page` (number, numberOfElements, size, totalElements, totalPages)
- Errores: timestamp, message, details, type, title, detail

### Integraciones existentes

StarMeUp ya se integra con:
- **Slack** — enviar estrellas y feedback sin salir de Slack
- **Microsoft Teams** — reconocimiento desde la interfaz de Teams
- **Gmail** — reconocer desde email
- **Workplace** — compartir en muro
- **Workday / BambooHR / SFTP** — sincronización de datos HR
- **SAML / Google OAuth** — SSO

## Acceso pendiente

Los endpoints concretos (enviar estrella, listar reconocimientos, etc.) requieren autenticación para acceder a la documentación detallada. Pasos necesarios:

1. Contactar a support@starmeup.com o al equipo de StarMeUp en Globant
2. Solicitar un **Community Token** para integración
3. Con el token, acceder a la documentación completa de endpoints

## Estrategia de integración

### Fase 1: Sistema propio (sin dependencia de StarMeUp)

Implementar reconocimiento dentro de Mad Office que funcione standalone:
- Acercarte a un avatar y darle una estrella con categoría
- Badges y leaderboard propios
- Feed de actividad en el mapa
- Persistencia en PostgreSQL local

### Fase 2: Sincronización con StarMeUp (cuando tengamos token)

- Enviar estrellas dadas en Mad Office a StarMeUp
- Importar estrellas recibidas en StarMeUp al feed de Mad Office
- Sincronizar perfiles y badges
- Leer datos del feed real para mostrar actividad en el mapa

## Enlaces

- Portal developer: https://developers.starmeup.com/
- Integraciones: https://www.starmeup.com/en/integrations.html
- Producto: https://www.starmeup.com/en.html
- Soporte: https://www.starmeup.com/en/support.html
- FAQs: https://www.starmeup.com/en/faqs.html
