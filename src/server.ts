import fastifyCors from '@fastify/cors';
import Fastify from 'fastify';
import { Server as HttpServer } from 'http'; // Import HttpServer type explicitly
import { config } from './config';
import { messageRoutes } from './routes';
import { closeMqConnection, startMqConsumer } from './services/mqService'; // Import consumer start and close functions
import { initSocketIO } from './services/socketService';

// Initialize Fastify with logger enabled
const fastify = Fastify({
  logger: true, // Enable built-in Pino logger
});

// Register CORS plugin
fastify.register(fastifyCors, {
  origin: config.corsOrigin, // Configure allowed origins
});

// Register message routes
fastify.register(messageRoutes);

// Initialize Socket.IO by passing the Fastify HTTP server instance
// We need to cast fastify.server to HttpServer
initSocketIO(fastify.server as HttpServer);

// Start the server
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' }); // Listen on all available network interfaces
    fastify.log.info(`Server listening on port ${config.port}`);

    await startMqConsumer();
    fastify.log.info('RabbitMQ consumer started.');

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

// Graceful shutdown handling
const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    fastify.log.info(`Received ${signal}, closing server...`);
    try {
        await fastify.close();
        // Socket.IO server closes automatically with the HTTP server
        fastify.log.info('Server closed gracefully.');
        // Close RabbitMQ connection
        await closeMqConnection(); // Use the exported close function
        process.exit(0);
    } catch (err) {
        fastify.log.error('Error during server shutdown:', err);
        process.exit(1);
    }
  });
});
