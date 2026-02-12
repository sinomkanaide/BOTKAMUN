# BOTKAMUN — Full Development Context

> Backup document for Claude Code context. Contains everything built, changed, and configured across all sessions.

---

## Project Overview

- **Bot Name**: BotKAMUN#8136
- **Project Path**: `C:\Users\Juegos\discord-bot` (Bash: `/c/Users/Juegos/discord-bot`)
- **Repository**: https://github.com/sinomkanaide/BOTKAMUN.git
- **Hosting**: Railway (auto-deploy from `main` branch)
- **Dashboard URL**: https://botkamun-production.up.railway.app
- **Stack**: Node.js, discord.js v14, Express.js
- **Database**: JSON files via `src/utils/database.js`
- **Guild ID**: `1470934906468044962`
- **Authorized Dashboard User**: `tapkamun`

---

## Architecture

```
discord-bot/
├── index.js                          # Main entry, interaction routing
├── src/
│   ├── commands/
│   │   ├── moderation.js             # kick, ban, mute, unmute, warn, warnings, clear (English)
│   │   ├── channels.js               # Channel management commands
│   │   ├── announcements.js          # Scheduled announcement commands
│   │   ├── verification.js           # /setupverify — creative verification (English)
│   │   ├── setup.js                  # Server templates + channel types
│   │   ├── general.js                # General utility commands
│   │   ├── tickets.js                # setuptickets, tickettype, deploytickets (dropdown)
│   │   └── egypt-roles.js            # Rank hierarchy, game API config, setupclaim, ranks
│   ├── events/
│   │   ├── welcome.js                # Welcome message + auto-assign Slave role
│   │   ├── verification.js           # Verify button/modal handlers (Slave stays on verify)
│   │   ├── tickets.js                # handleButton, handleModal, handleSelectMenu
│   │   ├── claim.js                  # Wallet claim system
│   │   └── automod.js                # Full AutoMod engine (7 modules)
│   ├── dashboard/
│   │   ├── server.js                 # Express API routes + OAuth2
│   │   ├── auth-middleware.js         # requireAuth middleware
│   │   ├── claim-routes.js           # Ranks, wallets, game API endpoints
│   │   └── public/
│   │       ├── index.html            # Single-page dashboard app (English)
│   │       └── verify.html           # Wallet verification page
│   └── utils/
│       └── database.js               # JSON file store (Railway volume or local ./data)
├── package.json
├── .env                              # DISCORD_TOKEN, DISCORD_CLIENT_ID, etc.
└── discordcontext.md                 # This file
```

---

## Data Persistence

- **Railway Volume** mounted at `/data`
- `database.js` checks `RAILWAY_VOLUME_MOUNT_PATH` env var
- Stores in `RAILWAY_VOLUME_MOUNT_PATH/db/` when on Railway
- Falls back to `./data/` for local development
- This was critical — before the volume, every Railway deploy wiped all data

---

## Feature 1: MEE6-Style Dropdown Ticket Panel

**What**: Replaced individual buttons with a single `StringSelectMenuBuilder` dropdown for ticket type selection.

**How it works**:
1. Admin runs `/setuptickets` → sets panel channel
2. Admin runs `/tickettype` → adds ticket types (id, name, emoji, description, handler role)
3. Admin runs `/deploytickets` → posts embed with dropdown in the panel channel
4. User selects type from dropdown → modal asks for description → ticket channel created

**Key details**:
- customId: `ticket_select` → routed via `interaction.isStringSelectMenu()` in `index.js`
- Categories **auto-created** from ticket type name on deploy (no manual category picker)
- Channel naming: `{type}-{username}-{ticketNumber}` (e.g. `support-pepito-0001`)
- Category fallback: if category is deleted, auto-creates when opening a ticket
- Ticket channels have permission overwrites: user + handler role can see, @everyone denied
- Handler role gets pinged on ticket creation (auto-deleted after 5 seconds)
- Claim/Close buttons inside ticket channels (still buttons, not dropdown)
- Close button shows modal for reason, then channel auto-deletes after 5 seconds

**Files changed**: `src/commands/tickets.js`, `src/events/tickets.js`, `src/dashboard/server.js`, `index.js`, `src/dashboard/public/index.html`

---

## Feature 2: Egyptian Rank System + Game API

