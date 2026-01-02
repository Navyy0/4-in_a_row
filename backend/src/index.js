const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const { initializeDatabase } = require('./config/database');
const { initializeKafka } = require('./config/kafka');
const { registerWebSocketHandlers } = require('./websocket/handlers');
const { startAnalyticsConsumer } = require('./analytics/AnalyticsConsumer');
const { getLeaderboard } = require('./routes/leaderboard');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST'],
}));

// Routes
app.get('/leaderboard', getLeaderboard);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// WebSocket
registerWebSocketHandlers(io);

// Start server
const PORT = process.env.PORT || 3001;

async function start() {
  try {
    console.log('Initializing database...');
    await initializeDatabase();

   if (process.env.ANALYTICS_ENABLED === 'true') {
  console.log('Initializing Kafka...');
  await initializeKafka();

  console.log('Starting analytics consumer...');
  startAnalyticsConsumer();
} else {
  console.log('Kafka disabled');
}


    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

module.exports = server;
