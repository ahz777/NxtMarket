function registerSockets(io) {
  const ordersNs = io.of('/orders');

  ordersNs.on('connection', (socket) => {
    // Client may join: user:<id> or vendor:<id> or admin
    socket.on('join', ({ room }) => {
      if (typeof room === 'string' && room.length) socket.join(room);
    });

    // Convenience: join multiple rooms at once
    socket.on('join_many', ({ rooms }) => {
      if (Array.isArray(rooms)) {
        for (const r of rooms) {
          if (typeof r === 'string' && r.length) socket.join(r);
        }
      }
    });
  });

  return { ordersNs };
}

module.exports = { registerSockets };
