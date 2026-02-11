# 🤖 Discord Bot — Completo con Dashboard

Bot de Discord con moderación, gestión de canales, verificación creativa, anuncios programados y panel web de administración.

---

## 📋 Resumen de Funcionalidades

| Módulo | Comandos |
|--------|----------|
| 🛡️ Moderación | `/kick` `/ban` `/mute` `/unmute` `/warn` `/warnings` `/clear` |
| 📁 Canales | `/createchannel` `/deletechannel` `/editchannel` `/lockdown` `/permissions` |
| 📢 Anuncios | `/announce` `/schedule` `/scheduled` |
| 🔐 Verificación | `/setupverify` (puzzle, colores, matemáticas, pregunta) |
| 🏗️ Setup | `/setup` (crea estructura completa con 3 plantillas) |
| 🎮 General | `/ping` `/serverinfo` `/userinfo` `/avatar` `/say` `/help` |
| 🌐 Dashboard | Panel web con stats, envío de mensajes, gestión de anuncios |

---

## 🎯 QUÉ HACES TÚ vs QUÉ HACE CLAUDE CODE

### ✅ Lo que TÚ debes hacer (solo esto):

#### 1. Crear el Bot en Discord (~3 min)
1. Ve a [discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **"New Application"** → nombre → **Create**
3. Menú izquierdo → **"Bot"**
4. Click **"Reset Token"** → **COPIA EL TOKEN** (solo se ve una vez)
5. Activa estos 3 **Privileged Gateway Intents**:
   - ✅ Presence Intent
   - ✅ Server Members Intent
   - ✅ Message Content Intent
6. Ve a **OAuth2 → URL Generator**:
   - Scopes: ✅ `bot` y ✅ `applications.commands`
   - Bot Permissions: ✅ `Administrator`
   - Copia la URL → ábrela → selecciona tu servidor → **Autorizar**

#### 2. Crear repo en GitHub (~1 min)
1. Ve a [github.com/new](https://github.com/new)
2. Crea un repositorio (público o privado)
3. Sube los archivos del bot (drag & drop o con git)

#### 3. Deployar en Railway (~2 min)
1. Ve a [railway.app](https://railway.app) → inicia sesión
2. **New Project** → **Deploy from GitHub Repo** → selecciona tu repo
3. Ve a **Variables** y añade:
   - `DISCORD_TOKEN` = tu token del paso 1
   - `DASHBOARD_PASSWORD` = una contraseña para el panel web
   - `DASHBOARD_SECRET` = cualquier texto aleatorio largo
   - `PORT` = `3000`
4. Railway generará un dominio → ese es tu dashboard

#### 4. Opcional: Volumen para persistencia en Railway
1. En tu servicio de Railway → **+ New** → **Volume**
2. Mount path: `/app/data`
3. Esto guarda las advertencias y anuncios entre reinicios

---

### 🤖 Lo que CLAUDE CODE hace por ti:

- ✅ Escribe todo el código del bot
- ✅ Crea el dashboard web completo
- ✅ Configura la estructura del proyecto
- ✅ Añade nuevas funcionalidades cuando se las pidas
- ✅ Corrige bugs
- ✅ Actualiza y mejora el código

---

## 🏗️ Estructura del Proyecto

```
discord-bot/
├── index.js                    # Punto de entrada principal
├── package.json
├── railway.json                # Config para Railway
├── .env.example                # Variables de entorno ejemplo
├── .gitignore
├── data/                       # Datos persistentes (JSON)
│   ├── warnings.json
│   ├── announcements.json
│   ├── settings.json
│   └── verifications.json
└── src/
    ├── commands/
    │   ├── moderation.js       # Kick, ban, mute, warn...
    │   ├── channels.js         # Crear, editar, permisos
    │   ├── announcements.js    # Anuncios programados
    │   ├── verification.js     # Sistema de verificación
    │   ├── setup.js            # Setup automático del servidor
    │   └── general.js          # Ping, info, help...
    ├── events/
    │   ├── welcome.js          # Bienvenida a nuevos miembros
    │   └── verification.js     # Handler de botones/modals
    ├── utils/
    │   └── database.js         # Base de datos JSON
    └── dashboard/
        ├── server.js           # Express API + servidor web
        └── public/
            └── index.html      # Dashboard frontend
```

---

## 🚀 Desarrollo Local

```bash
# 1. Clonar e instalar
git clone <tu-repo>
cd discord-bot
npm install

# 2. Configurar
cp .env.example .env
# Edita .env con tu token y contraseñas

# 3. Ejecutar
npm start
# Bot: ✅ conectado
# Dashboard: http://localhost:3000
```

---

## 🔐 Verificación Creativa

El sistema `/setupverify` ofrece 4 tipos de desafíos:

| Tipo | Descripción |
|------|-------------|
| 🧩 Puzzle | Acertijos en español que el usuario debe resolver |
| 🎨 Colores | Secuencia de emojis de colores para memorizar |
| 🔢 Matemáticas | Operación aritmética aleatoria |
| 📝 Pregunta | Pregunta abierta con mínimo de 10 palabras |

---

## 🏗️ Plantillas de Setup (`/setup`)

| Plantilla | Ideal para |
|-----------|------------|
| 🎮 Gaming | Comunidades de videojuegos |
| 🌍 Comunidad | Servidores generales |
| 💼 Empresa | Equipos de trabajo |

Cada plantilla crea automáticamente: categorías, canales de texto y voz, roles con colores, permisos de staff, y publica las reglas.

---

## 🌐 Dashboard

Panel web accesible desde cualquier navegador:
- 📊 Vista general (stats, uptime, latencia)
- 🏠 Lista de servidores con canales y roles
- 📢 Crear/pausar/eliminar anuncios programados
- 💬 Enviar mensajes como el bot a cualquier canal
- ⚠️ Ver historial de advertencias

---

## 💡 Ideas para Pedirle a Claude Code

Puedes pedirle a Claude Code que agregue:
- Sistema de niveles y experiencia
- Auto-roles con botones/menús
- Sistema de tickets de soporte
- Logs de moderación en un canal
- Sistema de economía con monedas
- Integración con APIs externas
- Juegos dentro de Discord
- Sistema de encuestas
- Auto-moderación (filtro de palabras)
