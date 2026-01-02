<!-- Consolidated README: includes content from ARCHITECTURE.md, BUILD_SUMMARY.md, DELIVERABLES.md, DEPLOYMENT.md, QUICKSTART.md, and INDEX.md -->

# Connect Four — Full Stack

A production-ready Connect Four (4-in-a-row) multiplayer game with server-authoritative game logic, real-time WebSocket play, a strategic bot, persistence (Postgres), and optional analytics (Kafka).

## Quick links
- **Run (dev)**: `docker-compose up --build`
- **Backend port**: 3001
- **Frontend port**: 3000
- **Health**: `GET /health`
- **Leaderboard**: `GET /leaderboard`

## One-file docs
This README consolidates project documentation (architecture, build notes, quickstart, deployment, and deliverables).

---

## Getting started (5-minute quickstart)

1. Backend

```bash
cd backend
npm install
cp .env.example .env
npm start
```

2. Frontend (new terminal)

```bash
cd frontend
npm install
npm start
```

Open http://localhost:3000

Or run the full stack with Docker Compose:

```bash
docker-compose up --build
```

---

## High-level architecture

- Frontend: React app with components for username input, matchmaking, game board, game over, and leaderboard.
- Backend: Node.js + Express + Socket.IO. Server holds authoritative game state and validates all moves.
- Persistence: PostgreSQL for users, completed games, and leaderboard.
- Analytics (optional): Kafka producer + consumer for event streaming and metrics aggregation.
- Deployment: Dockerfiles for frontend (multi-stage + nginx) and backend (node), plus `docker-compose.yml` and cloud/K8s guidance.

---

## Backend — files & logic (summary)

The backend lives under `backend/src` and the key modules are:

- `index.js` — server entry. Initializes DB and Kafka (if enabled), registers routes and WebSocket handlers, and starts the HTTP + Socket.IO server.

- `config/database.js` — Postgres pool and `initializeDatabase()` which creates `users`, `games`, and `leaderboard` tables on startup.

- `config/kafka.js` — Kafka client initialization exposing `producer`, `consumer`, and `initializeKafka()`.

- `models/Board.js` — Core game board:
  - Grid: 7 columns × 6 rows representation with `colHeights` for O(1) drops.
  - `isValidMove(col)`, `makeMove(col, player)`, `checkWin(row,col,player)` (checks 4 directions), `isFull()`, and utilities like `clone()`.

- `models/BotAI.js` — Bot strategy:
  - Priority: immediate winning move, block opponent winning move, prefer center columns [3,2,4,1,5,0,6], fallback heuristic/minimax.
  - Exposes `getBestMove(board, botPlayer, opponentPlayer)`.

- `models/Game.js` — Game instance and lifecycle:
  - Tracks board, players, `currentTurn`, `state`, `startTime`, `playerSockets`, reconnect timers.
  - `makeMove(col, player)` validates turn and move, updates state, detects win/draw, and returns structured result.
  - `persistGame()` saves completed games to DB and updates leaderboard atomically.

- `services/GameManager.js` — Matchmaking and game registry:
  - Keeps `waitingQueue`, `games`, and `userGames` maps.
  - `addToQueue(username, onBotReady)` enqueues with a MATCH_WAIT_TIME timeout (default 60s) to spawn a bot game.
  - `checkForMatchmake()` pairs players into PvP and `startBotGame()` for timeouts.

- `websocket/handlers.js` — Socket.IO handlers:
  - `join_game` handler: validates username, supports reconnection, enqueues players, handles immediate PvP matches, and starts bot games when timeouts fire.
  - `make_move` handler: authoritatively maps socket to player, calls `game.makeMove()`, emits `move_made`, triggers bot moves (500ms delay) when applicable, and calls `handleGameOver()`.
  - Disconnect / reconnect: starts per-player reconnect timers (default 120s) and forfeit handling.

- `analytics/AnalyticsService.js` & `AnalyticsConsumer.js` — Optional Kafka emitter and consumer. Events: `GAME_STARTED`, `MOVE_PLAYED`, `GAME_FINISHED`, `PLAYER_FORFEIT`. Consumer aggregates metrics in memory for quick inspection.

- `routes/leaderboard.js` — Simple REST handler using DB to return the top 100 players.

Notes on data flow:

- When two users are matched, `GameManager.startPvPGame()` creates a `Game` instance and both sockets join a Socket.IO room named by `game.id`.
- All moves are validated server-side via `Game.makeMove`. On game finish, `Game.persistGame()` writes the game and updates the `leaderboard` table.

---

## Frontend (brief)

- React app in `frontend/src` with components:
  - `UsernameInput`, `Matchmaking`, `GameBoard`, `GameOver`, `Leaderboard`.
- Talks to backend via Socket.IO for real-time events and via REST for leaderboard.
- `Dockerfile.dev` is a dev image (node + npm start). `Dockerfile` builds production assets and serves with nginx.

---

## Environment variables

Set in `.env` files (examples at `backend/.env.example` and `frontend/.env.example`). Important ones:

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `PORT` — backend port (3001)
- `CORS_ORIGIN` — frontend origin
- `MATCH_WAIT_TIME` — matchmaking timeout (ms, default 60000)
- `RECONNECT_TIMEOUT` — reconnect window (ms, default 120000)
- `KAFKA_BROKERS`, `KAFKA_TOPIC_EVENTS`, `ANALYTICS_ENABLED`

---

## WebSocket events (summary)

- Client → Server: `join_game`, `make_move`, `game_forfeit`
- Server → Client: `queued`, `game_start`, `game_reconnected`, `move_made`, `game_over`, `player_disconnected`, `player_reconnected`, `error`

---

## Deployment options (summary)

- Local dev: `docker-compose up --build` (Postgres + Kafka optional)
- Containers: build `backend` and `frontend` images (Dockerfiles included)
- Cloud: Azure App Service, AKS, or other cloud providers — see previous docs for example `az` and `kubectl` commands.

---

## Troubleshooting (quick)

- DB connection: ensure Postgres running and env vars are correct; `createdb connect_four` if needed.
- Port conflicts: change `PORT` or stop conflicting service.
- Kafka issues: set `ANALYTICS_ENABLED=false` to disable analytics.
- WebSocket errors: check `CORS_ORIGIN` and backend health (`/health`).

---

## Tests & validation

- Unit tests recommended for `Board` win detection and `BotAI` decisions.
- Manual checks: PvP game, Bot fallback, disconnect/reconnect, leaderboard updates.

---

## What I changed

- Merged `ARCHITECTURE.md`, `BUILD_SUMMARY.md`, `DELIVERABLES.md`, `DEPLOYMENT.md`, `QUICKSTART.md`, and `INDEX.md` into this single `README.md`.
- The backend summary above documents the primary files and their responsibilities (`index.js`, `config/*`, `models/*`, `services/*`, `websocket/*`, `routes/*`, `analytics/*`).

If you want, I can also remove `backend/README.md` and `frontend/README.md` and fold their content here — confirm if you want that too.

---

## License

MIT

