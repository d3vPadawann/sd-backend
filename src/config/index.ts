import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3002', 10),
  rabbitMQUrl: 'amqp://user:password@localhost:5672',
  messageQueue: 'messages_queue',
  corsOrigin: process.env.CORS_ORIGIN || '*', // Allow all origins by default for dev
};
