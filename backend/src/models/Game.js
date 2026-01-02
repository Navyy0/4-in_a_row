const { v4: uuidv4 } = require('uuid');
const { Board, PLAYER1, PLAYER2, BOT, GAME_STATES } = require('./Board');
const { pool } = require('../config/database');

class Game {
  constructor(gameId, player1Username, player2Username = null, isBot = false) {
    this.id = gameId;
    this.board = new Board();
    this.players = {
      player1: {
        username: player1Username,
        id: null,
        type: 'human',
      },
      player2: {
        username: player2Username,
        id: null,
        type: isBot ? 'bot' : 'human',
      },
    };
    this.currentTurn = PLAYER1;
    this.state = GAME_STATES.ACTIVE;
    this.startTime = Date.now();
    this.lastMoveTime = Date.now();
    this.winner = null;
    this.winType = null; // 'win', 'draw', 'forfeit'
    this.reconnectTimeouts = {};
    this.playerSockets = {
      player1: null,
      player2: null,
    };
  }

  async initializePlayerIds() {
    // Defensive validation: ensure usernames are present before any DB operations
    if (!this.players || !this.players.player1 || typeof this.players.player1.username !== 'string' || this.players.player1.username.trim() === '') {
      throw new Error(`Invalid player1 username for game ${this.id} - players=${JSON.stringify(this.players)}`);
    }

    if (!this.isBot()) {
      if (!this.players.player2 || typeof this.players.player2.username !== 'string' || this.players.player2.username.trim() === '') {
        throw new Error(`Invalid player2 username for game ${this.id} - players=${JSON.stringify(this.players)}`);
      }
    }

    try {
      // Get or create player1
      let result = await pool.query('SELECT id FROM users WHERE username = $1', [
        this.players.player1.username,
      ]);

      if (result.rows.length === 0) {
        result = await pool.query('INSERT INTO users (username) VALUES ($1) RETURNING id', [
          this.players.player1.username,
        ]);
      }
      this.players.player1.id = result.rows[0].id;

      // Get or create player2 (if not bot)
      if (!this.isBot()) {
        result = await pool.query('SELECT id FROM users WHERE username = $1', [
          this.players.player2.username,
        ]);

        if (result.rows.length === 0) {
          result = await pool.query('INSERT INTO users (username) VALUES ($1) RETURNING id', [
            this.players.player2.username,
          ]);
        }
        this.players.player2.id = result.rows[0].id;
      }
    } catch (err) {
      console.error('Error initializing player IDs:', err);
    }
  }

  isBot() {
    return this.players.player2.type === 'bot';
  }

  makeMove(col, player) {
    if (!this.board.isValidMove(col)) {
      return { success: false, error: 'Invalid move' };
    }

    if (this.currentTurn !== player) {
      return { success: false, error: 'Not your turn' };
    }

    if (!this.board.makeMove(col, player)) {
      return { success: false, error: 'Column full' };
    }

    const row = this.board.getLastMovePosition(col);
    this.lastMoveTime = Date.now();

    // Check win
    if (this.board.checkWin(row, col, player)) {
      this.state = GAME_STATES.FINISHED;
      this.winner = player;
      this.winType = 'win';
      return {
        success: true,
        gameOver: true,
        winner: player,
        move: { row, col },
      };
    }

    // Check draw
    if (this.board.isFull()) {
      this.state = GAME_STATES.FINISHED;
      this.winType = 'draw';
      return {
        success: true,
        gameOver: true,
        winner: null,
        move: { row, col },
      };
    }

    // Switch turn
    this.currentTurn = this.currentTurn === PLAYER1 ? PLAYER2 : PLAYER1;

    return {
      success: true,
      gameOver: false,
      move: { row, col },
    };
  }

  async persistGame() {
    try {
      const duration = Math.floor((Date.now() - this.startTime) / 1000);
      const gameType = this.isBot() ? 'bot' : 'pvp';
      const winnerId = this.winner ? (this.winner === PLAYER1 ? this.players.player1.id : this.players.player2.id) : null;

      await pool.query(
        `INSERT INTO games (id, player1_id, player2_id, winner_id, duration, game_type) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [this.id, this.players.player1.id, this.isBot() ? null : this.players.player2.id, winnerId, duration, gameType]
      );

      // Update leaderboard with strict rules:
      // - PvP: if there is a winner, increment their wins
      // - PvBot: only increment if the HUMAN player won (bot wins or draw -> do NOT update)
      let winnerUsername = null;

      if (gameType === 'pvp') {
        if (this.winner) {
          winnerUsername = this.winner === PLAYER1 ? this.players.player1.username : this.players.player2.username;
        }
      } else {
        // bot game: player2 is the bot by design; human is player1
        if (this.winner === PLAYER1) {
          winnerUsername = this.players.player1.username;
        } else {
          // BOT won or draw: do not update leaderboard
          winnerUsername = null;
        }
      }

      if (winnerUsername) {
        await pool.query(
          `INSERT INTO leaderboard (username, wins) 
           VALUES ($1, 1) 
           ON CONFLICT (username) DO UPDATE SET wins = leaderboard.wins + 1, updated_at = CURRENT_TIMESTAMP`,
          [winnerUsername]
        );
      }
    } catch (err) {
      console.error('Error persisting game:', err);
    }
  }

  forfeit(player) {
    this.state = GAME_STATES.FORFEITED;
    this.winner = player === PLAYER1 ? PLAYER2 : PLAYER1;
    this.winType = 'forfeit';
    return this.winner;
  }

  setReconnectTimeout(player, timeoutDuration, onTimeout) {
    if (this.reconnectTimeouts[player]) {
      clearTimeout(this.reconnectTimeouts[player]);
    }

    this.reconnectTimeouts[player] = setTimeout(() => {
      onTimeout(player);
    }, timeoutDuration);
  }

  clearReconnectTimeout(player) {
    if (this.reconnectTimeouts[player]) {
      clearTimeout(this.reconnectTimeouts[player]);
      delete this.reconnectTimeouts[player];
    }
  }

  getGameState() {
    return {
      id: this.id,
      board: this.board.getState(),
      players: {
        player1: { username: this.players.player1.username, type: this.players.player1.type },
        player2: { username: this.players.player2.username, type: this.players.player2.type },
      },
      currentTurn: this.currentTurn,
      state: this.state,
      startTime: this.startTime,
    };
  }
}

module.exports = Game;
