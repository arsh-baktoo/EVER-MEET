const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const path = require("path")
const cors = require("cors") // ✅ move this down

// Create Express app
const app = express() // ✅ define app first
app.use(cors({
  origin: "https://ever-meet.vercel.app",
  methods: ["GET", "POST"]
}))

const server = http.createServer(app)
const io = new Server(server)


// Serve static files
app.use(express.static(path.join(__dirname, "public")))

// Active rooms
const rooms = new Map()

// Socket.io connection
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id)

  // Log all events for debugging
  socket.onAny((event, ...args) => {
    console.log(`[SOCKET EVENT] ${event}`, args)
  })

  // Create a new room
  socket.on("createRoom", (data) => {
    console.log("Create room request received:", data)
    const { roomId, userId, username } = data

    // Create room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        id: roomId,
        name: "Chat Room",
        host: userId,
        members: [{ id: userId, name: username, socketId: socket.id, isHost: true }],
        activeVideo: null,
      })

      // Join socket.io room
      socket.join(roomId)
      console.log(`Socket ${socket.id} joined room ${roomId}`)

      // Send room joined confirmation
      io.to(socket.id).emit("roomJoined", {
        success: true,
        roomId,
        roomName: "Chat Room",
        members: rooms.get(roomId).members,
        activeVideo: null,
      })

      console.log(`Room created: ${roomId} by ${username}`)
      console.log(`Current rooms: ${Array.from(rooms.keys()).join(", ")}`)
    } else {
      // Room already exists
      console.log(`Room ${roomId} already exists`)
      io.to(socket.id).emit("roomJoined", {
        success: false,
        message: "Room already exists",
      })
    }
  })

  // Join an existing room
  socket.on("joinRoom", (data) => {
    console.log("Join room request received:", data)
    const { roomId, userId, username } = data

    // Check if room exists
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId)

      // Add user to room
      room.members.push({
        id: userId,
        name: username,
        socketId: socket.id,
        isHost: false,
      })

      // Join socket.io room
      socket.join(roomId)
      console.log(`Socket ${socket.id} joined room ${roomId}`)

      // Send room joined confirmation
      io.to(socket.id).emit("roomJoined", {
        success: true,
        roomId,
        roomName: room.name,
        members: room.members,
        activeVideo: room.activeVideo,
      })

      // Notify other users
      socket.to(roomId).emit("userJoined", {
        userId,
        username,
        isHost: false,
      })

      console.log(`${username} joined room: ${roomId}`)
    } else {
      // Room doesn't exist
      console.log(`Room ${roomId} not found`)
      io.to(socket.id).emit("roomJoined", {
        success: false,
        message: "Room not found",
      })
    }
  })

  // Leave room
  socket.on("leaveRoom", (data) => {
    console.log("Leave room request received:", data)
    const { roomId, userId, username } = data

    if (rooms.has(roomId)) {
      const room = rooms.get(roomId)

      // Check if user is host
      const isHost = room.host === userId

      if (isHost) {
        // If host leaves, close the room
        socket.to(roomId).emit("roomClosed")
        rooms.delete(roomId)
        console.log(`Room closed: ${roomId}`)
      } else {
        // Remove user from room
        room.members = room.members.filter((member) => member.id !== userId)

        // Notify other users
        socket.to(roomId).emit("userLeft", {
          userId,
          username,
        })

        console.log(`${username} left room: ${roomId}`)
      }

      // Leave socket.io room
      socket.leave(roomId)
    }
  })

  // New message
  socket.on("message", (data) => {
    console.log("New message received:", data)
    const { roomId, message } = data

    if (rooms.has(roomId)) {
      // Broadcast message to room
      socket.to(roomId).emit("message", {
        roomId,
        message,
      })
    }
  })

  // Share YouTube video
  socket.on("shareVideo", (data) => {
    console.log("Share video request received:", data)
    const { roomId, userId, username, videoId } = data

    if (rooms.has(roomId)) {
      const room = rooms.get(roomId)

      // Update active video
      room.activeVideo = videoId

      // Broadcast to room
      io.to(roomId).emit("videoShared", {
        userId,
        username,
        videoId,
      })

      console.log(`${username} shared video in room ${roomId}: ${videoId}`)
    }
  })

  // Video actions (play, pause, seek)
  socket.on("videoAction", (data) => {
    console.log("Video action received:", data)

    // Find which room this socket is in
    for (const [roomId, room] of rooms.entries()) {
      if (room.members.some((member) => member.socketId === socket.id)) {
        // Broadcast video action to room
        socket.to(roomId).emit("videoAction", data)
        break
      }
    }
  })

  // Disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id)

    // Find and remove user from all rooms
    for (const [roomId, room] of rooms.entries()) {
      const memberIndex = room.members.findIndex((member) => member.socketId === socket.id)

      if (memberIndex !== -1) {
        const member = room.members[memberIndex]

        // Check if user is host
        if (room.host === member.id) {
          // If host disconnects, close the room
          socket.to(roomId).emit("roomClosed")
          rooms.delete(roomId)
          console.log(`Room closed (host disconnected): ${roomId}`)
        } else {
          // Remove user from room
          room.members.splice(memberIndex, 1)

          // Notify other users
          socket.to(roomId).emit("userLeft", {
            userId: member.id,
            username: member.name,
          })

          console.log(`${member.name} disconnected from room: ${roomId}`)
        }

        break
      }
    }
  })
})
// Fallback route to serve index.html at root URL
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});


// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
})
