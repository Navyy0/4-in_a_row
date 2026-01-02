

# Connect Four — Full Stack

A production-ready Connect Four (4-in-a-row) multiplayer game with server-authoritative game logic, real-time WebSocket play, a strategic bot, persistence (Postgres).

## Quick links
- **Backend port**: 3001
- **Frontend port**: 3000
- **Health**: `GET /health`
- **Leaderboard**: `GET /leaderboard`

---

## Getting started 

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


```

---

## High-level architecture

- Frontend: React app with components for username input, matchmaking, game board, game over, and leaderboard.
- Backend: Node.js + Express + Socket.IO. Server holds authoritative game state and validates all moves.
- Persistence: PostgreSQL for users, completed games, and leaderboard.
- Analytics (optional): Kafka producer + consumer for event streaming and metrics aggregation.


---

## Project Structure

d:/task-backend/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js        ← PostgreSQL setup
│   │   │   └── kafka.js           ← Kafka client
│   │   ├── models/
│   │   │   ├── Board.js           ← Game board (7x6) & validation
│   │   │   ├── BotAI.js           ← Bot strategy (win/block/center)
│   │   │   └── Game.js            ← Game state management
│   │   ├── services/
│   │   │   └── GameManager.js     ← Matchmaking queue & lifecycle
│   │   ├── websocket/
│   │   │   └── handlers.js        ← Socket.IO event handlers
│   │   ├── routes/
│   │   │   └── leaderboard.js     ← REST API /leaderboard
│   │   ├── analytics/
│   │   │   ├── AnalyticsService.js ← Kafka producer
│   │   │   └── AnalyticsConsumer.js ← Event aggregator
│   │   └── index.js               ← Express server startup
│   ├── package.json
│   ├── .env.example
│   ├── Dockerfile
│   └── README.md
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── UsernameInput.js   ← Login screen
│   │   │   ├── Matchmaking.js     ← Queue waiting UI
│   │   │   ├── GameBoard.js       ← 7×6 game board UI
│   │   │   ├── GameOver.js        ← Result screen
│   │   │   └── Leaderboard.js     ← Rankings display
│   │   ├── App.js                 ← Main component
│   │   ├── App.css
│   │   ├── index.js
│   │   └── index.css
│   ├── public/
│   │   └── index.html
│   ├── package.json
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   ├── nginx.conf
│   └── .env.example
│
├── docker-compose.yml             ← Complete stack
├── README.md                       ← Main documentation
├── QUICKSTART.md                   ← 5-minute setup
├── DEPLOYMENT.md                   ← Production guide
└── ARCHITECTURE.md               ← This file
```

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

## Core Features Implemented

### 1. Game Board & Rules ✓
- 7 columns × 6 rows board
- Gravity simulation (discs fall to lowest slot)
- Win detection (4 in a row): horizontal, vertical, diagonal
- Draw detection (full board)
- Move validation (column exists, not full, correct turn)

### 2. Player Matching ✓
- Automatic queue-based matchmaking
- 60-second timeout for opponent finding
- Auto-switch to bot if timeout
- Unique gameId per game (hidden from users)
- No room codes, no invites

### 3. Real-Time Gameplay ✓
- WebSocket (Socket.IO) for instant communication
- Server-authoritative (all moves validated server-side)
- Move broadcast to both players
- Turn switching
- Game-over detection and broadcast

### 4. Disconnection & Reconnect ✓
- 120-second reconnection window
- Game state preserved in memory
- Auto-resume on reconnect with same username
- Automatic forfeit if timeout
- Connection status notifications

### 5. Bot AI ✓
- **Priority 1**: Play winning move (if available)
- **Priority 2**: Block opponent's winning move
- **Priority 3**: Prefer center columns [3, 2, 4, 1, 5, 0, 6]
- **Priority 4**: Heuristic evaluation (threats, opportunities)
- Response time: ~500ms

### 6. Persistence ✓
- PostgreSQL database
- Users table (username only)
- Games table (results, duration, type)
- Leaderboard (wins per user)
- Auto-initialization on startup

### 7. Leaderboard ✓
- Track wins per user
- REST API endpoint: GET /leaderboard
- Top 100 players displayed
- Updates after each game

### 8. Analytics ✓
- Kafka event producer
- Events: GAME_STARTED, MOVE_PLAYED, GAME_FINISHED, PLAYER_FORFEIT
- Kafka consumer for aggregation
- Metrics: games/day, top winners, avg duration
- Optional (can be disabled)

### 9. Frontend UI ✓
- Username input screen
- Matchmaking waiting screen
- 7×6 game board with color-coded discs
- Real-time opponent/bot moves
- Game result screen
- Leaderboard display
- Minimal, functional design

### 10. REST API ✓
- GET /leaderboard - Returns top players
- GET /health - Server status
- CORS configured
- Error handling

---

## WebSocket Event Flow

