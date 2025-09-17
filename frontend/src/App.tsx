import { CodeEditor } from './components/CodeEditor';
import { SocketProvider, useSocket } from './contexts/SocketContext';

function Header() {
  const { roomId } = useSocket();
  
  
}

export default function App() {
  return (
    <SocketProvider>
      <div className="min-h-screen bg-gray-900">
        
        <main className="h-[calc(100vh-80px)]">
          <CodeEditor />
        </main>
      </div>
    </SocketProvider>
  );
}