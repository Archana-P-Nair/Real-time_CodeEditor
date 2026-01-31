"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CodeEditor } from "@/components/CodeEditor";
import { WhiteboardWrapper } from "@/components/WhiteboardWrapper";
import { isShareUrl } from "@/lib/shareUtils";
import { useSocket } from "@/contexts/SocketContext";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"editor" | "whiteboard">("editor");
  const [isSplitView, setIsSplitView] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(true);
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { createRoom, joinRoom } = useSocket();

  // When opening an invite link (?room=XXX), pre-fill room and show join modal
  useEffect(() => {
    const roomFromUrl = searchParams.get("room");
    if (roomFromUrl?.trim()) {
      setRoomId(roomFromUrl.trim());
      setIsLoginModalOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    // Redirect to share page if URL is a share link
    if (isShareUrl()) {
      router.push(window.location.pathname);
    }
  }, [router]);

  // Handler for creating a room
  const handleCreateRoom = (username: string) => {
    setUsername(username);
    // Generate a random room ID or use your backend logic
    const newRoomId = Math.random().toString(36).substring(2, 8);
    setRoomId(newRoomId);
    setIsLoginModalOpen(false);
    createRoom(username, newRoomId); // <-- Notify backend/socket
  };

  // Handler for joining a room
  const handleJoinRoom = (username: string, roomId: string) => {
    setUsername(username);
    setRoomId(roomId);
    setIsLoginModalOpen(false);
    joinRoom(username, roomId); // <-- Notify backend/socket
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="p-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">CollabCode Canvas</h1>
            <p className="text-gray-400">Code + Custom Whiteboard</p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSplitView(!isSplitView)}
              className={`px-4 py-2 rounded ${
                isSplitView ? "bg-blue-600" : "bg-gray-600"
              }`}
            >
              {isSplitView ? "Single View" : "Split View"}
            </button>

            <div className="flex bg-gray-700 rounded">
              <button
                onClick={() => setActiveTab("editor")}
                className={`px-4 py-2 rounded ${
                  activeTab === "editor" ? "bg-blue-600" : "bg-gray-700"
                }`}
              >
                💻 Code Editor
              </button>
              <button
                onClick={() => setActiveTab("whiteboard")}
                className={`px-4 py-2 rounded ${
                  activeTab === "whiteboard" ? "bg-blue-600" : "bg-gray-700"
                }`}
              >
                🎨 Whiteboard
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 h-[calc(100vh-80px)]">
        {isSplitView ? (
          // Split View - Proper 50/50 split
          <div className="flex h-full w-full">
            <div className="w-1/2 border-r border-gray-700">
              <CodeEditor
                isLoginModalOpen={isLoginModalOpen}
                onCreateRoom={handleCreateRoom}
                onJoinRoom={handleJoinRoom}
                username={username}
                roomId={roomId}
              />
            </div>
            <div className="w-1/2">
              <WhiteboardWrapper />
            </div>
          </div>
        ) : (
          // Single View
          <div className="h-full w-full">
            {activeTab === "editor" ? (
              <CodeEditor
                isLoginModalOpen={isLoginModalOpen}
                onCreateRoom={handleCreateRoom}
                onJoinRoom={handleJoinRoom}
                username={username}
                roomId={roomId}
              />
            ) : (
              <WhiteboardWrapper />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
