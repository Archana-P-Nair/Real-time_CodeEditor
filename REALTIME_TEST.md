# Real-time Whiteboard Test Instructions

## Step 1: Start the Backend Server
```bash
cd prokect-main/backend
npm run dev
```
You should see: `🚀 Backend server running on port 3001`

## Step 2: Start the Frontend
```bash
cd prokect-main/frontend
npm run dev
```
You should see: `Ready - started server on 0.0.0.0:3000`

## Step 3: Test Real-time Synchronization

### Browser Tab 1 (User 1):
1. Open `http://localhost:3000`
2. In the header, enter a room ID (e.g., "test123") and username (e.g., "User1")
3. Click "Join/Create Room"
4. Go to the Whiteboard tab
5. Check the connection status - should show green dot and "Connected"
6. Draw something on the whiteboard (circle, line, text)

### Browser Tab 2 (User 2):
1. Open another tab to `http://localhost:3000`
2. Enter the SAME room ID ("test123") and different username (e.g., "User2")
3. Click "Join/Create Room"
4. Go to the Whiteboard tab
5. Check the connection status - should show green dot and "Connected"
6. You should see User1's drawing immediately

## Expected Behavior:
- ✅ Both users should see green connection status
- ✅ Both users should see the same room ID
- ✅ When User1 draws, User2 should see it instantly
- ✅ When User2 draws, User1 should see it instantly
- ✅ Console should show debug messages about socket events

## Debugging:
1. Open browser DevTools (F12)
2. Check Console tab for messages like:
   - "Connected to server"
   - "Room joined with whiteboard state:"
   - "Whiteboard state changed - syncing:"
   - "Received whiteboard update:"

## If Not Working:
1. Check if backend is running on port 3001
2. Check browser console for errors
3. Verify both users are in the same room
4. Check network tab for WebSocket connection

## Quick Fix Commands:
```bash
# Kill any existing processes
pkill -f "node.*3001"
pkill -f "next.*3000"

# Restart backend
cd prokect-main/backend && npm run dev

# Restart frontend (in new terminal)
cd prokect-main/frontend && npm run dev
```