**Rank hierarchy** (default):
| Level | Role | Description |
|-------|------|-------------|
| 0 | ⛓️ Slave | Newcomer (auto-assigned on join) |
| -1 | 🏺 Citizen | Verified in the kingdom |
| 3 | ⚒️ Craftsman | Artisan of the Pharaoh |
| 10 | 🏛️ Official | Officer of the empire |
| 25 | 📜 Scribe | Sacred scribe |
| 50 | 🔱 High Priest | Right hand of the Pharaoh |

**Admin roles** (created by /setuproles): ☀️ Pharaoh (Administrator), 🐍 Vizier (ManageGuild+)

**Game API configuration**:
- Base URL: `https://api.tapkamun.fun`
- Endpoint: `/api/public/check/level/{wallet}`
- Level field: `level`
- API Key: empty (public API)

**Claim flow**:
1. User clicks "Claim Your Rank" button in claim channel
2. Opens wallet verification page (verify.html)
3. User connects MetaMask, signs message
4. Backend queries game API with wallet address
5. Gets player level, determines rank
6. Assigns Discord role, removes old rank roles

**Dashboard features**:
- Ranks page: hierarchy table, add/edit/delete ranks
- Game API config card with test connection button
- Test connection proxied through backend (POST `/api/gameapi/:guildId/test`) to avoid CORS
- Wallets page: shows all linked wallets with user ID, wallet address, rank, level, last claim

**Files**: `src/commands/egypt-roles.js`, `src/events/claim.js`, `src/dashboard/claim-routes.js`, `src/dashboard/public/verify.html`

---

## Feature 3: Role Progression (IMPORTANT)

This is the exact intended flow — do NOT change without asking:

1. **Join server** → auto-assign **⛓️ Slave** role (level 0) via `welcome.js`
2. **Verify** → add **🏺 Citizen** role. **Slave STAYS** (NOT removed)
3. **Claim first rank** (e.g. Craftsman at level 3+) → **remove Slave**, add Craftsman
4. **Level up** (e.g. Official at level 10+) → remove Craftsman, add Official
5. Slave is ONLY removed on first game rank claim, NOT on verification

**Key code locations**:
- `src/events/welcome.js:5-24` — assigns Slave on join
- `src/events/verification.js:87-95` — adds Citizen, does NOT remove Slave (comment: "Slave role stays")
- `src/dashboard/claim-routes.js:141-167` — removes old rank roles + Slave on claim

---

## Feature 4: Verification System

**Commands**: `/setupverify channel:#channel role:@role type:puzzle|colors|math|question`

**Challenge types**:
- **Puzzle**: Solve a riddle (answer checked exactly)
- **Colors**: Memorize emoji color sequence
- **Math**: Solve arithmetic operation
- **Question**: Open-ended, must be 10+ words

**Flow**: Click "Verify Me" button → modal with challenge → correct answer assigns Citizen role

**All in English** — commands, challenges, embeds, dashboard page

---

## Feature 5: Embed Builder (Send Message Page)

**Dashboard page**: 2-column layout with form + live preview panel

**Fields**:
- Content (plain text)
- Embed: Title, Color, Description, Image URL, Thumbnail URL, Footer text, Footer icon URL
- Live preview updates on input via `updateEmbedPreview()`

**Backend**: `POST /api/send-message` handles all embed fields including image, thumbnail, footerIcon

---

## Feature 6: AutoMod System (No Human Moderators)

**File**: `src/events/automod.js` — complete engine with 7 filter modules

**Modules**:
1. **Spam Filter** — Rate limit (max messages in time window) + duplicate detection
2. **Word Filter** — Blacklisted words/phrases, auto-delete + warn
3. **Link Filter** — Block Discord invites and/or all links (with whitelist)
4. **Mention Spam** — Block mass mentions (configurable max)
5. **Caps Filter** — Block messages mostly in UPPERCASE (configurable % threshold)
6. **Anti-Raid** — Detect mass joins, lockdown server (remove SendMessages from @everyone), auto-unlock
7. **Warning Escalation** — Configurable thresholds: 3 warns→mute 60min, 5 warns→kick, 7 warns→ban

**Dashboard page**: Full config UI with toggles, ℹ️ tooltips on every field explaining what it does

**Key details**:
- In-memory trackers (Maps) for spam/joins — reset on restart, acceptable
- Immunity: Admins, ManageGuild permission, and configured immune roles skip all checks
- Immune roles rendered as checkbox list (not multi-select)
- Time window displayed in seconds (converted to ms on save)
- API: GET/PUT `/api/automod/:guildId`
- Wired in `index.js`: `messageCreate` → `automod.handleMessage`, `guildMemberAdd` → `automod.handleMemberJoin`

