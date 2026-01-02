import React, { useState, useEffect } from 'react';
import './Leaderboard.css';

function Leaderboard({ leaderboardData, onBack }) {
  const [leaderboard, setLeaderboard] = useState(leaderboardData || []);
  const [loading, setLoading] = useState(!leaderboardData || leaderboardData.length === 0);

  useEffect(() => {
    // If leaderboardData is provided from parent, use it immediately
    if (leaderboardData && leaderboardData.length > 0) {
      setLeaderboard(leaderboardData);
      setLoading(false);
      return;
    }

    // Otherwise, fetch on mount
    const fetchLeaderboard = async () => {
      try {
        const base = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        const response = await fetch(base + '/leaderboard');
        const data = await response.json();
        setLeaderboard(data.leaderboard || []);
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [leaderboardData]);

  return (
    <div className="leaderboard">
      <h2>Leaderboard</h2>

      {loading ? (
        <p>Loading...</p>
      ) : leaderboard.length === 0 ? (
        <p>No leaderboard data yet</p>
      ) : (
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Username</th>
              <th>Wins</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry, idx) => (
              <tr key={entry.username}>
                <td>{idx + 1}</td>
                <td>{entry.username}</td>
                <td>{entry.wins}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button onClick={onBack}>Back</button>
    </div>
  );
}

export default Leaderboard;
