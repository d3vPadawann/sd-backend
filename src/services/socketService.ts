import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from '../config';

let io: SocketIOServer | undefined;

/**
 * Initializes the Socket.IO server.
 * @param httpServer - The Node.js HTTP server instance.
 * @returns The Socket.IO server instance.
 */
export function initSocketIO(httpServer: HttpServer): SocketIOServer {
  if (io) {
    console.warn('Socket.IO server already initialized.');
    return io;
  }

  console.log('Initializing Socket.IO server...');
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.corsOrigin, // Use configured origin
      methods: ['GET', 'POST'],
    },
     // path: '/socket.io', // Default path, usually no need to change unless proxying
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Example: Echo back messages received on a specific event
    // socket.on('send_message', (data) => {
    //   console.log(`Message from client ${socket.id}:`, data);
    //   socket.emit('receive_message', data); // Echo back
    // });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  console.log('Socket.IO server initialized.');
  return io;
}

/**
 * Emits a message to all connected Socket.IO clients.
 * @param eventName - The name of the event to emit.
 * @param data - The data to send with the event.
 */
export function emitMessage(eventName: string, data: any): void {
  
  let processedData = data;
  
  // Verifica se os dados são um Buffer e converte para objeto
  if (Buffer.isBuffer(data)) {
    try {
      // Converte o Buffer para string e depois para objeto JSON
      const dataString = data.toString('utf-8');
      processedData = JSON.parse(dataString);
    } catch (error) {
      console.error("Erro ao converter buffer para objeto:", error);
    }
  }

  if (io) {
    io.emit(eventName, processedData);
  } else {
    console.warn('Socket.IO server not initialized. Cannot emit message.');
  }
}

/**
 * Gets the initialized Socket.IO server instance.
 * @returns The Socket.IO server instance or undefined if not initialized.
 */
export function getIo(): SocketIOServer | undefined {
  return io;
}
