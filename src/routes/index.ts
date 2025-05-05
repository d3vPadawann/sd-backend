import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { sendMessageToQueue } from '../services/mqService';

interface MessageRequestBody {
  content: string;
  sender: string;
  timestamp: string; // ou number, dependendo de como você pretende enviar o timestamp
}

/**
 * Registers the message routes with the Fastify instance.
 * @param fastify - The Fastify instance.
 */
export async function messageRoutes(fastify: FastifyInstance): Promise<void> {

  fastify.post('/message', async (request: FastifyRequest<{ Body: MessageRequestBody }>, reply: FastifyReply) => {
    const { content, sender } = request.body;
    const timestamp = request.body.timestamp || new Date().toISOString();; // Use null if timestamp is not provided

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      reply.status(400).send({ error: 'Message content is required and must be a non-empty string.' });
      return;
    }

    if (!sender || typeof sender !== 'string' || sender.trim().length === 0) {
      reply.status(400).send({ error: 'Sender name is required and must be a non-empty string.' });
      return;
    }
    
    fastify.log.info(`Received message from ${sender}: ${content}`);

    try {
      // 1. Send message to RabbitMQ with all fields
      await sendMessageToQueue(JSON.stringify({ content, sender, timestamp }));
  
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
