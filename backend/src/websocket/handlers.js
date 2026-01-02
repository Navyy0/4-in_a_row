const GameManager = require('../services/GameManager');
const AnalyticsService = require('../analytics/AnalyticsService');
const { PLAYER1, PLAYER2 } = require('../models/Board');
require('dotenv').config();

const RECONNECT_TIMEOUT = parseInt(process.env.RECONNECT_TIMEOUT) || 120000;

function registerWebSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // User joins with username
    socket.on('join_game', async (data) => {
      // Defensive validation: ensure payload exists and username is a non-empty string
      if (!data || typeof data.username !== 'string' || data.username.trim().length === 0) {
        console.warn('Invalid join_game payload from socket', socket.id, data);
        socket.emit('error', { message: 'Invalid username' });
        return;
      }

      const username = data.username.trim();
      socket.data.username = username;

      // Check if user is already in a game
      let game = GameManager.getGameByUsername(username);

      if (game && game.state !== 'finished' && game.state !== 'forfeited') {
        // Reconnection
        const playerNum = game.players.player1.username === username ? PLAYER1 : PLAYER2;
        const playerKey = `player${playerNum}`;

        // Clear reconnect timeout
        game.clearReconnectTimeout(playerNum);

        // Reattach socket (store socket id for authoritative mapping)
        game.playerSockets[playerKey] = socket.id;
        socket.join(game.id);
        socket.data.gameId = game.id;
        socket.data.playerNum = playerNum;

        socket.emit('game_reconnected', {
          gameId: game.id,
          gameState: game.getGameState(),
          playerNum: playerNum,
        });

        io.to(game.id).emit('player_reconnected', {
          player: playerNum,
          gameState: game.getGameState(),
        });

        return;
      }

      // New game: add to queue with timeout callback for bot game
      const onBotGameReady = async (botGame) => {
        // Check if player socket still connected
        const playerSocket = Array.from(io.sockets.sockets.values()).find(
          (s) => s.data && s.data.username === username
        );

        if (!playerSocket) {
          console.log('Player disconnected before bot game started:', username);
          GameManager.deleteGame(botGame.id);
          return;
        }

        // Initialize player IDs in database
        try {
          await botGame.initializePlayerIds();
        } catch (err) {
          console.error('Failed to initialize bot game player IDs:', err);
          GameManager.deleteGame(botGame.id);
          return;
        }

        // Attach socket to game
        playerSocket.join(botGame.id);
        playerSocket.data.gameId = botGame.id;
        playerSocket.data.playerNum = PLAYER1;
        botGame.playerSockets.player1 = playerSocket.id;

        // Emit game_start to human player
        playerSocket.emit('game_start', {
          gameId: botGame.id,
          players: {
            player1: botGame.players.player1.username,
            player2: botGame.players.player2.username,
          },
          gameState: botGame.getGameState(),
          playerNum: PLAYER1,
        });

        console.log('Bot game started:', botGame.id, 'player:', username);
      };

      GameManager.addToQueue(username, onBotGameReady);
      socket.emit('queued', { queuePosition: GameManager.getWaitingQueueLength() });

      // Check if match can be made
      const match = GameManager.checkForMatchmake();
      if (match) {
        // Guard: validate ONLY usernames, not IDs (IDs assigned later in initializePlayerIds)
        const p1Username = match.players.player1.username;
        const p2Username = match.players.player2.username;
        if (
          !p1Username || !p2Username ||
          typeof p1Username !== 'string' || typeof p2Username !== 'string' ||
          p1Username.trim().length === 0 || p2Username.trim().length === 0
        ) {
          console.warn('Matchmaking returned invalid usernames, skipping startPvPGame:', match);
        } else {
          await startPvPGame(io, match);
        }
      }
    });

    // Make move
    socket.on('make_move', async (data) => {
      const { gameId, col } = data;
      const game = GameManager.getGame(gameId);

      if (!game) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }

      // Determine player number by matching socket.id to authoritative player socket ids
      const sid = socket.id;
      let playerNum = null;
      if (game.playerSockets && game.playerSockets.player1 === sid) {
        playerNum = PLAYER1;
      } else if (game.playerSockets && game.playerSockets.player2 === sid) {
        playerNum = PLAYER2;
      } else if (typeof socket.data.playerNum === 'number') {
        // fallback if mapping not yet established
        playerNum = socket.data.playerNum;
      }

      if (!playerNum) {
        socket.emit('error', { message: 'Not a participant in this game' });
        return;
      }

      const result = game.makeMove(col, playerNum);

      if (!result.success) {
        socket.emit('error', { message: result.error });
        return;
      }

      // Emit move to both players
      io.to(gameId).emit('move_made', {
        col,
        row: result.move.row,
        player: playerNum,
        gameState: game.getGameState(),
      });

      // Analytics
      const playerUsername = playerNum === PLAYER1 ? game.players.player1.username : game.players.player2.username;
      await AnalyticsService.emitMovePlayed(gameId, playerUsername, col, result.move.row);

      // Handle game over
      if (result.gameOver) {
        await handleGameOver(io, game, gameId);
      } else if (game.isBot() && game.currentTurn === PLAYER2) {
        // Bot turn
        setTimeout(() => {
          const botCol = GameManager.getBotMove(gameId);
          const botResult = game.makeMove(botCol, PLAYER2);

          io.to(gameId).emit('move_made', {
            col: botCol,
            row: botResult.move.row,
            player: PLAYER2,
            gameState: game.getGameState(),
          });

          AnalyticsService.emitMovePlayed(gameId, 'Bot', botCol, botResult.move.row);

          if (botResult.gameOver) {
            handleGameOver(io, game, gameId);
          }
        }, 500);
      }
    });

    // Player forfeit
    socket.on('game_forfeit', async () => {
      const gameId = socket.data.gameId;
      const game = GameManager.getGame(gameId);

      if (!game) return;

      const playerNum = socket.data.playerNum;
      const winner = game.forfeit(playerNum);

      io.to(gameId).emit('game_over', {
        winner,
        winnerPlayerNum: winner,
        result: 'forfeit',
        gameState: game.getGameState(),
      });

      await AnalyticsService.emitPlayerForfeit(gameId, playerNum);

      await game.persistGame();
      GameManager.deleteGame(gameId);
    });

    // Disconnect
    socket.on('disconnect', () => {
      const username = socket.data.username;
      const gameId = socket.data.gameId;

      if (!username && !gameId) {
        return; // Not in a game
      }

      if (gameId) {
        const game = GameManager.getGame(gameId);
        if (game && game.state !== 'finished' && game.state !== 'forfeited') {
          const playerNum = socket.data.playerNum;

          // Start reconnect timer
          game.setReconnectTimeout(playerNum, RECONNECT_TIMEOUT, async (player) => {
            const winner = game.forfeit(player);

            io.to(gameId).emit('game_over', {
              winner,
              winnerPlayerNum: winner,
              result: 'forfeit',
              gameState: game.getGameState(),
            });

            await AnalyticsService.emitPlayerForfeit(gameId, player);
            await game.persistGame();
            GameManager.deleteGame(gameId);
          });

          io.to(gameId).emit('player_disconnected', { player: playerNum });
        }
      } else if (username) {
        // Remove from queue
        GameManager.removeFromQueue(username);
      }
    });
  });
}

