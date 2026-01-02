import React, { useState } from 'react';
import './UsernameInput.css';

function UsernameInput({ onSubmit }) {
  const [username, setUsername] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim().length > 0) {
      onSubmit(username.trim());
    }
  };

  return (
    <div className="username-input">
      <h2>Welcome to Connect Four</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Enter your username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength="50"
        />
        <button type="submit">Play</button>
      </form>
    </div>
  );
}

export default UsernameInput;
