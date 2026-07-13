# Relay

Temporary encrypted workspace between exactly two endpoints. Ephemeral by design — everything lives in memory and disappears when the server restarts.

Built to feel like Warp, Raycast, Linear, and Vercel: calm, fast, and intentionally minimal. Not a messaging product.

## Philosophy

Relay creates a temporary encrypted workspace where two people can securely exchange information. Nothing is permanently stored. Every session is transient by design.

## Architecture

```
terminalchat/
├── client/     React + Vite + Tailwind + Framer Motion (PWA)
├── server/     Node.js + Express + Socket.IO (in-memory Maps)
├── shared/     Shared TypeScript types & socket event names
└── README.md
```

### Data model

No database required for local `npm run dev` (in-memory Maps). With Docker / `DATABASE_URL`, rooms + messages persist in Postgres across restarts; Redis powers multi-instance Socket.IO.

| Key | Contents |
|-----|----------|
| Room ID | Host socket, guest socket, messages, invite token, lock state, timestamps |
| Invite token index | Token → room ID (removed after successful join) |
| Socket index | Socket ID → room + role |

When the process restarts, all sessions vanish. That is intentional.

### Session flow

1. Host clicks **Initialize Workspace**
2. Server generates a room ID + 40-character invite token
3. Host joins immediately and can copy / share / show QR
4. Guest opens invite → Connecting → Verifying → Waiting for Host Approval
5. Host accepts or rejects
6. On accept, the room locks permanently (max 2 users) and the invite expires

## Requirements

- Node.js 20+
- npm 10+

## Installation

```bash
npm install
```

## Docker (Postgres + Redis + Relay)

One stack with durable rooms (Postgres), Socket.IO scale-out (Redis), and the web app served from the API container.

```bash
docker compose up --build
```

- App: http://localhost:3001  
- Health: http://localhost:3001/health (`storage: "postgres+memory"`)  
- Postgres: `localhost:5432` (user/pass/db: `relay`)  
- Redis: `localhost:6379`

GitHub Actions (`.github/workflows/ci.yml`) on every push to `main`:

1. Typecheck + build  
2. Build & push image to `ghcr.io/<owner>/relayworkspace`  
3. Compose smoke test (build, boot, hit `/health`)

Pull the published image:

```bash
docker pull ghcr.io/csmanojfamra/relayworkspace:latest
```

## Development

Run API and client together from the repo root:

```bash
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:3001
- Health: http://localhost:3001/health

### Environment variables

**Server** (`server/`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP / Socket.IO port |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `DATABASE_URL` | _(unset)_ | Postgres URL — enables room persistence |
| `REDIS_URL` | _(unset)_ | Redis URL — Socket.IO adapter |
| `STATIC_DIR` | _(unset)_ | Path to built client (`client/dist` in Docker) |

**Client** (`client/`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_SOCKET_URL` | `http://localhost:3001` locally | Socket.IO server URL |
| `VITE_API_PROXY` | `http://localhost:3001` | Dev proxy target for `/socket.io` |

Create `client/.env.production` for Netlify (or set the same variable in the Netlify UI):

```env
VITE_SOCKET_URL=https://your-railway-app.up.railway.app
```

`VITE_SOCKET_URL` is baked in at **build time**. After changing it, trigger a new Netlify deploy.

Create Railway env:

```env
CLIENT_ORIGIN=https://your-netlify-site.netlify.app
PORT=3001
```

### Live site button stays disabled?

The landing CTA enables only when the browser is connected to the Socket.IO API.

1. Deploy the **server** on Railway and confirm `https://YOUR-API/health` returns JSON.
2. In Netlify → Site settings → Environment variables, set `VITE_SOCKET_URL` to that Railway URL.
3. Redeploy the Netlify site (env vars apply on build).
4. On Railway, set `CLIENT_ORIGIN` to your exact Netlify origin (e.g. `https://something.netlify.app`).

Until the frontend can reach the backend, the UI will show **Relay unreachable**.

## Production build

```bash
npm run build
npm start
```

`npm start` serves the Socket.IO API. The static client is deployed separately (Netlify).

## Deployment

### Backend — Railway

1. Create a new Railway project from this repo
2. Root directory: repository root (npm workspaces)
3. Start command: `npm run start -w server`
4. Build command: `npm install && npm run build -w shared && npm run build -w server`
5. Set `CLIENT_ORIGIN` to your Netlify URL
6. Expose the service port (Railway sets `PORT` automatically)

`server/railway.json` is included as a starting point.

### Frontend — Netlify

1. Create a Netlify site from this repo
2. Base directory: repository root
3. Build command: `npm run build -w shared && npm run build -w client`
4. Publish directory: `client/dist`
5. Set `VITE_SOCKET_URL` to your Railway public URL
6. `client/netlify.toml` already configures SPA redirects and caching

Alternatively point Netlify at `client/` and use the included `netlify.toml` with workspace-aware install from the monorepo root.

### CORS checklist

- Railway `CLIENT_ORIGIN` must exactly match the Netlify origin (scheme + host, no trailing slash mismatch)
- Client `VITE_SOCKET_URL` must point at the Railway HTTPS origin

## PWA

The client ships as an installable Progressive Web App:

- Web app manifest
- Service worker (auto-update via `vite-plugin-pwa`)
- Offline shell for static assets
- Theme color + Apple touch icons
- Standalone / portrait display mode

Add to Home Screen on iOS/Android for a chrome-less native feel.

## Themes

Switch instantly from the session sidebar:

- Modern Dark
- Linux Green
- Amber CRT
- Blue Terminal
- White Terminal

## Socket events

`create-room` · `join-room` · `join-request` · `accept-request` · `reject-request` · `send-message` · `receive-message` · `message-updated` · `message-deleted` · `typing-start` · `typing-stop` · `seen` · `heartbeat` · `disconnect`

### Ephemeral notes

Notes live only in server memory for the active session. Lines are **not** auto-deleted after both people have seen them — the shared note stays until someone clears it or the session ends.

- **Clear all:** type `/clear` (or `/clear all`) while writing, or use Clear in the header/sidebar. Both clients receive `messages-cleared`.
- **Delete a line:** edit a line empty (Backspace), or remove it while editing.
- **Session end:** when the room is destroyed (both leave / invite expires), messages and invite state are wiped — no durable history.

## Troubleshooting

**Invite Expired**  
The token was already consumed or the room was locked after a successful join.

**Workspace Full**  
Two endpoints are already connected, or a pending request occupies the guest slot.

**Host Left**  
The host disconnected before approving. Ask them to create a new session.

**Cannot connect from production**  
Verify `VITE_SOCKET_URL` and Railway `CLIENT_ORIGIN`. Check the browser console for CORS / websocket errors.

**Blank screen after deploy**  
Confirm Netlify publish dir is `client/dist` and the SPA redirect to `/index.html` is active.

**Everything disappeared**  
The server restarted. In-memory storage was cleared by design.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Client + server in watch mode |
| `npm run build` | Build shared, server, and client |
| `npm start` | Start production server |
| `npm run typecheck` | Strict TypeScript across packages |

## License

Private / all rights reserved unless you decide otherwise.
