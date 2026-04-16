# Mad Office

Plataforma de oficina virtual con avatares pixel art automatizados. Los avatares reflejan el estado de animo real de cada miembro del equipo basandose en integraciones con Jira, correo y calendario.

**Produccion**: http://REDACTED_PRODUCTION_HOST/

## Stack Tecnologico

- **Frontend**: React 18 + HTML5 Canvas (sprites pixel art 16x16 escalados)
- **Backend**: Node.js + Express
- **Tiempo real**: Socket.io (WebSockets con fallback)
- **Base de datos**: PostgreSQL 16
- **Contenedores**: Docker Compose (3 servicios)
- **CI/CD**: GitHub Actions

## Inicio Rapido (Desarrollo Local)

### Requisitos

- Docker y Docker Compose
- Git

### 1. Clonar el repositorio

```bash
git clone git@github.com:ouendinga/mad-office.git
cd mad-office
```

### 2. Configurar variables de entorno (opcional)

```bash
cp .env.example .env
# Editar .env si necesitas cambiar passwords/secrets
```

### 3. Levantar con Docker Compose

```bash
docker compose up --build
```

La aplicacion estara disponible en:
- **Frontend**: http://localhost:80
- **Backend API**: http://localhost:3001
- **PostgreSQL**: localhost:5432

### 4. Usuarios de prueba predefinidos

Los siguientes usuarios se crean automaticamente:
- David (david@madoffice.com)
- Alfredo (alfredo@madoffice.com)
- Jose Antonio (jose.antonio@madoffice.com)
- Jose Luis (jose.luis@madoffice.com)
- Carlos (carlos@madoffice.com)

Para hacer login, usa cualquiera de estos emails.

## Desarrollo sin Docker

### Backend

```bash
cd backend
npm install
npm run dev
```

Requiere PostgreSQL corriendo en localhost:5432.

### Frontend

```bash
cd frontend
npm install
npm start
```

## Despliegue en Servidor

### Entorno de Produccion

- **URL**: http://REDACTED_PRODUCTION_HOST:443/
- **Servidor**: AWS EC2 (eu-south-2) - Ubuntu 24.04 LTS
- **IP**: REDACTED_SERVER_IP
- **Puerto SSH**: REDACTED_SSH_PORT
- **Usuario**: ubuntu
- **Directorio**: /app
- **Estado**: Desplegado y operativo

### Acceso SSH al servidor

```bash
ssh -p REDACTED_SSH_PORT ubuntu@REDACTED_SERVER_IP
```

### Preparar el servidor (ya completado)

Los siguientes pasos ya se ejecutaron en el servidor:

```bash
# Git ya preinstalado en Ubuntu 24.04

# Docker instalado via script oficial
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu

# Claves SSH autorizadas
# - github-actions-deploy (para CI/CD automatico)
# - gina.chaparro@globant.com (para acceso manual)
```

### Despliegue automatico (CI/CD)

Cada push a la rama `main` activa el workflow de GitHub Actions (`.github/workflows/deploy.yml`) que:
1. Se conecta al servidor por SSH (puerto REDACTED_SSH_PORT)
2. Hace `git pull` del repositorio en `/app`
3. Ejecuta `docker compose down && docker compose build --no-cache && docker compose up -d`
4. Limpia imagenes Docker antiguas

El secreto `DEPLOY_SSH_KEY` ya esta configurado en el repositorio de GitHub.

### Despliegue manual

```bash
ssh -p REDACTED_SSH_PORT ubuntu@REDACTED_SERVER_IP
cd /app
git pull origin main
sudo docker compose down
sudo docker compose build --no-cache
sudo docker compose up -d
```

### Verificar estado del despliegue

```bash
ssh -p REDACTED_SSH_PORT ubuntu@REDACTED_SERVER_IP "sudo docker ps && curl -s http://localhost:3001/api/health"
```

## Estructura del Proyecto

```
mad-office/
├── backend/
│   ├── db/init.sql                 # Schema de base de datos
│   ├── src/
│   │   ├── index.js                # Servidor Express + Socket.io
│   │   ├── routes/
│   │   │   ├── auth.js             # Registro y login
│   │   │   ├── users.js            # API de usuarios
│   │   │   └── moods.js            # API de estados de animo
│   │   ├── services/
│   │   │   ├── statusEngine.js     # Motor de estados de animo
│   │   │   ├── mockIntegrations.js # Simulador de integraciones
│   │   │   └── officeEvents.js     # Eventos aleatorios de oficina
│   │   └── socket/handler.js       # WebSocket handler
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── public/index.html
│   ├── src/
│   │   ├── App.js                  # Router principal
│   │   ├── pages/
│   │   │   ├── Landing.js          # Landing page + modales
│   │   │   ├── AvatarGenerator.js  # Generador de avatares
│   │   │   └── Office.js           # Oficina virtual
│   │   ├── canvas/
│   │   │   ├── avatarSprites.js    # Sistema de sprites pixel art
│   │   │   └── officeRenderer.js   # Renderer del mapa de oficina
│   │   └── styles/
│   ├── nginx.conf
│   ├── Dockerfile
│   └── package.json
├── doc/
│   ├── spec_improvement.md
│   └── technical_doc.md
├── tests/
│   └── e2e/
├── docker-compose.yml
├── specs.md
└── README.md
```

## Testing

```bash
# E2E tests (requiere la app corriendo)
cd tests
npx playwright test

# Backend tests
cd backend
npm test
```

## Licencia

(c) 2025 Mad Office. Todos los derechos reservados.
