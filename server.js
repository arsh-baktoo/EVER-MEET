const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// ✅ Allow frontend from Vercel
app.use(cors({
  origin: "https://ever-meet.vercel.app",
  methods: ["GET", "POST"],
  credentials: true
}));

// ✅ Enable CORS for Socket.io
const io = new Server(server, {
  cors: {
    origin: "https://ever-meet.vercel.app",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// ✅ Serve static files
app.use(express.static(path.join(__dirname, "public")));

// ✅ Serve index.html at root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ✅ Your full socket.io room logic (same as you have)
const rooms = new Map();

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
  
  socket.onAny((event, ...args) => {
    console.log(`[SOCKET EVENT] ${event}`, args);
  });

  socket.on("createRoom", (data) => {
    const { roomId, userId, username } = data;
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        id: roomId,
        name: "Chat Room",
        host: userId,
        members: [{ id: userId, name: username, socketId: socket.id, isHost: true }],
        activeVideo: null,
      });
      socket.join(roomId);
      io.to(socket.id).emit("roomJoined", {
        success: true,
        roomId,
        roomName: "Chat Room",
        members: rooms.get(roomId).members,
        activeVideo: null,
      });
    } else {
      io.to(socket.id).emit("roomJoined", {
        success: false,
        message: "Room already exists",
      });
    }
  });

  socket.on("joinRoom", (data) => {
    const { roomId, userId, username } = data;
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.members.push({ id: userId, name: username, socketId: socket.id, isHost: false });
      socket.join(roomId);
      io.to(socket.id).emit("roomJoined", {
        success: true,
        roomId,
        roomName: room.name,
        members: room.members,
        activeVideo: room.activeVideo,
      });
      socket.to(roomId).emit("userJoined", { userId, username, isHost: false });
    } else {
      io.to(socket.id).emit("roomJoined", {
        success: false,
        message: "Room not found",
      });
    }
  });

  socket.on("leaveRoom", (data) => {
    const { roomId, userId, username } = data;
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      const isHost = room.host === userId;
      if (isHost) {
        socket.to(roomId).emit("roomClosed");
        rooms.delete(roomId);
      } else {
        room.members = room.members.filter(m => m.id !== userId);
        socket.to(roomId).emit("userLeft", { userId, username });
      }
      socket.leave(roomId);
    }
  });

  socket.on("message", (data) => {
    const { roomId, message } = data;
    if (rooms.has(roomId)) {
      socket.to(roomId).emit("message", { roomId, message });
    }
  });

  socket.on("shareVideo", (data) => {
    const { roomId, userId, username, videoId } = data;
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.activeVideo = videoId;
      io.to(roomId).emit("videoShared", { userId, username, videoId });
    }
  });

  socket.on("videoAction", (data) => {
    for (const [roomId, room] of rooms.entries()) {
      if (room.members.some(m => m.socketId === socket.id)) {
        socket.to(roomId).emit("videoAction", data);
        break;
      }
    }
  });

  socket.on("disconnect", () => {
    for (const [roomId, room] of rooms.entries()) {
      const memberIndex = room.members.findIndex(m => m.socketId === socket.id);
      if (memberIndex !== -1) {
        const member = room.members[memberIndex];
        if (room.host === member.id) {
          socket.to(roomId).emit("roomClosed");
          rooms.delete(roomId);
        } else {
          room.members.splice(memberIndex, 1);
          socket.to(roomId).emit("userLeft", { userId: member.id, username: member.name });
        }
        break;
      }
    }
  });
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
