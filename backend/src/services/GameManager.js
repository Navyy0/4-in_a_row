const { v4: uuidv4 } = require('uuid');
const Game = require('../models/Game');
const BotAI = require('../models/BotAI');
const { PLAYER1, PLAYER2, BOT } = require('../models/Board');
require('dotenv').config();

const MATCH_WAIT_TIME = parseInt(process.env.MATCH_WAIT_TIME) || 60000;
const RECONNECT_TIMEOUT = parseInt(process.env.RECONNECT_TIMEOUT) || 120000;

class GameManager {
  constructor() {
    this.games = {};
    this.waitingQueue = [];
    this.userGames = {}; // username -> gameId
    this.botAI = new BotAI();
  }

  addToQueue(username, onBotGameReady) {
    // Remove if already in queue
    this.waitingQueue = this.waitingQueue.filter((u) => u.username !== username);

    const queueEntry = {
      username,
      joinedAt: Date.now(),
      timeoutId: null,
    };

    this.waitingQueue.push(queueEntry);

    // Set 60 second timeout
    queueEntry.timeoutId = setTimeout(() => {
      const game = this.startBotGame(username);
      if (game && onBotGameReady) {
        onBotGameReady(game);
      }
    }, MATCH_WAIT_TIME);

    return queueEntry;
  }

  findOpponent() {
    if (this.waitingQueue.length < 2) return null;

    const player1Entry = this.waitingQueue.shift();
    const player2Entry = this.waitingQueue.shift();

    // Clear timeouts
    clearTimeout(player1Entry.timeoutId);
    clearTimeout(player2Entry.timeoutId);

    return {
      player1: player1Entry.username,
      player2: player2Entry.username,
    };
  }

  startPvPGame(player1Username, player2Username) {
    const gameId = uuidv4();
    const game = new Game(gameId, player1Username, player2Username, false);

    this.games[gameId] = game;
    this.userGames[player1Username] = gameId;
    this.userGames[player2Username] = gameId;

    return game;
  }

  startBotGame(player1Username) {
    // Remove from queue if still there
    this.waitingQueue = this.waitingQueue.filter((u) => u.username !== player1Username);

    const gameId = uuidv4();
    const game = new Game(gameId, player1Username, 'Bot', true);

    this.games[gameId] = game;
    this.userGames[player1Username] = gameId;

    return game;
  }

  getBotMove(gameId) {
    const game = this.games[gameId];
    if (!game || !game.isBot()) return null;

    const botPlayer = PLAYER2;
    const opponentPlayer = PLAYER1;

    return this.botAI.getBestMove(game.board, botPlayer, opponentPlayer);
  }

  getGameByUsername(username) {
    const gameId = this.userGames[username];
    return gameId ? this.games[gameId] : null;
  }

  getGame(gameId) {
    return this.games[gameId];
  }

  deleteGame(gameId) {
    const game = this.games[gameId];
    if (game) {
      delete this.userGames[game.players.player1.username];
      if (!game.isBot()) {
        delete this.userGames[game.players.player2.username];
      }
      delete this.games[gameId];
    }
  }

  removeFromQueue(username) {
    const index = this.waitingQueue.findIndex((u) => u.username === username);
    if (index !== -1) {
      const entry = this.waitingQueue.splice(index, 1)[0];
      clearTimeout(entry.timeoutId);
    }
  }

  getWaitingQueueLength() {
    return this.waitingQueue.length;
  }

  checkForMatchmake() {
    if (this.waitingQueue.length >= 2) {
      const match = this.findOpponent();
      if (match) {
        return this.startPvPGame(match.player1, match.player2);
      }
    }
    return null;
  }
}

module.exports = new GameManager();
