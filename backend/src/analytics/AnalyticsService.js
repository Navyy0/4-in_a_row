const { producer } = require('../config/kafka');
require('dotenv').config();

const KAFKA_TOPIC = process.env.KAFKA_TOPIC_EVENTS || 'game-events';
const ANALYTICS_ENABLED = process.env.ANALYTICS_ENABLED === 'true';

class AnalyticsService {
  async emitGameStarted(gameId, gameType, players) {
    if (!ANALYTICS_ENABLED) return;

    try {
      await producer.send({
        topic: KAFKA_TOPIC,
        messages: [
          {
            key: gameId,
            value: JSON.stringify({
              event: 'GAME_STARTED',
              timestamp: new Date().toISOString(),
              gameId,
              gameType,
              players,
            }),
          },
        ],
      });
    } catch (err) {
      console.error('Error emitting GAME_STARTED event:', err);
    }
  }

  async emitMovePlayed(gameId, player, col, row) {
    if (!ANALYTICS_ENABLED) return;

    try {
      await producer.send({
        topic: KAFKA_TOPIC,
        messages: [
          {
            key: gameId,
            value: JSON.stringify({
              event: 'MOVE_PLAYED',
              timestamp: new Date().toISOString(),
              gameId,
              player,
              col,
              row,
            }),
          },
        ],
      });
    } catch (err) {
      console.error('Error emitting MOVE_PLAYED event:', err);
    }
  }

  async emitGameFinished(gameId, winner, duration, gameType) {
    if (!ANALYTICS_ENABLED) return;

    try {
      await producer.send({
        topic: KAFKA_TOPIC,
        messages: [
          {
            key: gameId,
            value: JSON.stringify({
              event: 'GAME_FINISHED',
              timestamp: new Date().toISOString(),
              gameId,
              winner,
              duration,
              gameType,
            }),
          },
        ],
      });
    } catch (err) {
      console.error('Error emitting GAME_FINISHED event:', err);
    }
  }

  async emitPlayerForfeit(gameId, player) {
    if (!ANALYTICS_ENABLED) return;

    try {
      await producer.send({
        topic: KAFKA_TOPIC,
        messages: [
          {
            key: gameId,
            value: JSON.stringify({
              event: 'PLAYER_FORFEIT',
              timestamp: new Date().toISOString(),
              gameId,
              player,
            }),
          },
        ],
      });
    } catch (err) {
      console.error('Error emitting PLAYER_FORFEIT event:', err);
    }
  }
}

module.exports = new AnalyticsService();
