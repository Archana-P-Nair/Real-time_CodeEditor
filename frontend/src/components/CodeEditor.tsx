"use client";

import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Loader2, Share, Copy, Check } from 'lucide-react';
import { ShareButton } from './ShareButton';
import DictionaryPanel from './DictionaryPanel';
import LoginModal from './LoginModal';
import UserList from './UserList';
import { useSocket } from '../contexts/SocketContext';

// Programming terms dictionary
const programmingTerms: Record<string, { name: string; description: string; useCase: string; type?: string }> = {
  function: {
    name: "function",
    description: "A function is a block of code designed to perform a particular task. It is executed when it is called (invoked). Functions can take parameters and return values.",
    useCase: "// Function declaration\nfunction name(parameters) {\n  // code to be executed\n}",
    type: "Keyword"
  },
  def: {
    name: "def (Python function)",
    description: "In Python, 'def' is used to define a function. It creates a reusable block of code that can be called with specific arguments.",
    useCase: "# Python function\ndef function_name(parameters):\n    // code to be executed\n    return value",
    type: "Keyword"
  },
  console: {
    name: "console",
    description: "The console object provides access to the browser's debugging console. It contains methods like log(), error(), and warn().",
    useCase: '// Output to console\nconsole.log("Hello, World!");',
    type: "Object"
  },
  print: {
    name: "print",
    description: "The print() function outputs messages to the standard output device (screen) or other output stream.",
    useCase: '# Print in Python\nprint("Hello, World!")',
    type: "Function"
  },
  include: {
    name: "#include",
    description: "In C/C++, #include is a preprocessor directive that includes the contents of another file in the current source file.",
    useCase: "// Include standard input/output library\n#include <stdio.h>",
    type: "Preprocessor Directive"
  },
  import: {
    name: "import",
    description: "The import statement is used to include external modules or libraries in your code.",
    useCase: "# Import math module in Python\nimport math",
    type: "Keyword"
  },
  class: {
    name: "class",
    description: "A class is a blueprint for creating objects, providing initial values for state (member variables) and implementations of behavior (member functions or methods).",
    useCase: "// Class definition in Java\npublic class MyClass {\n    // class body\n}",
    type: "Keyword"
  },
  return: {
    name: "return",
    description: "The return statement ends function execution and specifies a value to be returned to the function caller.",
    useCase: "// Return a value from function\nreturn value;",
    type: "Keyword"
  },
  for: {
    name: "for loop",
    description: "A for loop repeats a block of code a specific number of times. It typically uses a counter variable to control the number of iterations.",
    useCase: "// For loop example\nfor (let i = 0; i < 5; i++) {\n    console.log(i);\n}",
    type: "Control Structure"
  },
  if: {
    name: "if statement",
    description: "The if statement executes a block of code if a specified condition is true.",
    useCase: "// If statement\nif (condition) {\n    // code to execute if condition is true\n}",
    type: "Control Structure"
  },
  const: {
    name: "const",
    description: "The const declaration creates a read-only reference to a value. It does not mean the value it holds is immutable, just that the variable identifier cannot be reassigned.",
    useCase: "// Constant declaration\nconst PI = 3.14159;",
    type: "Keyword"
  },
  let: {
    name: "let",
    description: "The let statement declares a block-scoped local variable, optionally initializing it to a value.",
    useCase: "// Let declaration\nlet counter = 0;",
    type: "Keyword"
  },
  var: {
    name: "var",
    description: "The var statement declares a function-scoped or globally-scoped variable, optionally initializing it to a value.",
    useCase: "// Var declaration\nvar message = 'Hello';",
    type: "Keyword"
  }
};

