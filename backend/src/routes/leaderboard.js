const { pool } = require('../config/database');

async function getLeaderboard(req, res) {
  try {
    const result = await pool.query(
      'SELECT username, wins FROM leaderboard ORDER BY wins DESC LIMIT 100'
    );

    res.json({
      leaderboard: result.rows,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
}

module.exports = { getLeaderboard };
