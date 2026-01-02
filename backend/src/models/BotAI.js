const { Board, PLAYER1, PLAYER2, ROWS, COLS, CONNECT } = require('./Board');

class BotAI {
  constructor() {
    this.depth = 6;
  }

  // Find best move for bot
  getBestMove(board, botPlayer, opponentPlayer) {
    const validMoves = board.getValidMoves();

    if (validMoves.length === 0) return null;

    // 1. Check if bot can win
    for (const col of validMoves) {
      const testBoard = board.clone();
      testBoard.makeMove(col, botPlayer);
      const row = testBoard.getLastMovePosition(col);
      if (testBoard.checkWin(row, col, botPlayer)) {
        return col;
      }
    }

    // 2. Check if opponent can win (block)
    for (const col of validMoves) {
      const testBoard = board.clone();
      testBoard.makeMove(col, opponentPlayer);
      const row = testBoard.getLastMovePosition(col);
      if (testBoard.checkWin(row, col, opponentPlayer)) {
        return col;
      }
    }

    // 3. Prefer center columns (strategic position)
    const centerCols = [3, 2, 4, 1, 5, 0, 6];
    for (const col of centerCols) {
      if (validMoves.includes(col)) {
        return col;
      }
    }

    return validMoves[0];
  }

  // Minimax evaluation
  evaluatePosition(board, botPlayer, opponentPlayer, depth) {
    const validMoves = board.getValidMoves();

    // Check board full
    if (validMoves.length === 0) {
      return 0; // Draw
    }

    // Check if bot can win
    for (const col of validMoves) {
      const testBoard = board.clone();
      testBoard.makeMove(col, botPlayer);
      const row = testBoard.getLastMovePosition(col);
      if (testBoard.checkWin(row, col, botPlayer)) {
        return 10000 + depth;
      }
    }

    // Check if opponent can win (block)
    for (const col of validMoves) {
      const testBoard = board.clone();
      testBoard.makeMove(col, opponentPlayer);
      const row = testBoard.getLastMovePosition(col);
      if (testBoard.checkWin(row, col, opponentPlayer)) {
        return -10000 - depth;
      }
    }

    // Base case: evaluate position heuristically
    if (depth === 0) {
      return this.heuristicEvaluation(board, botPlayer, opponentPlayer);
    }

    // Recursive minimax
    let maxEval = -Infinity;
    for (const col of validMoves) {
      const testBoard = board.clone();
      testBoard.makeMove(col, botPlayer);
      const evaluation = this.evaluatePosition(testBoard, botPlayer, opponentPlayer, depth - 1);
      maxEval = Math.max(maxEval, evaluation);
    }

    return maxEval;
  }

  // Heuristic evaluation
  heuristicEvaluation(board, botPlayer, opponentPlayer) {
    let score = 0;

    // Count potential threats and opportunities
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (board.grid[row][col] === botPlayer) {
          score += this.evaluatePosition4(board, row, col, botPlayer, opponentPlayer);
        } else if (board.grid[row][col] === opponentPlayer) {
          score -= this.evaluatePosition4(board, row, col, opponentPlayer, botPlayer);
        }
      }
    }

    // Prefer center
    for (let col = 0; col < COLS; col++) {
      for (let row = 0; row < board.colHeights[col]; row++) {
        if (board.grid[row][col] === botPlayer) {
          if (col === 3) score += 3;
          else if (col === 2 || col === 4) score += 2;
          else score += 1;
        }
      }
    }

    return score;
  }

  // Evaluate 4-direction from a position
  evaluatePosition4(board, row, col, player, opponent) {
    let score = 0;

    // Check all 4 directions
    const directions = [
      [0, 1], // horizontal
      [1, 0], // vertical
      [1, 1], // diagonal \
      [1, -1], // diagonal /
    ];

    for (const [dRow, dCol] of directions) {
      const countOwn = board.countInDirection(row, col, player, dRow, dCol);
      const countOpponent = board.countInDirection(row, col, opponent, dRow, dCol);

      if (countOwn >= 3) {
        score += 50;
      } else if (countOwn === 2) {
        score += 10;
      } else if (countOpponent >= 3) {
        score -= 40;
      } else if (countOpponent === 2) {
        score -= 8;
      }
    }

    return score;
  }
}

module.exports = BotAI;