---

## Feature 7: Scheduled Announcements

**Dashboard page**: Create announcements with channel, frequency (cron), title, color, message
**Backend**: Uses `node-cron` for scheduling, stores in JSON database
**Now saves `guildId`** for reliable multi-guild filtering

---

## Feature 8: Setup Wizard

**5-step wizard**: Template → Channels → Roles → Options → Execute

**Templates**: gaming, community, business, web3

**Options**: Delete existing channels, enable verification, deploy ticket panel

**Uses SSE** (Server-Sent Events) for real-time progress logging

---

## Dashboard Pages (All English)

| Page | Nav Label | Function |
|------|-----------|----------|
| Overview | Overview | Bot stats, scheduled announcements |
| Server Info | Info & Channels | Channel tree, roles list, member counts |
| Announcements | Announcements | Create/manage scheduled announcements |
| Send Message | Send Message | Embed builder with live preview |
| AutoMod | AutoMod | Full automod configuration with tooltips |
| Warnings | Warnings | Warning history table |
| Verification | Verification | View verification config (read-only) |
| Egyptian Ranks | Egyptian Ranks | Rank hierarchy + game API config |
| Wallets | Wallets | Linked wallets registry |
| Tickets | Tickets | Ticket types, panel config, open tickets |
| Customize | Customize | Setup wizard |

---

## Critical Fixes Applied

### Express Route Ordering
**Problem**: Catch-all `app.get("{*splat}")` was registered BEFORE `registerClaimRoutes()`, intercepting all `/api/ranks/` and `/api/wallets/` GET requests.
**Fix**: Moved catch-all INSIDE `start()` function, AFTER `registerClaimRoutes()`.

### CORS on Game API Test
**Problem**: Browser called game API directly, blocked by CORS.
**Fix**: Created backend proxy endpoint `POST /api/gameapi/:guildId/test`.

### Missing Export
**Problem**: `setApiConfig` defined in `egypt-roles.js` but not exported. Dashboard got 500 error on save.
**Fix**: Added to `module.exports`.

### Dashboard Audit (Latest)
**Bugs fixed**:
1. `updateAutomodField()` was undefined — removed onchange reference
2. `var(--bg-tertiary)` CSS variable didn't exist — changed to `var(--bg-hover)`
3. Announcement `guildId` not saved — added to POST handler

---

## index.js Interaction Routing

```javascript
// Slash commands
if (interaction.isChatInputCommand()) → allHandlers[interaction.commandName]

// Buttons
if (interaction.isButton()) {
  ticket_* → ticketEvents.handleButton
  claim_rank / view_my_rank → claimEvents.handleButton
  else → verificationEvents.handleButton
}

// Select menus
if (interaction.isStringSelectMenu()) {
  ticket_select → ticketEvents.handleSelectMenu
}

// Modals
if (interaction.isModalSubmit()) {
  ticket_* → ticketEvents.handleModal
  else → verificationEvents.handleModal
}

// Messages → automod.handleMessage
// Member joins → automod.handleMemberJoin + welcomeEvents.onMemberJoin + verificationEvents.onMemberJoin
```

---

## Environment Variables (Railway)

```
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
AUTHORIZED_DISCORD_USERS=tapkamun
DASHBOARD_SECRET=...
RAILWAY_VOLUME_MOUNT_PATH=/data
PORT=3000 (auto-set by Railway)
```

---

## Git History (Recent Commits)

```
62228f3 Dashboard audit: fix 3 bugs, translate all Spanish to English
99ed576 Redesign immune roles: 2-column grid with hover, full-width layout
b5d090c Fix tooltip readability: solid dark background instead of transparent
9a82163 Fix AutoMod dashboard: checkbox roles, tooltips, seconds time window
68e20b1 Add full AutoMod system, fix role progression, translate moderation
6040e1b Fix role progression, add embed builder with preview, translate to English
7e2a659 Use Railway volume for persistent data, translate verification to English
6c8203a Fix Game API test: proxy through backend to avoid CORS
88c70a2 Fix: export setApiConfig so dashboard can save game API config
6277596 Auto-assign Slave role to new members on join
899f97e Add Game API configuration to dashboard ranks page
a3ee59a Fix ranks and wallets API: move catch-all route after claim routes
4a31016 Auto-create ticket categories from type names, rename channels
60d273c Replace ticket panel buttons with MEE6-style dropdown select menu
```

---

*Last updated: 2026-02-11*
