import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sendMessageToQueue } from '../services/mqService';
import { emitMessage } from '../services/socketService';

interface MessageRequestBody {
  message: string;
}

/**
 * Registers the message routes with the Fastify instance.
 * @param fastify - The Fastify instance.
 */
export async function messageRoutes(fastify: FastifyInstance): Promise<void> {

  fastify.post('/message', async (request: FastifyRequest<{ Body: MessageRequestBody }>, reply: FastifyReply) => {
    const { message } = request.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      reply.status(400).send({ error: 'Message content is required and must be a non-empty string.' });
      return;
    }

    fastify.log.info(`Received message via POST: ${message}`);

    try {
      // 1. Send message to RabbitMQ
      await sendMessageToQueue(message);

      // 2. Emit message via Socket.IO
      // Ensure data structure is consistent if clients expect an object
      emitMessage('receive_message', { text: message });

      reply.status(200).send({ success: true, message: 'Message processed and emitted.' });

    } catch (error: any) {
      fastify.log.error('Error processing message:', error);

      // Differentiate between errors
      if (error.message === 'Failed to queue message.') {
        reply.status(503).send({ error: 'Message queue service is unavailable.' });
      } else {
        reply.status(500).send({ error: 'Internal Server Error' });
      }
    }
  });

   // Optional: Add a GET handler for basic info or health check
   fastify.get('/message', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.send({ status: 'Message API endpoint is running' });
  });
}
