"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface User {
  id: string;
  username: string;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  roomId: string | null;
  users: User[];
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  createRoom: (username: string) => void;
  joinRoom: (username: string, roomId: string) => void;
  leaveRoom: () => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  roomId: null,
  users: [],
  currentUser: null,
  setCurrentUser: () => {},
  createRoom: () => {},
  joinRoom: () => {},
  leaveRoom: () => {},
});

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
  children: React.ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    console.log('Connecting to socket server:', socketUrl);
    const newSocket = io(socketUrl, {
      autoConnect: false,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Socket connected:', newSocket.id);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      setCurrentUser(null);
      setRoomId(null);
      setUsers([]);
      console.log('Socket disconnected');
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      alert('Failed to connect to the server. Please check your connection and try again.');
    });

    newSocket.on('error', (data: { message: string }) => {
      console.error('Socket error:', data.message);
      alert(data.message);
      setRoomId(null);
      setUsers([]);
    });

    newSocket.on('users-update', (userList: User[]) => {
      console.log('Users updated:', userList);
      setUsers(userList);
    });

    newSocket.on('room-created', (data: { roomId: string; users: User[] }) => {
      console.log('Room created:', data);
      setRoomId(data.roomId);
      setUsers(data.users);
    });

    newSocket.on('room-joined', (data: { roomId: string; users: User[] }) => {
      console.log('Room joined:', data);
      setRoomId(data.roomId);
      setUsers(data.users);
    });

    newSocket.on('user-joined', (user: User) => {
      console.log('User joined:', user.username);
      setUsers((prev) => [...prev, user]);
    });

    newSocket.on('user-left', (userId: string) => {
      console.log('User left:', userId);
      setUsers((prev) => prev.filter((user) => user.id !== userId));
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      console.log('Socket cleanup');
    };
  }, []);

  const createRoom = (username: string) => {
    if (socket) {
      if (!socket.connected) {
        socket.connect();
        socket.once('connect', () => {
          const user = { id: socket.id, username };
          setCurrentUser(user);
          socket.emit('create-room', user);
        });
      } else {
        const user = { id: socket.id, username };
        setCurrentUser(user);
        socket.emit('create-room', user);
      }
    }
  };

  const joinRoom = (username: string, roomId: string) => {
    if (socket) {
      if (!socket.connected) {
        socket.connect();
        socket.once('connect', () => {
          const user = { id: socket.id, username };
          setCurrentUser(user);
          socket.emit('join-room', { roomId, user });
        });
      } else {
        const user = { id: socket.id, username };
        setCurrentUser(user);
        socket.emit('join-room', { roomId, user });
      }
    }
  };

  const leaveRoom = () => {
    if (socket) {
      socket.emit('leave-room');
      socket.disconnect();
      setRoomId(null);
      setUsers([]);
      setCurrentUser(null);
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        roomId,
        users,
        currentUser,
        setCurrentUser,
        createRoom,
        joinRoom,
        leaveRoom,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};