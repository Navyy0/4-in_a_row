const { consumer } = require('../config/kafka');
const { pool } = require('../config/database');
require('dotenv').config();

const ANALYTICS_ENABLED = process.env.ANALYTICS_ENABLED === 'true';

let analyticsData = {
  gamesStarted: 0,
  gamesFinished: 0,
  totalGameDuration: 0,
  movesPlayed: 0,
  playerForfeits: 0,
  gamesByHour: {},
  gamesByDay: {},
  mostFrequentWinners: {},
};

async function startAnalyticsConsumer() {
  if (!ANALYTICS_ENABLED) {
    console.log('Analytics consumer disabled');
    return;
  }

  try {
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const event = JSON.parse(message.value.toString());
          await processAnalyticsEvent(event);
        } catch (err) {
          console.error('Error processing analytics event:', err);
        }
      },
    });
  } catch (err) {
    console.error('Error starting analytics consumer:', err);
  }
}

async function processAnalyticsEvent(event) {
  const timestamp = new Date(event.timestamp);

  switch (event.event) {
    case 'GAME_STARTED':
      analyticsData.gamesStarted++;
      trackByHour(timestamp);
      trackByDay(timestamp);
      break;

    case 'MOVE_PLAYED':
      analyticsData.movesPlayed++;
      break;

    case 'GAME_FINISHED':
      analyticsData.gamesFinished++;
      analyticsData.totalGameDuration += event.duration || 0;

      if (event.winner) {
        analyticsData.mostFrequentWinners[event.winner] =
          (analyticsData.mostFrequentWinners[event.winner] || 0) + 1;
      }
      break;

    case 'PLAYER_FORFEIT':
      analyticsData.playerForfeits++;
      break;
  }
}

function trackByHour(timestamp) {
  const hour = timestamp.toISOString().substring(0, 13);
  analyticsData.gamesByHour[hour] = (analyticsData.gamesByHour[hour] || 0) + 1;
}

function trackByDay(timestamp) {
  const day = timestamp.toISOString().substring(0, 10);
  analyticsData.gamesByDay[day] = (analyticsData.gamesByDay[day] || 0) + 1;
}

function getAnalyticsData() {
  return {
    ...analyticsData,
    averageGameDuration:
      analyticsData.gamesFinished > 0
        ? Math.round(analyticsData.totalGameDuration / analyticsData.gamesFinished)
        : 0,
    topWinners: Object.entries(analyticsData.mostFrequentWinners)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([username, wins]) => ({ username, wins })),
  };
}

module.exports = {
  startAnalyticsConsumer,
  getAnalyticsData,
};