```
Client                          Server                    Other Client
  │                              │                            │
  ├─── join_game ──────────────► │                            │
  │                              ├─ Add to queue              │
  │                              │                            │
  │                            [60s timeout...]               │
  │                              │                            │
  │       ◄─── game_start ────────┤ ◄─── join_game ──────────┤
  │              (players: {1,2}) │      (another player)     │
  │                              │                            │
  ├─── make_move ──────────────► │                            │
  │      (col: 3)                ├─ Validate move             │
  │                              ├─ Update board              │
  │                              ├─ Check win                 │
  │       ◄── move_made ──────────┤ ──► move_made ────────────┤
  │       (row: 5, player: 1)    │     (row: 5, player: 1)   │
  │                              │                            │
  │ [Next move from opponent]    │                            │
  │       ◄── move_made ──────────┤ ◄── make_move ────────────┤
  │       (row: 4, player: 2)    │     (col: 4)              │
  │                              │                            │
  │ [Continue until game over]   │                            │
  │                              │                            │
  │       ◄── game_over ──────────┤ ──► game_over ────────────┤
  │       (winner: 1, result)    │     (winner: 1, result)   │
```

---

## Database Schema

```sql
users:
├── id (PRIMARY KEY)
├── username (UNIQUE, VARCHAR 50)
└── created_at (TIMESTAMP)

games:
├── id (VARCHAR 36, PRIMARY KEY)
├── player1_id (FOREIGN KEY → users.id)
├── player2_id (FOREIGN KEY → users.id, nullable for bot)
├── winner_id (FOREIGN KEY → users.id, nullable for draw)
├── duration (INTEGER - seconds)
├── game_type (VARCHAR 20 - 'pvp' or 'bot')
└── created_at (TIMESTAMP)

leaderboard:
├── username (VARCHAR 50, UNIQUE)
├── wins (INTEGER)
└── updated_at (TIMESTAMP)
```

---

## Key Implementation Details

### Board Representation (Efficient)
```javascript
// Column-based height tracking for O(1) drops
grid: [[piece00, piece10, ...], [...], ...]
colHeights: [1, 3, 2, 0, 4, 1, 2] // Height in each column
```

### Win Detection (O(7) per move)
```javascript
// Check 4 directions from placed piece
// Horizontal, Vertical, Diagonal /, Diagonal \
// Count consecutive pieces in each direction
```

### Game Manager (Central)
```javascript
// Maintains:
games = { gameId: GameInstance }
waitingQueue = [{ username, timeoutId }]
userGames = { username: gameId }
// Single matchmaking point
```

### Socket.IO Rooms
```javascript
// Each game = socket.io room
io.to(gameId).emit('event') // Broadcast to game
socket.join(gameId)          // Add player to room
```

---

## Matchmaking Algorithm

```javascript
// Every join_game event:
1. Add username to waitingQueue
2. Set 60s timeout to create bot game
3. If queue has 2+ players:
   - Remove both from queue
   - Cancel timeouts
   - Create PvP game
   - Emit game_start to both
4. If 60s elapses with 1 player:
   - Create game vs Bot
   - Emit game_start
```

---

## Bot AI Algorithm

```javascript
// For each move:
1. Try each valid move
   a. If creates 4 in a row → RETURN (win)
   b. If opponent could win next → RETURN (block)
2. Prefer center columns [3, 2, 4, 1, 5, 0, 6]
3. Evaluate remaining moves:
   - Count potential threats
   - Count potential opportunities
   - Prefer high-scoring moves
4. Return best-scored move
```

---

## Security Features

✓ **Server-Authoritative Game Logic** - No client-side validation
✓ **Move Validation** - All moves checked on server
✓ **Turn Verification** - Only correct player can move
✓ **Input Sanitization** - Username validation
✓ **Database Security** - Parameterized queries (pg library)
✓ **CORS** - Configured for specific origin
✓ **No Passwords** - Usernames only (no auth needed)
✓ **Connection Timeouts** - 120s to prevent hanging

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (React)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Username   │  │ Matchmaking  │  │  GameBoard   │  │
│  │   Screen     │  │   Waiting    │  │     7×6      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                           │
│  WebSocket (Socket.IO)                                   │
└─────────────────────────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Backend (Node.js + Express)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  GameManager │  │ WebSocket    │  │  REST API    │  │
│  │  Matchmaking │  │  Handlers    │  │  /leaderboard│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │    Board     │  │   BotAI      │                    │
│  │   Logic      │  │   Strategy   │                    │
│  └──────────────┘  └──────────────┘                    │
│                                                           │
│  Game State (Memory)     Analytics (Optional)            │
│  ┌──────────────┐        ┌──────────────┐               │
│  │   Active     │        │    Kafka     │               │
│  │   Games      │        │   Producer   │               │
│  └──────────────┘        └──────────────┘               │
└─────────────────────────────────────────────────────────┘
        ▼                          ▼
┌──────────────────┐      ┌──────────────────┐
│   PostgreSQL     │      │  Kafka Broker    │
│  (Persistence)   │      │  (Analytics)     │
│                  │      │                  │
│ • users          │      │ • game events    │
│ • games          │      │ • metrics        │
│ • leaderboard    │      │ • aggregation    │
└──────────────────┘      └──────────────────┘
```

---


## Troubleshooting (quick)

- DB connection: ensure Postgres running and env vars are correct; `createdb connect_four` if needed.
- Port conflicts: change `PORT` or stop conflicting service.
- Kafka issues: set `ANALYTICS_ENABLED=false` to disable analytics.
- WebSocket errors: check `CORS_ORIGIN` and backend health (`/health`).

---



