import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { executeJavaScript } from './execution/javascript-service';
import { executeCode } from './execution/piston-service'; 
import { executionLimiter } from './middleware/security';

import http from 'http';
import { Server } from 'socket.io';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));
app.use(express.json());

// --- Your HTTP API ---
app.post('/api/execute', executionLimiter, async (req, res) => {
  try {
    const { code, language, stdin = '' } = req.body;
    if (!code || !language) {
      return res.status(400).json({ error: 'Code and language are required' });
    }
    let result;
    switch (language) {
      case 'javascript':
        result = executeJavaScript(code, stdin);
        break;
      default:
        result = await executeCode(code, language, stdin);
    }
    res.json(result);
  } catch (error) {
    console.error('Execution error:', error);
    res.status(500).json({ 
      error: 'Execution failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// --- Create HTTP server and attach socket.io ---
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// --- Socket.io logic (copy from your server.js) ---
const rooms = new Map();

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("createRoom", ({ username, roomId }) => {
    socket.data.username = username;
    socket.join(roomId);
    const user = { id: socket.id, username };
    rooms.set(roomId, { 
      users: [user], 
      code: '', 
      language: 'python',
      whiteboard: { lines: [], textBoxes: [], shapes: [] },
      flowchart: { elements: [], mermaidCode: '' }
    });
    console.log(`Room created: ${roomId} by ${username}`);
    socket.emit("room-created", { roomId, users: [user] });
    io.to(roomId).emit("users-update", [user]);
  });

  socket.on("joinRoom", ({ username, roomId }) => {
    socket.data.username = username;
    if (rooms.has(roomId)) {
      socket.join(roomId);
      const room = rooms.get(roomId);
      const user = { id: socket.id, username };
      
      // Check if user already exists (by username)
      const existingUserIndex = room.users.findIndex((u: any) => u.username === username);
      if (existingUserIndex === -1) {
        room.users.push(user);
        console.log(`${username} joined room: ${roomId}`);
      } else {
        // Update the user's socket ID if they reconnected
        room.users[existingUserIndex].id = socket.id;
      }
      
      socket.emit("room-joined", { 
        roomId, 
        users: room.users, 
        code: room.code, 
        language: room.language,
        whiteboard: room.whiteboard || { lines: [], textBoxes: [], shapes: [] },
        flowchart: room.flowchart || { elements: [], mermaidCode: '' }
      });
      io.to(roomId).emit("users-update", room.users);
      socket.emit("language-change", { language: room.language, code: room.code });
    } else {
      socket.emit("error", { message: "Room not found" });
      console.log(`Failed join attempt for room: ${roomId}`);
    }
  });

  socket.on("code-change", ({ code, userId }) => {
    const roomId = Array.from(socket.rooms)[1];
    if (roomId && rooms.has(roomId)) {
      rooms.get(roomId).code = code;
      socket.to(roomId).emit("code-change", { code, userId });
      console.log(`Code updated in room ${roomId} by user ${userId}`);
    }
  });

  socket.on("language-change", ({ language, code, userId }) => {
    const roomId = Array.from(socket.rooms)[1];
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.language = language;
      room.code = code;
      socket.to(roomId).emit("language-change", { language, code, userId });
      console.log(`Language changed to ${language} in room ${roomId} by user ${userId}`);
    }
  });

  // Whiteboard event handlers
  socket.on("whiteboard-update", ({ lines, textBoxes, shapes, roomId, clearOperationId }) => {
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.whiteboard = { lines, textBoxes, shapes };
      socket.to(roomId).emit("whiteboard-update", { lines, textBoxes, shapes, clearOperationId });
      console.log(`Whiteboard updated in room ${roomId} by user ${socket.id}`, {
        linesCount: lines?.length || 0,
        textBoxesCount: textBoxes?.length || 0,
        shapesCount: shapes?.length || 0,
        isClearOperation: clearOperationId ? true : false
      });
    }
  });

  socket.on("request-whiteboard-state", ({ roomId }) => {
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      socket.emit("whiteboard-state", room.whiteboard || { lines: [], textBoxes: [], shapes: [] });
      console.log(`Whiteboard state requested by user ${socket.id} in room ${roomId}`);
    }
  });

  // Flowchart event handlers
  socket.on("flowchart-update", ({ elements, mermaidCode, roomId }) => {
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.flowchart = { elements, mermaidCode };
      socket.to(roomId).emit("flowchart-update", { elements, mermaidCode });
      console.log(`Flowchart updated in room ${roomId} by user ${socket.id}`, {
        elementsCount: elements?.length || 0
      });
    }
  });

  socket.on("request-flowchart-state", ({ roomId }) => {
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      socket.emit("flowchart-state", room.flowchart || { elements: [], mermaidCode: '' });
      console.log(`Flowchart state requested by user ${socket.id} in room ${roomId}`);
    }
  });

  // NEW: Handle output changes and broadcast to the entire room
  socket.on("output-change", ({ result, roomId }) => {
    if (roomId && rooms.has(roomId)) {
      io.to(roomId).emit("output-change", { result });
      console.log(`Output updated in room ${roomId} by user ${socket.id}`);
    }
  });

  socket.on("leave-room", () => {
    const roomId = Array.from(socket.rooms)[1];
    const username = socket.data.username;
    if (roomId && rooms.has(roomId) && username) {
      const room = rooms.get(roomId);
      room.users = room.users.filter((u: any) => u.username !== username);
      io.to(roomId).emit("user-left", username);
      socket.leave(roomId);
      if (room.users.length === 0) {
        rooms.delete(roomId);
      }
    }
  });

  socket.on("disconnect", () => {
    const roomId = Array.from(socket.rooms)[1];
    const username = socket.data.username;
    if (roomId && rooms.has(roomId) && username) {
      const room = rooms.get(roomId);
      room.users = room.users.filter((u: any) => u.username !== username);
      io.to(roomId).emit("user-left", username);
      if (room.users.length === 0) {
        rooms.delete(roomId);
      }
    }
  });
});

// --- Start the combined server ---
server.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
});