# Mad Office - Claude Context

## Project Overview

**Mad Office** is a virtual office platform with pixel art avatars and automated mood states. Hackathon project at Globant.

- **Production URL**: http://REDACTED_PRODUCTION_HOST:443/
- **Repo**: git@github.com:ouendinga/mad-office.git
- **Server**: ssh -p REDACTED_SSH_PORT ubuntu@REDACTED_SERVER_IP (Ubuntu 24.04 LTS, AWS EC2 eu-south-2)
- **App directory on server**: /app
- **CI/CD**: GitHub Actions - push to `main` auto-deploys via SSH

## Tech Stack

- **Frontend**: React 18 + HTML5 Canvas (pixel art sprites 16x16, scaled x4/x3)
- **Backend**: Node.js 20 + Express
- **Real-time**: Socket.io (WebSockets with polling fallback)
- **Database**: PostgreSQL 16
- **Containers**: Docker Compose (3 services: frontend/nginx, backend, postgres)
- **Testing**: Playwright E2E

## Architecture

- Frontend served by Nginx, which also reverse-proxies `/api` and `/socket.io` to backend
- Backend runs Express REST API + Socket.io on port 3001
- Status Engine polls every 15s, generates mock events (Jira, Gmail, Calendar), updates mood states
- Office Events generates random events (storms, pizza delivery, etc.) every 30s
- All state changes broadcast to clients via WebSocket `state:update` events

## Key Design Decisions

- **No passwords for MVP**: Auth is email-only. Register = email + name, Login = email. JWT tokens with 24h expiration.
- **Mood system**: 6 moods (happiness, stress, frustration, excitement, sadness, tiredness), each 0-10 scale. All moods always have a value.
- **Actions**: Change when completed, mood shifts significantly, or after 30 minutes. Dominant mood determines next action.
- **Representations**: Visual overlays (tears, clouds, sparkles) triggered by probability based on mood intensity. 3 tiers: leve (>=4, 10%), moderado (>=7, 20%), intenso (>=9, 30%).
- **Avatar sprites**: 16x16 pixel art with 4 layers (body/skin -> clothes -> hair -> accessories). Rendered directly in Canvas, no image assets.
- **Office map**: 800x600 logical canvas with 8 desks (2 rows of 4), meeting room (bottom-right), break area (bottom-left), decorations (plants, whiteboard, coffee machine).

## Base Mock Users

David, Alfredo, Jose Antonio, Jose Luis, Carlos - created automatically via `backend/db/init.sql`.

## SSH Keys

- `REDACTED_SSH_KEY_PATH` - Gina's deploy key (authorized on server)
- `REDACTED_SSH_KEY_PATH` - GitHub Actions deploy key (authorized on server)
- GitHub secret `DEPLOY_SSH_KEY` is configured in the repo

## Project Structure

```
backend/
  db/init.sql              - DB schema + seed data
  src/index.js             - Express + Socket.io server entry
  src/routes/auth.js       - Register/login endpoints
  src/routes/users.js      - User CRUD + avatar config
  src/routes/moods.js      - Mood state queries
  src/services/statusEngine.js    - Core mood calculation engine (15s tick)
  src/services/mockIntegrations.js - Simulated Jira/Gmail/Calendar events
  src/services/officeEvents.js     - Random office events (30s tick)
  src/socket/handler.js    - WebSocket connection handling

frontend/
  src/App.js               - State-based routing (landing -> avatar gen -> office)
  src/pages/Landing.js     - Landing page with login/register modals
  src/pages/AvatarGenerator.js - Pixel art avatar customization
  src/pages/Office.js      - Virtual office with Canvas + sidebar
  src/canvas/avatarSprites.js  - Sprite layer system (body, clothes, hair, accessories)
  src/canvas/officeRenderer.js - Office map rendering (desks, rooms, decorations, avatars)
  nginx.conf               - Reverse proxy config

tests/e2e/                 - Playwright tests (landing, avatar, office, API)
doc/                       - technical_doc.md, spec_improvement.md
```

## Development Commands

```bash
# Local development with Docker
docker compose up --build

# Deploy manually to server
ssh -p REDACTED_SSH_PORT ubuntu@REDACTED_SERVER_IP
cd /app && git pull && sudo docker compose down && sudo docker compose build --no-cache && sudo docker compose up -d

# Verify production health
curl http://REDACTED_PRODUCTION_HOST:443/api/health
```

## Specs Reference

**IMPORTANT**: The file `specs.md` in the project root is the authoritative specification for this project. All implementation decisions must follow `specs.md` strictly. When in doubt, defer to what the spec says.

- `specs.md` - Full functional and technical specification (source of truth)
- `doc/spec_improvement.md` - Suggested improvements beyond the spec
- `doc/technical_doc.md` - Technical architecture documentation

### Key spec constraints to always respect

- Avatar sprites must be 16x16 pixels, scaled x4 to 64x64 on screen
- Sprite layers order: body base -> clothes -> hair -> accessories
- Mood values are always 0-10, all moods always have a value
- Actions change on: completion, significant mood shift, or after 30 minutes
- Status Engine polls integrations every 15 seconds
- Mock users: David, Alfredo, Jose Antonio, Jose Luis, Carlos
- Office map: 8 desks (2 rows of 4), meeting room (bottom-right), break area (bottom-left)
- Docker Compose with 3 services: frontend, backend, postgres (PostgreSQL 16)
- App listens on port 443
- Landing page modals use JavaScript vanilla for open/close
- Deployment via git pull + docker compose on server at /app
