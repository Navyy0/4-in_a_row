import React, { useState, useEffect } from 'react';
import './Matchmaking.css';

function Matchmaking({ username }) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="matchmaking">
      <h2>Matchmaking</h2>
      <p>Username: <strong>{username}</strong></p>
      <p className="waiting">
        Waiting for opponent{dots}
      </p>
      <p className="info">You will be matched with another player or face an AI opponent if no one joins within 60 seconds.</p>
    </div>
  );
}

export default Matchmaking;