interface ExecutionResult {
  output: string;
  status: string;
  time: string;
  memory: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const defaultCode: { [key: string]: string } = {
  python: `# Welcome to CollabCode Canvas!
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

print("Fibonacci sequence:")
for i in range(10):
    print(f"F({i}) = {fibonacci(i)}")`,

  javascript: `// Welcome to CollabCode Canvas!
function fibonacci(n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log("Fibonacci sequence:");
for (let i = 0; i < 10; i++) {
    console.log(\`F(\${i}) = \${fibonacci(i)}\`);
}`,

  cpp: `// Welcome to CollabCode Canvas!
#include <iostream>
using namespace std;

int fibonacci(int n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

int main() {
    cout << "Fibonacci sequence:" << endl;
    for (int i = 0; i < 10; i++) {
        cout << "F(" << i << ") = " << fibonacci(i) << endl;
    }
    return 0;
}`,

  java: `// Welcome to CollabCode Canvas!
public class Main {
    public static int fibonacci(int n) {
        if (n <= 1) return n;
        return fibonacci(n - 1) + fibonacci(n - 2);
    }

    public static void main(String[] args) {
        System.out.println("Fibonacci sequence:");
        for (int i = 0; i < 10; i++) {
            System.out.println("F(" + i + ") = " + fibonacci(i));
        }
    }
}`,

  c: `// Welcome to CollabCode Canvas!
#include <stdio.h>

int fibonacci(int n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

int main() {
    printf("Fibonacci sequence:\\n");
    for (int i = 0; i < 10; i++) {
        printf("F(%d) = %d\\n", i, fibonacci(i));
    }
    return 0;
}`
};

export const CodeEditor = () => {
  const [code, setCode] = useState<string>(defaultCode.python);
  const [language, setLanguage] = useState('python');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [stdin, setStdin] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [activeTerm, setActiveTerm] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<any>(null);
  const [isDictionaryVisible, setIsDictionaryVisible] = useState(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const { socket, isConnected, users, roomId, createRoom, joinRoom } = useSocket();

  // Handle login - create room
  const handleCreateRoom = (username: string) => {
    createRoom(username);
    setIsLoginModalOpen(false);
  };

  // Handle login - join room
  const handleJoinRoom = (username: string, roomId: string) => {
    joinRoom(username, roomId);
    setIsLoginModalOpen(false);
  };

  // Handle code changes and broadcast to other users
  const handleCodeChange = (value: string | undefined) => {
    const newCode = value || '';
    setCode(newCode);
    
    if (socket) {
      socket.emit('code-change', {
        code: newCode,
        userId: socket.id
      });
    }
  };

  // Handle language changes and broadcast to other users
  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    const newCode = defaultCode[newLanguage] || `// Write your ${newLanguage} code here`;
    setCode(newCode);
    setResult(null);
    setActiveTerm(null);
    setHoverInfo(null);
    
    if (socket) {
      socket.emit('language-change', {
        language: newLanguage,
        code: newCode,
        userId: socket.id
      });
    }
  };

  // Listen for incoming code changes from other users
  useEffect(() => {
    if (!socket) return;

    const handleIncomingCodeChange = (data: { code: string; userId: string }) => {
      if (data.userId !== socket.id) {
        setCode(data.code);
      }
    };

    const handleIncomingLanguageChange = (data: { language: string; code: string; userId: string }) => {
      if (data.userId !== socket.id) {
        setLanguage(data.language);
        setCode(data.code);
      }
    };

    socket.on('code-change', handleIncomingCodeChange);
    socket.on('language-change', handleIncomingLanguageChange);

    return () => {
      socket.off('code-change', handleIncomingCodeChange);
      socket.off('language-change', handleIncomingLanguageChange);
    };
  }, [socket]);

  // Copy room link to clipboard - FIXED VERSION
  const copyRoomLink = async () => {
    if (roomId) {
      // Create a more complete URL with protocol and pathname
      const roomLink = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
      
      console.log('Attempting to copy:', roomLink); // Debug log
      
      try {
        // Try using the modern Clipboard API first
        await navigator.clipboard.writeText(roomLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        
        // Show a more visible success message
        console.log('Room link copied successfully!');
      } catch (err) {
        console.error('Failed to copy using Clipboard API: ', err);
        
        // Fallback method for older browsers or HTTP sites
        try {
          const textArea = document.createElement('textarea');
          textArea.value = roomLink;
          textArea.style.position = 'fixed';
          textArea.style.top = '0';
          textArea.style.left = '0';
          textArea.style.width = '2em';
          textArea.style.height = '2em';
          textArea.style.padding = '0';
          textArea.style.border = 'none';
          textArea.style.outline = 'none';
          textArea.style.boxShadow = 'none';
          textArea.style.background = 'transparent';
          
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          
          if (successful) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            console.log('Room link copied using fallback method!');
          } else {
            console.error('Fallback copy method failed');
            // Last resort - prompt the user to copy manually
            prompt('Copy this room link:', roomLink);
          }
        } catch (fallbackErr) {
          console.error('Both copy methods failed: ', fallbackErr);
          // Last resort - prompt the user to copy manually
          prompt('Copy this room link:', roomLink);
        }
      }
    } else {
      console.error('No room ID available to copy');
    }
  };

  // Check for room ID in URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      console.log('Room ID from URL:', roomParam);
      // You could auto-join the room here if desired
    }
  }, []);
  
  const handleRunCode = async () => {
    setIsRunning(true);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          language,
          stdin
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        output: `Connection error: ${error}`,
        status: 'Error',
        time: '0.00s',
        memory: '0KB'
      });
    } finally {
      setIsRunning(false);
    }
  };

  const toggleDictionaryVisibility = () => {
    setIsDictionaryVisible(!isDictionaryVisible);
  };

  // Configure Monaco Editor for hover functionality
  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    // Set up hover provider for all languages
    setupHoverProvider(monaco);
  };

  const setupHoverProvider = (monaco: any) => {
    if (!monaco.languages.registerHoverProvider) return;

    // Register hover provider for all supported languages
    const languages = ['python', 'javascript', 'typescript', 'cpp', 'java', 'c'];
    
    languages.forEach(lang => {
      monaco.languages.registerHoverProvider(lang, {
        provideHover: (model: any, position: any) => {
          const word = model.getWordAtPosition(position);
          if (!word) return null;

          const lineContent = model.getLineContent(position.lineNumber);
          const wordText = word.word;
          
          // Check if it's a known programming term
          if (programmingTerms[wordText]) {
            setActiveTerm(wordText);
            setHoverInfo(null);
            return {
              range: new monaco.Range(
                position.lineNumber,
                word.startColumn,
                position.lineNumber,
                word.endColumn
              ),
              contents: [
                { value: `**${programmingTerms[wordText].name}**` },
                { value: `*Type: ${programmingTerms[wordText].type}*` },
                { value: programmingTerms[wordText].description },
                { value: '```' + lang + '\n' + programmingTerms[wordText].useCase + '\n```' }
              ]
            };
          }
          
          // Check if it's a variable or user-defined identifier
          const variableInfo = analyzeIdentifier(wordText, lineContent, position, lang);
          if (variableInfo) {
            setHoverInfo(variableInfo);
            setActiveTerm(null);
            return {
              range: new monaco.Range(
                position.lineNumber,
                word.startColumn,
                position.lineNumber,
                word.endColumn
              ),
              contents: [
                { value: `**${variableInfo.name}**` },
                { value: `*Type: ${variableInfo.type}*` },
                { value: variableInfo.description }
              ]
            };
          }
          
          // Default case - show generic identifier info
          const genericInfo = getGenericIdentifierInfo(wordText, lineContent, lang);
          setHoverInfo(genericInfo);
          setActiveTerm(null);
          return {
            range: new monaco.Range(
              position.lineNumber,
              word.startColumn,
              position.lineNumber,
              word.endColumn
            ),
            contents: [
              { value: `**${genericInfo.name}**` },
              { value: `*Type: ${genericInfo.type}*` },
              { value: genericInfo.description }
            ]
          };
        }
      });
    });
  };

  const analyzeIdentifier = (identifier: string, lineContent: string, position: any, lang: string) => {
    // Simple analysis to determine identifier type
    const line = lineContent.toLowerCase();
    
    // Check if it's a function call
    if (line.includes(identifier + '(') || line.includes(identifier + ' (')) {
      return {
        name: identifier,
        type: "Function/Method",
        description: `This appears to be a function or method call. In ${lang}, functions are reusable blocks of code that perform specific tasks.`
      };
    }
    
    // Check if it's a variable declaration
    const declarationPatterns = {
      javascript: /(var|let|const)\s+/,
      python: /^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*=/,
      java: /(int|float|double|String|boolean|char)\s+/,
      cpp: /(int|float|double|char|bool)\s+/,
      c: /(int|float|double|char)\s+/
    };
    
    if (declarationPatterns[lang as keyof typeof declarationPatterns] && 
        declarationPatterns[lang as keyof typeof declarationPatterns].test(line)) {
      return {
        name: identifier,
        type: "Variable",
        description: `This appears to be a variable. Variables are used to store data values in ${lang}.`
      };
    }
    
    return null;
  };

  const getGenericIdentifierInfo = (identifier: string, lineContent: string, lang: string) => {
    // Provide generic information about identifiers
    return {
      name: identifier,
      type: "Identifier",
      description: `This is an identifier in your ${lang} code. Identifiers are names given to variables, functions, classes, etc.`
    };
  };

  return (
    <div className="h-full flex flex-col bg-gray-800">
      <LoginModal 
        isOpen={isLoginModalOpen} 
        onJoinRoom={handleJoinRoom}
        onCreateRoom={handleCreateRoom}
      />
      
      {/* Room Code Display in Header */}
      <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">CollabCode Canvas</h1>
          <p className="text-gray-400">Real-time collaborative code editor with dictionary</p>
        </div>
        
        {roomId && (
          <div className="bg-blue-600 px-3 py-1 rounded-md">
            <span className="text-sm text-white font-medium">Room: </span>
            <span className="text-sm text-white">{roomId}</span>
          </div>
        )}
      </div>
      
      {/* Toolbar */}
      <div className="p-3 bg-gray-700 flex items-center gap-3 flex-wrap">
        <select
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="px-3 py-1 bg-gray-600 text-white rounded text-sm"
        >
          <option value="python">Python</option>
          <option value="javascript">JavaScript</option>
          <option value="cpp">C++</option>
          <option value="java">Java</option>
          <option value="c">C</option>
        </select>

        <button
          onClick={handleRunCode}
          disabled={isRunning}
          className="px-3 py-1 bg-green-600 text-white rounded text-sm flex items-center gap-1 disabled:bg-gray-600"
        >
          {isRunning ? <Loader2 className="animate-spin w-4 h-4" /> : <Play className="w-4 h-4" />}
          Run
        </button>
        
        <ShareButton 
          code={code} 
          language={language} 
          onShare={(url) => setShareUrl(url)}
        />

        <div className="flex items-center gap-2 ml-auto">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-300">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        <span className="text-sm text-gray-300">
          Language: {language.toUpperCase()}
        </span>
      </div>

      <div className="flex-1 flex">
        {/* Editor Area */}
        <div className="flex-1 flex flex-col">
          {/* Editor */}
          <div className="flex-1">
            <Editor
              height="100%"
              language={language}
              theme="vs-dark"
              value={code}
              onChange={handleCodeChange}
              onMount={handleEditorDidMount}
              options={{
                minimap: { enabled: true },
                fontSize: 14,
                lineNumbers: 'on',
                automaticLayout: true,
                padding: { top: 16, bottom: 16 },
                hover: {
                  enabled: true,
                  delay: 100,
                  sticky: true
                }
              }}
            />
          </div>

          {/* Dictionary Panel */}
          <DictionaryPanel 
            activeTerm={activeTerm} 
            definitions={programmingTerms} 
            hoverInfo={hoverInfo}
            isVisible={isDictionaryVisible}
            onToggle={toggleDictionaryVisibility}
          />

          {/* Output Panel */}
          <div className="h-48 border-t border-gray-600">
            <div className="p-2 bg-gray-700 border-b border-gray-600 flex items-center justify-between">
              <span className="text-sm font-medium">Output</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Input:</span>
                <input
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  placeholder="stdin"
                  className="px-2 py-1 bg-gray-600 text-white rounded text-xs w-32"
                />
              </div>
            </div>
            <div className="p-3 bg-gray-800 h-40 overflow-auto">
              <pre className="text-green-400 text-sm whitespace-pre-wrap font-mono">
                {result?.output || 'Click "Run" to see output...'}
              </pre>
              {result && (
                <div className="mt-2 text-xs text-gray-400 flex gap-3">
                  <span>Status: {result.status}</span>
                  <span>Time: {result.time}</span>
                  <span>Memory: {result.memory}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* User List Sidebar */}
        <div className="w-64 bg-gray-750 border-l border-gray-600 p-3">
          <UserList users={users} />
          
          <div className="mt-4 p-3 bg-gray-700 rounded-md">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Room Information</h3>
            <div className="text-xs text-gray-400 space-y-1">
              <p>Room ID: <span className="text-blue-400">{roomId || 'Not connected'}</span></p>
              <p>Users online: <span className="text-green-400">{users.length}</span></p>
            </div>
            <button 
              onClick={copyRoomLink}
              disabled={!roomId}
              className="w-full mt-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-1 text-xs rounded-md transition-colors flex items-center justify-center gap-1"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Copy Room Link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};