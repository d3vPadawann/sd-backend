import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import { Server as HttpServer } from 'http'; // Import HttpServer type explicitly
import { config } from './config';
import { initSocketIO } from './services/socketService';
import { messageRoutes } from './routes';

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
    await fastify.listen({ port: config.port, host: '0.0.0.0' }); // Listen on all available network interfaces
    fastify.log.info(`Server listening on port ${config.port}`);
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
        // Close RabbitMQ connection (handled in mqService.ts)
        process.exit(0);
    } catch (err) {
        fastify.log.error('Error during server shutdown:', err);
        process.exit(1);
    }
  });
});
