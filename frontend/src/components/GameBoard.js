import React, { useMemo } from 'react';
import './GameBoard.css';

const ROWS = 6;
const COLS = 7;
const PLAYER1 = 1;
const PLAYER2 = 2;
const EMPTY = 0;

function GameBoard({ board, players, currentTurn, myPlayerNum, onMove, onForfeit, username }) {
  // Defensive guards: do not attempt to read nested player fields if data is missing
  if (!players || !players.player1 || !players.player2) {
    return (
      <div className="game-board">
        <div className="game-header">
          <h2>Waiting for opponent…</h2>
        </div>
      </div>
    );
  }

  const isYourTurn = currentTurn === myPlayerNum;
  const youArePlayer = myPlayerNum === PLAYER1 ? 'Player 1' : 'Player 2';
  const opponent = myPlayerNum === PLAYER1 ? `vs ${players.player2}` : `vs ${players.player1}`;

  const handleColumnClick = (col) => {
    if (isYourTurn) {
      onMove(col);
    }
  };

  const getDiscColor = (piece) => {
    if (piece === PLAYER1) return '#ffcc00';
    if (piece === PLAYER2) return '#ff3333';
    return '#ffffff';
  };

  return (
    <div className="game-board">
      <div className="game-header">
        <h2>Game in Progress</h2>
        <div className="player-info">
          <p>
            <strong>{username}</strong> {youArePlayer}
          </p>
          <p>{opponent}</p>
        </div>
      </div>

      <div className="board-container">
        <div className="board">
          {board &&
            [...board.grid].reverse().map((row, rowIdx) => (
              <div key={`row-${rowIdx}`} className="row">
                {row.map((piece, colIdx) => (
                  <div
                    key={`cell-${rowIdx}-${colIdx}`}
                    className="cell"
                    onClick={() => handleColumnClick(colIdx)}
                  >
                    <div
                      className="disc"
                      style={{ backgroundColor: getDiscColor(piece) }}
                    ></div>
                  </div>
                ))}
              </div>
            ))}
        </div>
      </div>

      <div className="game-status">
        {isYourTurn ? (
          <p className="your-turn">Your turn!</p>
        ) : (
          <p className="opponent-turn">Opponent's turn...</p>
        )}
      </div>

      <button className="forfeit-button" onClick={onForfeit}>
        Forfeit Game
      </button>
    </div>
  );
}

export default GameBoard;
