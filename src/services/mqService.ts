import { connect, type Channel, type Connection } from 'amqplib';
import { config } from '../config';
import { emitMessage } from './socketService'; // Import socket emitter

let connection: Connection | null = null;
let channel: Channel | null = null;
let isConnecting = false; // Flag to prevent multiple connection attempts
let reconnectTimeout: NodeJS.Timeout | null = null;

/**
 * Ensures the RabbitMQ connection and channel are established.
 * Implements exponential backoff for reconnection attempts.
 */
async function ensureMqConnection(retryDelay = 5000): Promise<Channel | null> {
  if (channel) {
    return channel;
  }

  if (isConnecting) {
    // Avoid race conditions if called concurrently during connection attempt
    console.log('Connection attempt already in progress, waiting...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    return ensureMqConnection(retryDelay); // Recheck after delay
  }

  isConnecting = true;

  // Clear any pending reconnect timeout
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }


  try {
    console.log(`Attempting to connect to RabbitMQ at ${config.rabbitMQUrl}...`);
    connection = await connect(config.rabbitMQUrl);
    console.log('RabbitMQ connection established.');
    isConnecting = false; // Reset flag on successful connection

    connection.on('error', (err) => {
      console.error('RabbitMQ connection error:', err.message);
      connection = null;
      channel = null;
      isConnecting = false; // Reset flag
      // Attempt to reconnect after a delay with backoff
      if (!reconnectTimeout) {
        reconnectTimeout = setTimeout(() => ensureMqConnection(Math.min(retryDelay * 2, 30000)), retryDelay); // Exponential backoff up to 30s
      }
    });

    connection.on('close', () => {
      console.log('RabbitMQ connection closed.');
      // Only attempt reconnect if not initiated by closeMqConnection
      if (connection !== null) {
        connection = null;
        channel = null;
        isConnecting = false; // Reset flag
        // Attempt to reconnect after a delay with backoff
        if (!reconnectTimeout) {
          reconnectTimeout = setTimeout(() => ensureMqConnection(Math.min(retryDelay * 2, 30000)), retryDelay); // Exponential backoff up to 30s
        }
      }
    });

    channel = await connection.createChannel();
    await channel.assertQueue(config.messageQueue, { durable: true }); // Ensure queue exists
    console.log(`RabbitMQ channel created and queue '${config.messageQueue}' asserted.`);
    return channel;

  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error);
    isConnecting = false; // Reset flag on failure
    // Retry connection after a delay with backoff
    if (!reconnectTimeout) {
      reconnectTimeout = setTimeout(() => ensureMqConnection(Math.min(retryDelay * 2, 30000)), retryDelay); // Exponential backoff up to 30s
    }
    // Throw error to indicate initial connection failure or persistent issue
    throw new Error('Failed to establish RabbitMQ connection.');
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

/**
 * Starts consuming messages from the configured RabbitMQ queue.
 * Emits received messages via Socket.IO.
 */
export async function startMqConsumer(): Promise<void> {
    try {
        const consumerChannel = await ensureMqConnection();
        if (!consumerChannel) {
            throw new Error('Failed to establish RabbitMQ connection for consumer.');
        }
        console.log(`Starting RabbitMQ consumer for queue '${config.messageQueue}'...`);

        await consumerChannel.consume(config.messageQueue, (msg) => {
            if (msg !== null) {
                try {
                    const messageContent = msg.content;
                    console.log(`Received message from RabbitMQ: ${messageContent}`);

                    emitMessage('message-received', messageContent);

                    consumerChannel.ack(msg);
                } catch (processingError) {
                    console.error('Error processing message or emitting via socket:', processingError);
                    // Decide if message should be requeued or discarded
                    // For now, nack without requeue to avoid infinite loops on bad messages
                    consumerChannel.nack(msg, false, false);
                }
            } else {
                // Handle case where consumer is cancelled by RabbitMQ
                console.warn('RabbitMQ consumer cancelled.');
                // Potentially try to restart the consumer or handle accordingly
            }
        }, {
            noAck: false // Ensure messages are acknowledged manually
        });

        console.log('RabbitMQ consumer is listening.');

    } catch (error) {
        console.error('Failed to start RabbitMQ consumer:', error);
        // Optionally implement retry logic for starting the consumer itself
        // Consider throwing the error to indicate a critical failure during startup
        throw new Error('Failed to start RabbitMQ consumer.');
    }
}


/**
 * Gracefully closes the RabbitMQ connection and channel.
 */
export async function closeMqConnection(): Promise<void> {
    console.log('Closing RabbitMQ connection...');
    // Clear reconnect timeout to prevent attempts after explicit close
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }
    try {
        if (channel) {
            await channel.close();
            console.log('RabbitMQ channel closed.');
            channel = null;
        }
        if (connection) {
            const connToClose = connection;
            connection = null; // Prevent close handler from triggering reconnect
            await connToClose.close();
            console.log('RabbitMQ connection closed gracefully.');
        }
    } catch (err) {
        console.error('Error closing RabbitMQ connection:', err);
    }
}


// Initialize the connection on startup (optional, can be lazy)
// ensureMqConnection().catch(err => console.error("Initial RabbitMQ connection failed:", err));

// Remove process.on('SIGINT') handler here, it's now handled in server.ts
// where closeMqConnection is called.
