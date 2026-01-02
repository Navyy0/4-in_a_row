const { Kafka } = require('kafkajs');
require('dotenv').config();

const kafka = new Kafka({
  clientId: 'connect-four-app',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'connect-four-analytics' });

async function initializeKafka() {
  try {
    await producer.connect();
    await consumer.connect();
    await consumer.subscribe({ topic: process.env.KAFKA_TOPIC_EVENTS || 'game-events' });
    console.log('Kafka initialized successfully');
  } catch (err) {
    console.error('Kafka initialization error:', err);
  }
}

module.exports = { kafka, producer, consumer, initializeKafka };