async function startPvPGame(io, match) {
  // `match` may be either a Game instance (returned by GameManager.checkForMatchmake)
  // or a simple object { player1, player2 } with usernames. Handle both cases.
  let game;
  if (match && match.players) {
    game = match; // already created
  } else {
    game = GameManager.startPvPGame(match.player1, match.player2);
  }

  // Precondition: both usernames must exist and be non-empty strings before initializing DB ids
  const p1u = game && game.players && game.players.player1 && game.players.player1.username;
  const p2u = game && game.players && game.players.player2 && game.players.player2.username;
  if (
    typeof p1u !== 'string' || p1u.trim().length === 0 ||
    typeof p2u !== 'string' || p2u.trim().length === 0
  ) {
    console.warn('startPvPGame: invalid/missing usernames, aborting and cleaning up game', {
      gameId: game ? game.id : null,
      players: game ? game.players : null,
    });
    // Ensure no partial game remains
    if (game && game.id) {
      GameManager.deleteGame(game.id);
    }
    return;
  }

  // Find and attach player sockets BEFORE initializing DB ids so sockets join the room
  const sockets = Array.from(io.sockets.sockets.values());
  let player1Socket = null;
  let player2Socket = null;

  const p1Name = game.players.player1.username;
  const p2Name = game.players.player2.username;

  for (const socket of sockets) {
    if (socket.data && socket.data.username === p1Name) {
      player1Socket = socket;
    } else if (socket.data && socket.data.username === p2Name) {
      player2Socket = socket;
    }
  }

  // Require both sockets to be present to start the PvP game; otherwise cleanup
  if (!player1Socket || !player2Socket) {
    console.warn('startPvPGame: missing player sockets, aborting and cleaning up', {
      gameId: game.id,
      p1Name,
      p2Name,
      found1: !!player1Socket,
      found2: !!player2Socket,
    });
    if (game && game.id) {
      GameManager.deleteGame(game.id);
    }
    return;
  }

  // attach sockets to game and join room (store socket ids)
  player1Socket.join(game.id);
  player1Socket.data.gameId = game.id;
  player1Socket.data.playerNum = PLAYER1;
  game.playerSockets.player1 = player1Socket.id;

  player2Socket.join(game.id);
  player2Socket.data.gameId = game.id;
  player2Socket.data.playerNum = PLAYER2;
  game.playerSockets.player2 = player2Socket.id;

  try {
    await game.initializePlayerIds();
  } catch (err) {
    console.error('Failed to initialize player IDs for game', game.id, err);
    // Cleanup created game to avoid stale state
    GameManager.deleteGame(game.id);
    return;
  }

  // Emit per-socket so each client receives their authoritative playerNum
  io.to(game.playerSockets.player1).emit('game_start', {
    gameId: game.id,
    players: {
      player1: game.players.player1.username,
      player2: game.players.player2.username,
    },
    gameState: game.getGameState(),
    playerNum: PLAYER1,
  });

  io.to(game.playerSockets.player2).emit('game_start', {
    gameId: game.id,
    players: {
      player1: game.players.player1.username,
      player2: game.players.player2.username,
    },
    gameState: game.getGameState(),
    playerNum: PLAYER2,
  });

  await AnalyticsService.emitGameStarted(game.id, 'pvp', [game.players.player1.username, game.players.player2.username]);
}

async function handleGameOver(io, game, gameId) {
  const duration = Math.floor((Date.now() - game.startTime) / 1000);
  const winner =
    game.winner === PLAYER1
      ? game.players.player1.username
      : game.isBot()
        ? 'Bot'
        : game.players.player2.username;

  io.to(gameId).emit('game_over', {
    winner: game.winner,
    winnerPlayerNum: game.winner,
    winnerName: winner,
    result: game.winType,
    gameState: game.getGameState(),
  });

  const gameType = game.isBot() ? 'bot' : 'pvp';
  await AnalyticsService.emitGameFinished(gameId, winner, duration, gameType);

  await game.persistGame();
  GameManager.deleteGame(gameId);
}

module.exports = { registerWebSocketHandlers };
