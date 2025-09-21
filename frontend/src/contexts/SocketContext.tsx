"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

interface User {
  id: string;
  username: string;
}

interface SocketContextType {
  socket: Socket | null;
  roomId: string | null;
  users: User[];
  isConnected: boolean;
  createRoom: (username: string, roomId: string) => void;
  joinRoom: (username: string, roomId: string) => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Only run on client-side
    const s = io("http://localhost:3001", {
      autoConnect: true,
      reconnection: true,
    });
    setSocket(s);

    s.on("connect", () => {
      console.log("Connected to server");
      setIsConnected(true);
    });
    
    s.on("disconnect", () => {
      console.log("Disconnected from server");
      setIsConnected(false);
    });
    
    s.on("users-update", (usersList: User[]) => {
      console.log("Users updated:", usersList);
      setUsers(usersList || []);
    });
    
    s.on("room-created", (data: { roomId: string, users: User[] }) => {
      console.log("Room created event received:", data);
      setRoomId(data.roomId);
      setUsers(data.users || []);
    });
    
    s.on("room-joined", (data: { 
      roomId: string, 
      users: User[], 
      code?: string, 
      language?: string, 
      output?: any, 
      whiteboard?: any,
      flowchart?: any 
    }) => {
      console.log("Room joined event received:", data);
      setRoomId(data.roomId);
      setUsers(data.users || []);
      
      // Emit custom event with flowchart data for FlowchartPanel
      if (data.flowchart) {
        s.emit('flowchart-state-received', data.flowchart);
      }
    });
    
    // Add output-change listener
    s.on("output-change", (data: { result: any, userId: string }) => {
      console.log("Output changed:", data);
      // This will be handled in the CodeEditor component
    });
    
    s.on("error", (error: { message: string }) => {
      console.error("Socket error:", error.message);
    });

    // Cleanup on unmount
    return () => {
      s.disconnect();
      console.log("Socket disconnected");
    };
  }, []);

  const createRoom = (username: string, roomId: string) => {
    if (socket && roomId && username) {
      console.log(`Creating room: ${roomId} with username: ${username}`);
      socket.emit("createRoom", { username, roomId });
    } else {
      console.warn("Cannot create room: socket, roomId, or username is invalid");
    }
  };

  const joinRoom = (username: string, roomId: string) => {
    if (socket && roomId && username) {
      console.log(`Joining room: ${roomId} with username: ${username}`);
      socket.emit("joinRoom", { username, roomId });
    } else {
      console.warn("Cannot join room: socket, roomId, or username is invalid");
    }
  };

  return (
    <SocketContext.Provider value={{ 
      socket, 
      roomId, 
      users, 
      isConnected, 
      createRoom, 
      joinRoom 
    }}>
      {children}
    </SocketContext.Provider>
  );
};