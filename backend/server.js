const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000', // <-- Use your frontend port
    methods: ['GET', 'POST'],
  },
});

// Store room data: { roomId: { users: [], code: '', language: '' } }
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`Client connected at 12:57 AM IST, Thursday, September 18, 2025: ${socket.id}`);

  socket.on('create-room', (user) => {
    const roomId = `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    socket.join(roomId);
    rooms.set(roomId, { users: [user], code: '', language: 'python' });
    console.log(`Server: Room created - ${roomId} for user ${user.username} at 12:57 AM IST, Thursday, September 18, 2025`);
    socket.emit('room-created', { roomId, users: [user] });
    io.to(roomId).emit('users-update', [user]);
  });

  socket.on('join-room', ({ roomId, user }) => {
    if (rooms.has(roomId)) {
      socket.join(roomId);
      const room = rooms.get(roomId);
      room.users.push(user);
      socket.emit('room-joined', { roomId, users: room.users });
      io.to(roomId).emit('users-update', room.users);
      socket.emit('language-change', { language: room.language, code: room.code });
      console.log(`${user.username} joined room: ${roomId} at 12:57 AM IST, Thursday, September 18, 2025`);
    } else {
      socket.emit('error', { message: 'Room not found' });
      console.log(`Failed join attempt for room: ${roomId} at 12:57 AM IST, Thursday, September 18, 2025`);
    }
  });

  socket.on('code-change', ({ code, userId }) => {
    const roomId = Array.from(socket.rooms)[1];
    if (roomId && rooms.has(roomId)) {
      rooms.get(roomId).code = code;
      socket.to(roomId).emit('code-change', { code, userId });
      console.log(`Code updated in room ${roomId} by user ${userId} at 12:57 AM IST, Thursday, September 18, 2025`);
    }
  });

  socket.on('language-change', ({ language, code, userId }) => {
    const roomId = Array.from(socket.rooms)[1];
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.language = language;
      room.code = code;
      socket.to(roomId).emit('language-change', { language, code, userId });
      console.log(`Language changed to ${language} in room ${roomId} by user ${userId} at 12:57 AM IST, Thursday, September 18, 2025`);
    }
  });

  socket.on('leave-room', () => {
    const roomId = Array.from(socket.rooms)[1];
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.users = room.users.filter((u) => u.id !== socket.id);
      io.to(roomId).emit('user-left', socket.id);
      socket.leave(roomId);
      if (room.users.length === 0) {
        rooms.delete(roomId);
        console.log(`Room ${roomId} deleted (empty) at 12:57 AM IST, Thursday, September 18, 2025`);
      } else {
        io.to(roomId).emit('users-update', room.users);
      }
      console.log(`User ${socket.id} left room ${roomId} at 12:57 AM IST, Thursday, September 18, 2025`);
    }
  });

  socket.on('disconnect', () => {
    const roomId = Array.from(socket.rooms)[1];
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.users = room.users.filter((u) => u.id !== socket.id);
      io.to(roomId).emit('user-left', socket.id);
      if (room.users.length === 0) {
        rooms.delete(roomId);
        console.log(`Room ${roomId} deleted (empty) at 12:57 AM IST, Thursday, September 18, 2025`);
      } else {
        io.to(roomId).emit('users-update', room.users);
      }
      console.log(`User ${socket.id} disconnected at 12:57 AM IST, Thursday, September 18, 2025`);
    }
  });
});

// Simple API endpoint for code execution (stub)
app.post('/api/execute', express.json(), (req, res) => {
  res.json({
    output: 'Code execution not implemented',
    status: 'Success',
    time: '0.00s',
    memory: '0KB',
  });
});

server.listen(3001, () => {
  console.log('Server running on http://localhost:3001 at 12:57 AM IST, Thursday, September 18, 2025');
});