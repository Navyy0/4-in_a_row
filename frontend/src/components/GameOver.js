import React from 'react';
import './GameOver.css';

function GameOver({ result, username, myPlayerNum, onPlayAgain, onShowLeaderboard }) {
  const getResultMessage = () => {
    if (result.result === 'draw') {
      return "Draw";
    }
    if (myPlayerNum === result.winnerPlayerNum) {
      return 'You Won';
    }
    return 'You Lost';
  };

  const getPlayerStatus = () => {
    if (result.result === 'draw') {
      return 'draw';
    }
    if (myPlayerNum === result.winnerPlayerNum) {
      return 'won';
    }
    return 'lost';
  };

  return (
    <div className="game-over">
      <h2 className={getPlayerStatus() === 'won' ? 'win' : getPlayerStatus() === 'lost' ? 'loss' : 'draw'}>
        {getResultMessage()}
      </h2>

      <div className="buttons">
        <button onClick={onPlayAgain}>Play Again</button>
        <button onClick={onShowLeaderboard}>View Leaderboard</button>
      </div>
    </div>
  );
}

export default GameOver;
