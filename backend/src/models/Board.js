// Board constants
const ROWS = 6;
const COLS = 7;
const CONNECT = 4;

// Piece types
const EMPTY = 0;
const PLAYER1 = 1;
const PLAYER2 = 2;
const BOT = 2; // Bot plays as Player 2

// Game states
const GAME_STATES = {
  WAITING: 'waiting',
  ACTIVE: 'active',
  FINISHED: 'finished',
  FORFEITED: 'forfeited',
};

class Board {
  constructor() {
    this.grid = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(EMPTY));
    this.colHeights = Array(COLS).fill(0);
  }

  isValidMove(col) {
    return col >= 0 && col < COLS && this.colHeights[col] < ROWS;
  }

  makeMove(col, player) {
    if (!this.isValidMove(col)) return false;

    const row = this.colHeights[col];
    this.grid[row][col] = player;
    this.colHeights[col]++;
    return true;
  }

  isFull() {
    return this.colHeights.every((h) => h === ROWS);
  }

  getLastMovePosition(col) {
    return this.colHeights[col] - 1;
  }

  // Check if a player won at specific position
  checkWin(row, col, player) {
    // Horizontal
    if (
      this.countInDirection(row, col, player, 0, 1) +
        this.countInDirection(row, col, player, 0, -1) +
        1 >=
      CONNECT
    ) {
      return true;
    }

    // Vertical
    if (
      this.countInDirection(row, col, player, 1, 0) +
        this.countInDirection(row, col, player, -1, 0) +
        1 >=
      CONNECT
    ) {
      return true;
    }

    // Diagonal \
    if (
      this.countInDirection(row, col, player, 1, 1) +
        this.countInDirection(row, col, player, -1, -1) +
        1 >=
      CONNECT
    ) {
      return true;
    }

    // Diagonal /
    if (
      this.countInDirection(row, col, player, 1, -1) +
        this.countInDirection(row, col, player, -1, 1) +
        1 >=
      CONNECT
    ) {
      return true;
    }

    return false;
  }

  countInDirection(row, col, player, dRow, dCol) {
    let count = 0;
    let r = row + dRow;
    let c = col + dCol;

    while (r >= 0 && r < ROWS && c >= 0 && c < COLS && this.grid[r][c] === player) {
      count++;
      r += dRow;
      c += dCol;
    }

    return count;
  }

  getValidMoves() {
    return Array.from({ length: COLS }, (_, i) => i).filter((col) =>
      this.isValidMove(col)
    );
  }

  clone() {
    const newBoard = new Board();
    newBoard.grid = this.grid.map((row) => [...row]);
    newBoard.colHeights = [...this.colHeights];
    return newBoard;
  }

  getState() {
    return {
      grid: this.grid,
      colHeights: this.colHeights,
    };
  }
}

module.exports = {
  Board,
  ROWS,
  COLS,
  CONNECT,
  EMPTY,
  PLAYER1,
  PLAYER2,
  BOT,
  GAME_STATES,
};
