import { subscribe } from './services/notificationService.js';

export function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('auth', ({ userId }) => {
      if (userId) {
        socket.join(`user:${userId}`);
        socket.userId = userId;

        const unsubscribe = subscribe(userId, (notification) => {
          socket.emit('notification', notification);
        });

        socket.on('disconnect', () => unsubscribe());
      }
    });

    socket.on('subscribe:desks', () => {
      socket.join('desks');
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function broadcastDeskUpdate(io) {
  io.to('desks').emit('desks:refresh');
}
