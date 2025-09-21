"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Stage, Layer, Line, Text, Transformer, Rect, Circle } from 'react-konva';
import { ShareButton } from './ShareButton';
import { useSocket } from '@/contexts/SocketContext';

interface Point {
  x: number;
  y: number;
}

interface TextBox {
  id: string;
  x: number;
  y: number;
  text: string;
  width: number;
  height: number;
}

interface Shape {
  id: string;
  type: 'rectangle' | 'circle' | 'line';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
}

interface DrawingHistory {
  lines: LineData[];
  textBoxes: TextBox[];
  shapes: Shape[];
  timestamp: number;
}

interface LineData {
  points: number[];
  color: string;
  size: number;
  tool: string;
}

function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export const CustomWhiteboard = () => {
  const { socket, roomId } = useSocket();
  const stageRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentSize, setCurrentSize] = useState(5); // Ensure currentSize is defined
  const [lines, setLines] = useState<LineData[]>([]);
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null);
  const [history, setHistory] = useState<DrawingHistory[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [coordinates, setCoordinates] = useState('Position: (0, 0)');
  const [shareUrl, setShareUrl] = useState('');
  const [currentLine, setCurrentLine] = useState<LineData | null>(null);
  const [currentShape, setCurrentShape] = useState<Shape | null>(null);
  const [stageScale, setStageScale] = useState(1);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });
  const [isDraggingStage, setIsDraggingStage] = useState(false);
  const [lastPointerPosition, setLastPointerPosition] = useState({ x: 0, y: 0 });
  const [isClient, setIsClient] = useState(false);
  const [isUpdatingFromSocket, setIsUpdatingFromSocket] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(0);
  const [isClearing, setIsClearing] = useState(false);
  const [clearOperationId, setClearOperationId] = useState(0);

  // Handle client-side rendering for SSR
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initialize WebSocket and sync state
  useEffect(() => {
    if (socket && roomId) {
      socket.on('connect_error', (error: any) => {
        console.error('WebSocket connection error:', error);
      });

      // Listen for room join confirmation with initial whiteboard state
      socket.on('room-joined', ({ roomId, users, code, language, output, whiteboard }: any) => {
        console.log('Room joined with whiteboard state:', whiteboard);
        if (whiteboard) {
          setIsUpdatingFromSocket(true);
          setLines(whiteboard.lines || []);
          setTextBoxes(whiteboard.textBoxes || []);
          setShapes(whiteboard.shapes || []);
          setIsUpdatingFromSocket(false);
        }
      });

      socket.on('whiteboard-update', (data: { lines: LineData[], textBoxes: TextBox[], shapes: Shape[], clearOperationId?: number }) => {
        console.log('Received whiteboard update:', data);
        console.log('Current state before update:', { lines: lines.length, textBoxes: textBoxes.length, shapes: shapes.length });
        
        const now = Date.now();
        
        // Check if this is a clear operation (all arrays are empty)
        const isClearOperation = (data.lines?.length === 0 && data.textBoxes?.length === 0 && data.shapes?.length === 0);
        
        if (isClearOperation) {
          console.log('Processing clear operation from socket - applying immediately', { clearOperationId: data.clearOperationId });
          // For clear operations, apply immediately without any delays or checks
          setLines([]);
          setTextBoxes([]);
          setShapes([]);
          setIsUpdatingFromSocket(false);
          setIsClearing(false);
          setLastUpdateTime(now);
          setClearOperationId(data.clearOperationId || 0);
          return;
        }
        
        // For non-clear operations, apply the existing logic
        // Prevent updates if we're currently drawing or if updates are too frequent
        if (isDrawing || (now - lastUpdateTime < 200)) {
          console.log('Skipping update - currently drawing or too frequent');
          return;
        }
        
        setLastUpdateTime(now);
        setIsUpdatingFromSocket(true);
        
        // Use a longer delay to prevent conflicts with local updates
        setTimeout(() => {
          setLines(data.lines || []);
          setTextBoxes(data.textBoxes || []);
          setShapes(data.shapes || []);
          setIsUpdatingFromSocket(false);
          console.log('Whiteboard state updated from socket');
        }, 100);
      });

      socket.on('whiteboard-state', (data: { lines: LineData[], textBoxes: TextBox[], shapes: Shape[] }) => {
        console.log('Received whiteboard state:', data);
        setIsUpdatingFromSocket(true);
        setLines(data.lines || []);
        setTextBoxes(data.textBoxes || []);
        setShapes(data.shapes || []);
        setIsUpdatingFromSocket(false);
      });

      socket.emit('request-whiteboard-state', { roomId });

      return () => {
        socket.off('room-joined');
        socket.off('whiteboard-update');
        socket.off('whiteboard-state');
        socket.off('connect_error');
      };
    }
  }, [socket, roomId]);

  // Sync whiteboard state when it changes (with better debouncing)
  useEffect(() => {
    if (socket && roomId && !isUpdatingFromSocket && (lines.length > 0 || textBoxes.length > 0 || shapes.length > 0)) {
      // Use a longer debounce to prevent flickering
      const timeoutId = setTimeout(() => {
        // Only sync if we're not in the middle of a clear operation
        if (!isClearing) {
          console.log('Whiteboard state changed - syncing:', { 
            lines: lines.length, 
            textBoxes: textBoxes.length, 
            shapes: shapes.length,
            socketConnected: socket.connected,
            roomId,
            clearOperationId
          });
          socket.emit('whiteboard-update', { lines, textBoxes, shapes, roomId });
        } else {
          console.log('Skipping sync - clear operation in progress');
        }
      }, 500); // Increased debounce time to prevent conflicts

      return () => clearTimeout(timeoutId);
    }
  }, [lines, textBoxes, shapes, socket, roomId, isUpdatingFromSocket, isClearing, clearOperationId]);

  const debouncedSaveState = useCallback(debounce((lines: LineData[], textBoxes: TextBox[], shapes: Shape[]) => {
    if (socket && roomId && !isUpdatingFromSocket) {
      // Only prevent sync if we're actively clearing (not just the flag being set)
      if (!isClearing) {
        console.log('Emitting whiteboard-update from debouncedSaveState:', { lines, textBoxes, shapes, roomId });
        socket.emit('whiteboard-update', { lines, textBoxes, shapes, roomId });
      } else {
        console.log('Skipping debouncedSaveState - clear operation in progress');
      }
    }
  }, 500), [socket, roomId, isUpdatingFromSocket, isClearing]); // Increased debounce time

  const saveState = useCallback(() => {
    if (isUpdatingFromSocket) return;
    const newHistory = [...history.slice(0, historyStep + 1), {
      lines: JSON.parse(JSON.stringify(lines)),
      textBoxes: JSON.parse(JSON.stringify(textBoxes)),
      shapes: JSON.parse(JSON.stringify(shapes)),
      timestamp: Date.now(),
    }];
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
    debouncedSaveState(lines, textBoxes, shapes);
  }, [history, historyStep, lines, textBoxes, shapes, debouncedSaveState, isUpdatingFromSocket]);

  const restoreState = useCallback((step: number) => {
    if (step < 0 || step >= history.length) return;
    const state = history[step];
    
    // Set updating flag to prevent conflicts
    setIsUpdatingFromSocket(true);
    setIsClearing(false); // Ensure we're not in clearing mode
    
    setLines(state.lines);
    setTextBoxes(state.textBoxes);
    setShapes(state.shapes);
    setHistoryStep(step);

    // Immediately sync undo/redo operations to other users
    if (socket && roomId) {
      console.log('Syncing undo/redo operation:', { 
        lines: state.lines.length, 
        textBoxes: state.textBoxes.length, 
        shapes: state.shapes.length, 
        roomId 
      });
      setTimeout(() => {
        socket.emit('whiteboard-update', { 
          lines: state.lines, 
          textBoxes: state.textBoxes, 
          shapes: state.shapes, 
          roomId 
        });
        // Reset the flag after sync
        setTimeout(() => {
          setIsUpdatingFromSocket(false);
        }, 100);
      }, 200);
    } else {
      setIsUpdatingFromSocket(false);
    }
  }, [history, socket, roomId]);

  const undo = useCallback(() => {
    if (historyStep > 0) restoreState(historyStep - 1);
  }, [historyStep, restoreState]);

  const redo = useCallback(() => {
    if (historyStep < history.length - 1) restoreState(historyStep + 1);
  }, [historyStep, history.length, restoreState]);

  const clearCanvas = useCallback(() => {
    // Generate unique clear operation ID
    const operationId = Date.now();
    setClearOperationId(operationId);
    
    // Set flags to prevent conflicts
    setIsUpdatingFromSocket(true);
    setIsClearing(true);
    
    // Save current state to history before clearing
    const newHistory = [...history.slice(0, historyStep + 1), {
      lines: JSON.parse(JSON.stringify(lines)),
      textBoxes: JSON.parse(JSON.stringify(textBoxes)),
      shapes: JSON.parse(JSON.stringify(shapes)),
      timestamp: Date.now(),
    }];
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
    
    setLines([]);
    setTextBoxes([]);
    setShapes([]);
    setCurrentLine(null);
    setCurrentShape(null);
    
    // Immediately sync clear operation to other users
    if (socket && roomId) {
      console.log('Syncing clear canvas operation:', { roomId, operationId });
      // Send immediately without delay for real-time delete
      socket.emit('whiteboard-update', { 
        lines: [], 
        textBoxes: [], 
        shapes: [], 
        roomId,
        clearOperationId: operationId
      });
      // Reset the flags after a short delay
      setTimeout(() => {
        setIsUpdatingFromSocket(false);
        setIsClearing(false);
      }, 50);
    } else {
      setIsUpdatingFromSocket(false);
      setIsClearing(false);
    }
  }, [history, historyStep, lines, textBoxes, shapes, socket, roomId]);

  const downloadCanvas = useCallback(() => {
    const stage = stageRef.current?.getStage();
    if (!stage) {
      console.error('Stage not available for download');
      return;
    }

    try {
      // Create a temporary stage with white background for download
      const tempStage = new Konva.Stage({
        container: document.createElement('div'),
        width: stage.width(),
        height: stage.height(),
      });

      // Create a white background layer
      const backgroundLayer = new Konva.Layer();
      const background = new Konva.Rect({
        x: 0,
        y: 0,
        width: stage.width(),
        height: stage.height(),
        fill: 'white',
      });
      backgroundLayer.add(background);

      // Clone all elements from the original stage
      const originalLayer = stage.getLayers()[0];
      const clonedLayer = new Konva.Layer();
      
      // Clone all shapes, lines, and text
      originalLayer.getChildren().forEach((node) => {
        const clonedNode = node.clone();
        clonedLayer.add(clonedNode);
      });

      // Add layers to temp stage
      tempStage.add(backgroundLayer);
      tempStage.add(clonedLayer);

      // Get the data URL with white background
      const dataURL = tempStage.toDataURL({
        mimeType: 'image/png',
        quality: 1,
        pixelRatio: 2, // Higher quality
      });

      // Clean up temporary stage
      tempStage.destroy();

      // Create a temporary link element to trigger download
      const link = document.createElement('a');
      link.download = `whiteboard-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
      link.href = dataURL;
      
      // Trigger the download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('Whiteboard image downloaded successfully with white background');
    } catch (error) {
      console.error('Error downloading whiteboard image:', error);
    }
  }, []);

  const getStagePos = useCallback((e: any) => {
    const stage = stageRef.current?.getStage();
    if (!stage || !stage.getPointerPosition) {
      console.warn('Stage or pointer position not available');
      return { x: 0, y: 0 };
    }
    const pointerPos = stage.getPointerPosition();
    return {
      x: (pointerPos.x - stagePosition.x) / stageScale,
      y: (pointerPos.y - stagePosition.y) / stageScale,
    };
  }, [stageScale, stagePosition]);

  const updateCoordinates = useCallback((e: any) => {
    const pos = getStagePos(e);
    setCoordinates(`Position: (${Math.round(pos.x)}, ${Math.round(pos.y)})`);
  }, [getStagePos]);

  const addTextBox = useCallback(() => {
    const stage = stageRef.current?.getStage();
    if (!stage) return;
    const pos = getStagePos({ target: stage });
    const newTextBox: TextBox = {
      id: `text-${Date.now()}`,
      x: pos.x,
      y: pos.y,
      text: 'Double click to edit',
      width: 150,
      height: 40,
    };
    const newTextBoxes = [...textBoxes, newTextBox];
    setTextBoxes(newTextBoxes);
    
    // Immediately sync text boxes to other users
    if (socket && roomId && !isUpdatingFromSocket) {
      console.log('Syncing text box creation:', { textBoxes: newTextBoxes.length, roomId });
      setTimeout(() => {
        socket.emit('whiteboard-update', { 
          lines, 
          textBoxes: newTextBoxes, 
          shapes, 
          roomId 
        });
      }, 200);
    }
    setSelectedTextBoxId(newTextBox.id);
    saveState();
  }, [saveState, getStagePos, socket, roomId, isUpdatingFromSocket, lines, shapes]);

  const startDrawing = useCallback((e: any) => {
    console.log('startDrawing:', { tool: currentTool, isDrawing, target: e.target.getClassName() });
    if (currentTool === 'text' && (e.target.getClassName() === 'Text' || e.target.getParent()?.getClassName() === 'Text')) {
      return; // Let onDblClick handle editing
    }
    if (currentTool === 'select' && e.target === e.target.getStage()) {
      setIsDraggingStage(true);
      setLastPointerPosition({
        x: e.evt.clientX,
        y: e.evt.clientY,
      });
      return;
    }
    if (currentTool === 'text') {
      addTextBox();
      return;
    }
    setIsDrawing(true);
    const pos = getStagePos(e);
    if (currentTool === 'pen') {
      const newLine: LineData = {
        points: [pos.x, pos.y],
        color: currentColor,
        size: currentSize, // Use defined currentSize
        tool: currentTool,
      };
      setCurrentLine(newLine);
      setLines((prev) => [...prev, newLine]);
    } else if (['rectangle', 'circle', 'line'].includes(currentTool)) {
      const newShape: Shape = {
        id: `shape-${Date.now()}`,
        type: currentTool as 'rectangle' | 'circle' | 'line',
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        color: currentColor,
        strokeWidth: currentSize, // Use defined currentSize
      };
      setCurrentShape(newShape);
    }
  }, [currentTool, currentColor, currentSize, getStagePos, addTextBox]);

  const draw = useCallback((e: any) => {
    if (isDraggingStage) {
      e.evt.preventDefault();
      const stage = stageRef.current;
      const point = stage.getPointerPosition();
      if (!point) return;
      setStagePosition({
        x: stagePosition.x + (point.x - lastPointerPosition.x),
        y: stagePosition.y + (point.y - lastPointerPosition.y),
      });
      setLastPointerPosition({ x: point.x, y: point.y });
      return;
    }
    if (!isDrawing || isUpdatingFromSocket) return; // Prevent drawing during socket updates
    const pos = getStagePos(e);
    updateCoordinates(e);
    if (currentTool === 'pen' && currentLine) {
      const updatedLine = {
        ...currentLine,
        points: [...currentLine.points, pos.x, pos.y],
      };
      setCurrentLine(updatedLine);
      setLines((prevLines) => {
        const newLines = [...prevLines];
        if (newLines.length > 0 && newLines[newLines.length - 1] === currentLine) {
          newLines[newLines.length - 1] = updatedLine;
        } else {
          newLines.push(updatedLine);
        }
        return newLines;
      });
    } else if (currentShape && ['rectangle', 'circle', 'line'].includes(currentTool)) {
      setCurrentShape((prev) => prev && ({
        ...prev,
        width: pos.x - prev.x,
        height: pos.y - prev.y,
      }));
    }
  }, [isDrawing, isDraggingStage, currentTool, currentLine, currentShape, getStagePos, updateCoordinates, stagePosition, lastPointerPosition, isUpdatingFromSocket]);

  const stopDrawing = useCallback(() => {
    if (isDraggingStage) {
      setIsDraggingStage(false);
      return;
    }
    if (isDrawing) {
      if (currentTool === 'pen' && currentLine) {
        setLines((prevLines) => {
          const newLines = [...prevLines];
          if (newLines.length > 0 && newLines[newLines.length - 1] === currentLine) {
            newLines[newLines.length - 1] = { ...currentLine };
          } else {
            newLines.push({ ...currentLine });
          }
          return newLines;
        });
        setCurrentLine(null);
      } else if (currentShape && ['rectangle', 'circle', 'line'].includes(currentTool)) {
        if (Math.abs(currentShape.width) > 5 && Math.abs(currentShape.height) > 5) {
          const newShapes = [...shapes, { ...currentShape }];
          setShapes(newShapes);
          
          // Immediately sync shapes to other users
          if (socket && roomId && !isUpdatingFromSocket) {
            console.log('Syncing shape creation:', { 
              shapes: newShapes.length, 
              roomId,
              isClearing,
              isUpdatingFromSocket
            });
            setTimeout(() => {
              socket.emit('whiteboard-update', { 
                lines, 
                textBoxes, 
                shapes: newShapes, 
                roomId 
              });
            }, 200);
          }
        }
        setCurrentShape(null);
      }
      saveState();
    }
    setIsDrawing(false);
  }, [isDrawing, isDraggingStage, currentTool, currentLine, currentShape, saveState, socket, roomId, isUpdatingFromSocket, lines, textBoxes]);

  const handleTextBoxDoubleClick = useCallback((e: any, id: string) => {
    e.evt.stopPropagation();
    const textBox = textBoxes.find((tb) => tb.id === id);
    if (!textBox) return;

    const existingTextareas = document.querySelectorAll('textarea.whiteboard-textarea');
    existingTextareas.forEach((textarea) => textarea.remove());

    const stage = stageRef.current?.getStage();
    if (!stage) return;

    const absolutePos = stage.getAbsolutePosition();
    const scaledX = textBox.x * stageScale + stagePosition.x + absolutePos.x;
    const scaledY = textBox.y * stageScale + stagePosition.y + absolutePos.y;

    const textarea = document.createElement('textarea');
    textarea.className = 'whiteboard-textarea';
    textarea.value = textBox.text;
    textarea.style.position = 'absolute';
    textarea.style.left = `${scaledX}px`;
    textarea.style.top = `${scaledY}px`;
    textarea.style.width = `${textBox.width * stageScale}px`;
    textarea.style.height = `${textBox.height * stageScale}px`;
    textarea.style.fontSize = `${16 * stageScale}px`;
    textarea.style.padding = '10px';
    textarea.style.border = '2px solid #007bff';
    textarea.style.borderRadius = '5px';
    textarea.style.zIndex = '1000';
    textarea.style.background = 'white';
    textarea.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
    textarea.style.resize = 'none';

    const finishEditing = () => {
      const newText = textarea.value;
      const updatedTextBoxes = textBoxes.map((tb) =>
        tb.id === id ? { ...tb, text: newText } : tb
      );
      setTextBoxes(updatedTextBoxes);
      
      // Immediately sync text box changes to other users
      if (socket && roomId && !isUpdatingFromSocket) {
        setTimeout(() => {
          socket.emit('whiteboard-update', { 
            lines, 
            textBoxes: updatedTextBoxes, 
            shapes, 
            roomId 
          });
        }, 200);
      }
      textarea.remove();
      saveState();
    };

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        finishEditing();
      } else if (e.key === 'Escape') {
        textarea.remove();
      }
    });

    textarea.addEventListener('blur', finishEditing);
    document.body.appendChild(textarea);
    textarea.focus();
  }, [textBoxes, saveState, stageScale, stagePosition]);

  const handleTextBoxSelect = useCallback((e: any, id: string) => {
    e.evt.stopPropagation();
    setSelectedTextBoxId(id);
  }, []);

  const handleTextBoxDragEnd = useCallback((e: any, id: string) => {
    const updatedTextBoxes = textBoxes.map((tb) =>
      tb.id === id ? { ...tb, x: e.target.x(), y: e.target.y() } : tb
    );
    setTextBoxes(updatedTextBoxes);
    
    // Immediately sync text box position changes to other users
    if (socket && roomId && !isUpdatingFromSocket) {
      setTimeout(() => {
        socket.emit('whiteboard-update', { 
          lines, 
          textBoxes: updatedTextBoxes, 
          shapes, 
          roomId 
        });
      }, 200);
    }
    saveState();
  }, [saveState, socket, roomId, isUpdatingFromSocket, lines, shapes, textBoxes]);

  useEffect(() => {
    if (transformerRef.current && selectedTextBoxId) {
      const stage = stageRef.current?.getStage();
      if (stage) {
        const node = stage.findOne(`#${selectedTextBoxId}`);
        if (node) {
          transformerRef.current.nodes([node]);
          transformerRef.current.getLayer().batchDraw();
        } else {
          console.warn(`Text box with ID ${selectedTextBoxId} not found`);
        }
      }
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer().batchDraw();
    }
  }, [selectedTextBoxId]);

  const handleStageClick = useCallback((e: any) => {
    if (e.target === e.target.getStage()) {
      setSelectedTextBoxId(null);
    }
  }, []);

  const handleWheel = useCallback((e: any) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;

    const oldScale = stageScale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const deltaY = e.evt.deltaY / 100;
    const scaleBy = 1.1;
    const newScale = deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

    const clampedScale = Math.max(0.1, Math.min(10, newScale));
    if (clampedScale === oldScale) return;

    const mousePointTo = {
      x: (pointer.x - stagePosition.x) / oldScale,
      y: (pointer.y - stagePosition.y) / oldScale,
    };

    setStageScale(clampedScale);
    setStagePosition({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
  }, [stageScale, stagePosition]);

  const resetView = useCallback(() => {
    setStageScale(1);
    setStagePosition({ x: 0, y: 0 });
  }, []);

  const renderedLines = useMemo(() => {
    return lines.map((line, i) => (
      <Line
        key={`line-${i}-${line.points.length}`}
        points={line.points}
        stroke={line.color}
        strokeWidth={line.size}
        tension={0.5}
        lineCap="round"
        lineJoin="round"
        globalCompositeOperation="source-over"
      />
    ));
  }, [lines]);

  const renderedShapes = useMemo(() => {
    return shapes.map((shape) => {
      if (shape.type === 'rectangle') {
        return (
          <Rect
            key={shape.id}
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            stroke={shape.color}
            strokeWidth={shape.strokeWidth}
            fill="transparent"
          />
        );
      } else if (shape.type === 'circle') {
        const radius = Math.max(Math.abs(shape.width), Math.abs(shape.height)) / 2;
        return (
          <Circle
            key={shape.id}
            x={shape.x + shape.width / 2}
            y={shape.y + shape.height / 2}
            radius={radius}
            stroke={shape.color}
            strokeWidth={shape.strokeWidth}
            fill="transparent"
          />
        );
      } else if (shape.type === 'line') {
        return (
          <Line
            key={shape.id}
            points={[shape.x, shape.y, shape.x + shape.width, shape.y + shape.height]}
            stroke={shape.color}
            strokeWidth={shape.strokeWidth}
          />
        );
      }
      return null;
    });
  }, [shapes]);

  if (!isClient) {
    return (
      <div className="h-full flex flex-col bg-white border border-gray-300 rounded-lg">
        <div className="p-3 bg-gray-100 border-b border-gray-300">
          <div className="text-sm font-medium text-gray-700">🎨 Infinity Whiteboard</div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p>Loading whiteboard...</p>
        </div>
      </div>
    );
  }

  // Debug info
  console.log('Whiteboard Debug:', {
    socket: !!socket,
    socketConnected: socket?.connected,
    roomId,
    isUpdatingFromSocket,
    linesCount: lines.length,
    textBoxesCount: textBoxes.length,
    shapesCount: shapes.length
  });

  return (
    <div className="h-full flex flex-col bg-white border border-gray-300 rounded-lg">
      <div className="p-3 bg-gray-100 border-b border-gray-300 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-gray-700">🎨 Infinity Whiteboard</div>
          <div className={`w-2 h-2 rounded-full ${socket?.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-xs text-gray-500">
            {socket?.connected ? 'Connected' : 'Disconnected'} | Room: {roomId || 'None'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-white p-1 rounded">
            {['select', 'pen', 'rectangle', 'circle', 'line', 'text'].map((tool) => (
              <button
                key={tool}
                onClick={() => setCurrentTool(tool)}
                className={`p-2 rounded text-sm ${
                  currentTool === tool ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
                title={tool.charAt(0).toUpperCase() + tool.slice(1)}
              >
                {tool === 'select' && '✋'}
                {tool === 'pen' && '✏️'}
                {tool === 'rectangle' && '⬜'}
                {tool === 'circle' && '⭕'}
                {tool === 'line' && '📏'}
                {tool === 'text' && '📝'}
              </button>
            ))}
          </div>
          <input
            type="color"
            value={currentColor}
            onChange={(e) => setCurrentColor(e.target.value)}
            className="w-8 h-8 cursor-pointer"
          />
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="1"
              max="20"
              value={currentSize}
              onChange={(e) => setCurrentSize(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-sm text-gray-600 w-6">{currentSize}px</span>
          </div>
          <button
            onClick={resetView}
            className="p-2 bg-gray-500 text-white rounded text-sm"
            title="Reset View"
          >
            🔍
          </button>
          <ShareButton 
            code=""
            language="whiteboard"
            drawingData={{ dataURL: stageRef.current?.toDataURL?.() || '', width: 1000, height: 1000, timestamp: Date.now() }}
            onShare={(url) => setShareUrl(url)}
          />
          <div className="flex gap-1">
            <button
              onClick={undo}
              disabled={historyStep <= 0}
              className="p-2 bg-gray-500 text-white rounded text-sm disabled:opacity-50"
              title="Undo"
            >
              ↶
            </button>
            <button
              onClick={redo}
              disabled={historyStep >= history.length - 1}
              className="p-2 bg-gray-500 text-white rounded text-sm disabled:opacity-50"
              title="Redo"
            >
              ↷
            </button>
            <button
              onClick={clearCanvas}
              className="p-2 bg-red-500 text-white rounded text-sm"
              title="Clear Canvas"
            >
              🗑️
            </button>
            <button
              onClick={downloadCanvas}
              className="p-2 bg-green-500 text-white rounded text-sm"
              title="Download Image"
            >
              📥
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 relative overflow-hidden">
        <Stage
          ref={stageRef}
          width={window.innerWidth - 40}
          height={window.innerHeight - 150}
          scaleX={stageScale}
          scaleY={stageScale}
          x={stagePosition.x}
          y={stagePosition.y}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onMouseEnter={updateCoordinates}
          onClick={handleStageClick}
          onWheel={handleWheel}
          draggable={currentTool === 'select'}
        >
          <Layer ref={layerRef}>
            {renderedLines}
            {renderedShapes}
            {currentShape && (
              <>
                {currentShape.type === 'rectangle' && (
                  <Rect
                    x={currentShape.x}
                    y={currentShape.y}
                    width={currentShape.width}
                    height={currentShape.height}
                    stroke={currentShape.color}
                    strokeWidth={currentShape.strokeWidth}
                    fill="transparent"
                    dash={[5, 5]}
                  />
                )}
                {currentShape.type === 'circle' && (
                  <Circle
                    x={currentShape.x + currentShape.width / 2}
                    y={currentShape.y + currentShape.height / 2}
                    radius={Math.max(Math.abs(currentShape.width), Math.abs(currentShape.height)) / 2}
                    stroke={currentShape.color}
                    strokeWidth={currentShape.strokeWidth}
                    fill="transparent"
                    dash={[5, 5]}
                  />
                )}
                {currentShape.type === 'line' && (
                  <Line
                    points={[currentShape.x, currentShape.y, currentShape.x + currentShape.width, currentShape.y + currentShape.height]}
                    stroke={currentShape.color}
                    strokeWidth={currentShape.strokeWidth}
                    dash={[5, 5]}
                  />
                )}
              </>
            )}
            {textBoxes.map((textBox) => (
              <Text
                key={textBox.id}
                id={textBox.id}
                x={textBox.x}
                y={textBox.y}
                text={textBox.text}
                width={textBox.width}
                height={textBox.height}
                fontSize={16}
                fontFamily="Arial"
                padding={10}
                align="left"
                verticalAlign="middle"
                fill="#000000"
                draggable={currentTool === 'select'}
                onClick={(e) => handleTextBoxSelect(e, textBox.id)}
                onDblClick={(e) => handleTextBoxDoubleClick(e, textBox.id)}
                onDragEnd={(e) => handleTextBoxDragEnd(e, textBox.id)}
                onTransformEnd={(e) => {
                  const node = e.target;
                  const scaleX = node.scaleX();
                  const scaleY = node.scaleY();
                  node.scaleX(1);
                  node.scaleY(1);
                  const updatedTextBoxes = textBoxes.map((tb) =>
                    tb.id === textBox.id
                      ? {
                          ...tb,
                          x: node.x(),
                          y: node.y(),
                          width: Math.max(50, node.width() * scaleX),
                          height: Math.max(30, node.height() * scaleY),
                        }
                      : tb
                  );
                  setTextBoxes(updatedTextBoxes);
                  
                  // Immediately sync text box resize changes to other users
                  if (socket && roomId && !isUpdatingFromSocket) {
                    setTimeout(() => {
                      socket.emit('whiteboard-update', { 
                        lines, 
                        textBoxes: updatedTextBoxes, 
                        shapes, 
                        roomId 
                      });
                    }, 200);
                  }
                  saveState();
                }}
              />
            ))}
            <Transformer
              ref={transformerRef}
              enabledAnchors={['middle-left', 'middle-right', 'top-center', 'bottom-center']}
              boundBoxFunc={(oldBox, newBox) => {
                newBox.width = Math.max(50, newBox.width);
                newBox.height = Math.max(30, newBox.height);
                return newBox;
              }}
            />
          </Layer>
        </Stage>
      </div>
      <div className="p-2 bg-gray-100 border-t border-gray-300 text-sm text-gray-600 flex justify-between">
        <div>{coordinates}</div>
        <div className="flex gap-4">
          <span>Current tool: {currentTool} • {currentTool === 'select' ? 'Drag to pan, wheel to zoom' : 'Click and drag to draw'}</span>
          {shareUrl && (
            <span className="text-blue-600">
              Shared: <a href={shareUrl} className="underline" target="_blank" rel="noopener noreferrer">View</a>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};