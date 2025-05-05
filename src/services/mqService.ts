import { connect, type Connection, type Channel } from 'amqplib';
import { config } from '../config';


let connection: Connection | null = null;
let channel: Channel | null = null;

/**
 * Ensures the RabbitMQ connection and channel are established.
 * Implements basic reconnection logic on error/close.
 */
async function ensureMqConnection(): Promise<Channel> {
  if (channel) {
    return channel;
  }

  try {
    console.log(`Attempting to connect to RabbitMQ at ${config.rabbitMQUrl}...`);
    connection = await connect(config.rabbitMQUrl);
    console.log('RabbitMQ connection established.');

    connection.on('error', (err) => {
      console.error('RabbitMQ connection error:', err.message);
      connection = null;
      channel = null;
      // Attempt to reconnect after a delay
      setTimeout(ensureMqConnection, 5000);
    });

    connection.on('close', () => {
      console.log('RabbitMQ connection closed.');
      connection = null;
      channel = null;
       // Attempt to reconnect after a delay
      setTimeout(ensureMqConnection, 5000);
    });

    channel = await connection.createChannel();
    await channel.assertQueue(config.messageQueue, { durable: true }); // Durable queue
    console.log(`RabbitMQ channel created and queue '${config.messageQueue}' asserted.`);
    return channel;

  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error);
    // Retry connection after a delay
    await new Promise(resolve => setTimeout(resolve, 5000));
    return ensureMqConnection(); // Retry
  }
}

/**
 * Sends a message to the configured RabbitMQ queue.
 * @param message - The message string to send.
 */
export async function sendMessageToQueue(message: string): Promise<void> {
  try {
    const currentChannel = await ensureMqConnection();
    currentChannel.sendToQueue(config.messageQueue, Buffer.from(message), { persistent: true }); // Persistent message
    console.log(`Message sent to RabbitMQ queue '${config.messageQueue}': ${message}`);
  } catch (error) {
    console.error('Failed to send message to RabbitMQ:', error);
    // Depending on the application's needs, you might throw the error
    // or implement more robust retry logic here.
    throw new Error('Failed to queue message.');
  }
}

// Initialize the connection on startup
ensureMqConnection().catch(err => console.error("Initial RabbitMQ connection failed:", err));

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Closing RabbitMQ connection...');
    try {
        if (channel) await channel.close();
        if (connection) await connection.close();
        console.log('RabbitMQ connection closed gracefully.');
    } catch (err) {
        console.error('Error closing RabbitMQ connection:', err);
    } finally {
        process.exit(0);
    }
});
