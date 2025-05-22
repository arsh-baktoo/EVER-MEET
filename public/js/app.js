// DOM Elements
const joinRoomContainer = document.getElementById("join-room-container")
const appContainer = document.getElementById("app-container")
const usernameInput = document.getElementById("username-input")
const roomCodeInput = document.getElementById("room-code-input")
const createRoomBtn = document.getElementById("create-room-btn")
const joinRoomBtn = document.getElementById("join-room-btn")
const chatMessages = document.getElementById("chat-messages")
const messageInput = document.getElementById("message-input")
const sendMessageBtn = document.getElementById("send-message-btn")
const currentRoomCode = document.getElementById("current-room-code")
const copyRoomCodeBtn = document.getElementById("copy-room-code")
const leaveRoomBtn = document.getElementById("leave-room-btn")
const roomName = document.getElementById("room-name")
const onlineCount = document.getElementById("online-count")
const roomMembers = document.getElementById("room-members")
const youtubePlayerContainer = document.getElementById("youtube-player-container")
const youtubePlayer = document.getElementById("youtube-player")
const shareYoutubeBtn = document.getElementById("share-youtube-btn")
const youtubeModal = document.getElementById("youtube-modal")
const closeModal = document.getElementById("close-modal")
const youtubeUrlInput = document.getElementById("youtube-url-input")
const shareVideoBtn = document.getElementById("share-video-btn")
const toggleUsersBtn = document.getElementById("toggle-users-btn")
const rightSidebar = document.getElementById("right-sidebar")
const closeSidebar = document.getElementById("close-sidebar")
const videoPlayPauseBtn = document.getElementById("video-play-pause")
const videoMuteBtn = document.getElementById("video-mute")
const videoProgressBar = document.getElementById("video-progress-bar")
const videoFullscreenBtn = document.getElementById("video-fullscreen")
const currentTimeEl = document.getElementById("current-time")
const durationEl = document.getElementById("duration")
const videoTitle = document.getElementById("video-title")
const inlineYoutubeUrl = document.getElementById("inline-youtube-url")
const inlineShareVideoBtn = document.getElementById("inline-share-video-btn")

// Theme toggle buttons
const themeLightBtn = document.getElementById("theme-light")
const themeDarkBtn = document.getElementById("theme-dark")
const themeSpaceBtn = document.getElementById("theme-space")

// Initialize socket connection
const socket = window.io("https://ever-meet-production.up.railway.app", {
  transports: ["websocket"]
});


// Debug socket connection
socket.on("connect", () => {
  console.log("Connected to server with ID:", socket.id)
})

socket.on("connect_error", (error) => {
  console.error("Connection error:", error)
})

// YouTube player
let player
let isVideoPlaying = false
let isMuted = false
let videoUpdateInterval

// User and room data
let currentUser = {
  id: "",
  name: "",
  isHost: false,
}

let currentRoom = {
  id: "",
  name: "Chat Room",
  members: [],
}

// Initialize YouTube API
window.onYouTubeIframeAPIReady = () => {
  console.log("YouTube API Ready")
}

// Format time for video player (seconds to MM:SS)
function formatVideoTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return "0:00"

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`
}

// Create YouTube player
function createYouTubePlayer(videoId, startTime = 0) {
  console.log("Creating YouTube player with video ID:", videoId)

  const YT = window.YT // Declare YT variable

  if (typeof YT === "undefined" || !YT.Player) {
    console.log("YouTube API not ready yet, waiting...")
    setTimeout(() => createYouTubePlayer(videoId, startTime), 1000)
    return
  }

  try {
    // Make sure the container is visible first
    youtubePlayerContainer.style.display = "flex"

    if (player) {
      // Load video but don't autoplay
      player.cueVideoById({
        videoId: videoId,
        startSeconds: startTime,
      })
      console.log("Loaded new video in existing player at time:", startTime)
    } else {
      console.log("Creating new YouTube player instance")
      // Clear the container first to ensure proper rendering
      document.getElementById("youtube-player").innerHTML = ""

      player = new YT.Player("youtube-player", {
        height: "360",
        width: "640",
        videoId: videoId,
        playerVars: {
          playsinline: 1,
          autoplay: 0, // Don't autoplay
          controls: 0, // Hide default controls
          rel: 0,
          modestbranding: 1,
          start: Math.floor(startTime),
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
          onError: onPlayerError,
        },
      })
    }

    // Update play/pause button icon
    updatePlayPauseButton(false)

    // Start progress bar update
    startProgressBarUpdate()

    // Add a message to confirm video is loaded
    addSystemMessage(`YouTube video loaded: ${videoId}`)

    // Fetch video title
    fetchVideoTitle(videoId)
  } catch (error) {
    console.error("Error creating YouTube player:", error)
    addSystemMessage(`Error creating YouTube player: ${error.message}`)
  }
}

// Fetch video title from YouTube
function fetchVideoTitle(videoId) {
  // This is a simple way to get the title, in a real app you might use the YouTube API
  fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.title) {
        videoTitle.textContent = data.title
      } else {
        videoTitle.textContent = "YouTube Video"
      }
    })
    .catch((error) => {
      console.error("Error fetching video title:", error)
      videoTitle.textContent = "YouTube Video"
    })
}

// Player ready event
function onPlayerReady(event) {
  console.log("Player ready")
  // Don't autoplay, just update UI
  updatePlayPauseButton(false)

  // Update duration
  if (player && player.getDuration) {
    const duration = player.getDuration()
    durationEl.textContent = formatVideoTime(duration)
  }
}

// Player error event
function onPlayerError(event) {
  console.error("YouTube player error:", event.data)

  // Error codes: https://developers.google.com/youtube/iframe_api_reference#onError
  let errorMessage = "An error occurred with the YouTube player."

  switch (event.data) {
    case 2:
      errorMessage = "Invalid YouTube video ID."
      break
    case 5:
      errorMessage = "The requested content cannot be played in an HTML5 player."
      break
    case 100:
      errorMessage = "The video requested was not found."
      break
    case 101:
    case 150:
      errorMessage = "The video owner does not allow it to be played in embedded players."
      break
  }

  addSystemMessage(`YouTube Error: ${errorMessage}`)
}

// YouTube player state change event
function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    isVideoPlaying = true
    updatePlayPauseButton(true)

    socket.emit("videoAction", {
      action: "play",
      time: player.getCurrentTime(),
      videoId: player.getVideoData().video_id,
    })
  } else if (event.data === YT.PlayerState.PAUSED) {
    isVideoPlaying = false
    updatePlayPauseButton(false)

    socket.emit("videoAction", {
      action: "pause",
      time: player.getCurrentTime(),
      videoId: player.getVideoData().video_id,
    })
  } else if (event.data === YT.PlayerState.ENDED) {
    isVideoPlaying = false
    updatePlayPauseButton(false)
  }
}

// Update play/pause button icon
function updatePlayPauseButton(isPlaying) {
  if (isPlaying) {
    videoPlayPauseBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pause"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
    `
  } else {
    videoPlayPauseBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    `
  }
}

// Update mute button icon
function updateMuteButton(isMuted) {
  if (isMuted) {
    videoMuteBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-volume-x"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" x2="17" y1="9" y2="15"/><line x1="17" x2="23" y1="9" y2="15"/></svg>
    `
  } else {
    videoMuteBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-volume-2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
    `
  }
}

// Start progress bar update
function startProgressBarUpdate() {
  if (videoUpdateInterval) {
    clearInterval(videoUpdateInterval)
  }

  videoUpdateInterval = setInterval(() => {
    if (player && player.getCurrentTime && player.getDuration) {
      try {
        const currentTime = player.getCurrentTime()
        const duration = player.getDuration()

        // Update time display
        currentTimeEl.textContent = formatVideoTime(currentTime)
        durationEl.textContent = formatVideoTime(duration)

        if (duration > 0) {
          const progressPercent = (currentTime / duration) * 100
          videoProgressBar.style.width = `${progressPercent}%`
        }
      } catch (error) {
        console.error("Error updating progress bar:", error)
      }
    }
  }, 1000)
}

// Stop progress bar update
function stopProgressBarUpdate() {
  if (videoUpdateInterval) {
    clearInterval(videoUpdateInterval)
    videoUpdateInterval = null
  }
}

// Video controls event listeners
videoPlayPauseBtn.addEventListener("click", () => {
  if (player) {
    if (isVideoPlaying) {
      player.pauseVideo()
    } else {
      player.playVideo()
    }
  }
})

videoMuteBtn.addEventListener("click", () => {
  if (player) {
    if (isMuted) {
      player.unMute()
      isMuted = false
    } else {
      player.mute()
      isMuted = true
    }
    updateMuteButton(isMuted)
  }
})

// Fullscreen button
let isFullscreen = false

videoFullscreenBtn.addEventListener("click", () => {
  const container = youtubePlayerContainer
  if (!document.fullscreenElement) {
    if (container.requestFullscreen) {
      container.requestFullscreen()
    } else if (container.webkitRequestFullscreen) {
      container.webkitRequestFullscreen()
    } else if (container.msRequestFullscreen) {
      container.msRequestFullscreen()
    }
    container.classList.add("yt-fullscreen")
    isFullscreen = true
    videoFullscreenBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-minimize-2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" x2="21" y1="10" y2="3"/><line x1="3" x2="10" y1="21" y2="14"/></svg>
    `
  } else {
    document.exitFullscreen()
    // class will be removed in fullscreenchange event
    isFullscreen = false
    videoFullscreenBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-maximize-2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" x2="14" y1="3" y2="10"/><line x1="3" x2="10" y1="21" y2="14"/></svg>
    `
  }
})

document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement === youtubePlayerContainer) {
    youtubePlayerContainer.classList.add("yt-fullscreen")
  } else {
    youtubePlayerContainer.classList.remove("yt-fullscreen")
  }
  if (!document.fullscreenElement) {
    isFullscreen = false
    videoFullscreenBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-maximize-2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" x2="14" y1="3" y2="10"/><line x1="3" x2="10" y1="21" y2="14"/></svg>
    `
  }
})

// Click on progress bar to seek
document.querySelector(".video-progress").addEventListener("click", (e) => {
  if (player && player.getDuration) {
    const progressBar = e.currentTarget
    const clickPosition = e.offsetX / progressBar.offsetWidth
    const seekTime = player.getDuration() * clickPosition
    player.seekTo(seekTime)

    // Emit seek action
    socket.emit("videoAction", {
      action: "seek",
      time: seekTime,
      videoId: player.getVideoData().video_id,
    })
  }
})

// Inline share video button
inlineShareVideoBtn.addEventListener("click", () => {
  const youtubeUrl = inlineYoutubeUrl.value.trim()
  shareYoutubeVideo(youtubeUrl)
})

// Share YouTube video from inline input
function shareYoutubeVideo(youtubeUrl) {
  if (!youtubeUrl) {
    alert("Please enter a YouTube URL")
    return
  }

  const videoId = getYouTubeVideoId(youtubeUrl)

  if (!videoId) {
    alert("Invalid YouTube URL")
    return
  }

  // Share video with room
  socket.emit("shareVideo", {
    roomId: currentRoom.id,
    userId: currentUser.id,
    username: currentUser.name,
    videoId: videoId,
  })

  // Clear input
  inlineYoutubeUrl.value = ""
  if (youtubeUrlInput) {
    youtubeUrlInput.value = ""
  }

  // Add system message
  addSystemMessage(`You shared a YouTube video`)

  // Create message with video link
  const messageData = {
    userId: currentUser.id,
    username: currentUser.name,
    text: `Shared a YouTube video: ${youtubeUrl}`,
    timestamp: new Date(),
  }

  // Send to server
  socket.emit("message", {
    roomId: currentRoom.id,
    message: messageData,
  })

  // Add to chat
  addMessageToChat(messageData, true)

  // Create YouTube player
  createYouTubePlayer(videoId)
}

// Toggle room members sidebar
toggleUsersBtn.addEventListener("click", () => {
  rightSidebar.classList.toggle("active")
})

// Close sidebar
closeSidebar.addEventListener("click", () => {
  rightSidebar.classList.remove("active")
})

// Extract YouTube video ID from URL
function getYouTubeVideoId(url) {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  const match = url.match(regex)
  return match ? match[1] : null
}

// Create Room
createRoomBtn.addEventListener("click", () => {
  console.log("Create room button clicked")

  const username = usernameInput.value.trim()
  if (!username) {
    alert("Please enter your name")
    return
  }

  console.log("Creating room for user:", username)

  // Generate a random room code
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase()
  console.log("Generated room code:", roomCode)

  currentUser = {
    id: "user_" + Math.random().toString(36).substring(2, 9),
    name: username,
    isHost: true,
  }

  currentRoom = {
    id: roomCode,
    name: "Chat Room",
    members: [currentUser],
  }

  console.log("Emitting createRoom event to server")

  // Join the room
  socket.emit("createRoom", {
    roomId: roomCode,
    userId: currentUser.id,
    username: currentUser.name,
  })

  console.log("Waiting for server response...")

  // Show the chat interface
  joinRoomContainer.classList.add("hidden")
  appContainer.classList.remove("hidden")

  // Update UI
  currentRoomCode.textContent = roomCode
  roomName.textContent = currentRoom.name
  updateMembersList()

  // Add system message
  addSystemMessage(`Room created with code: ${roomCode}`)
  addSystemMessage(`You joined as ${username} (Host)`)

  // Show prompt in video area
  videoTitle.textContent = "No video playing"
  document.getElementById("youtube-player").innerHTML = `
    <div style="color:#aaa;text-align:center;padding:40px 0;">
      No video loaded.<br>
      <strong>Enter a YouTube link below to share a video with the room.</strong>
    </div>
  `
})

// Join Room
joinRoomBtn.addEventListener("click", () => {
  const username = usernameInput.value.trim()
  const roomCode = roomCodeInput.value.trim()

  if (!username || !roomCode) {
    alert("Please enter your name and room code")
    return
  }

  console.log(`Attempting to join room ${roomCode} as ${username}`)

  currentUser = {
    id: "user_" + Math.random().toString(36).substring(2, 9),
    name: username,
    isHost: false,
  }

  currentRoom = {
    id: roomCode,
    name: "Chat Room",
    members: [],
  }

  // Join the room
  socket.emit("joinRoom", {
    roomId: roomCode,
    userId: currentUser.id,
    username: currentUser.name,
  })
})

// Send Message
function sendMessage() {
  const messageText = messageInput.value.trim()

  if (messageText === "") return

  // Create message object
  const messageData = {
    userId: currentUser.id,
    username: currentUser.name,
    text: messageText,
    timestamp: new Date(),
  }

  // Send to server
  socket.emit("message", {
    roomId: currentRoom.id,
    message: messageData,
  })

  // Add to chat
  addMessageToChat(messageData, true)

  // Clear input
  messageInput.value = ""
}

// Send message on button click
sendMessageBtn.addEventListener("click", sendMessage)

// Send message on Enter key
messageInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
})

// Add message to chat
function addMessageToChat(message, isCurrentUser = false) {
  const messageElement = document.createElement("div")
  messageElement.classList.add("message")
  messageElement.classList.add(isCurrentUser ? "user-message" : "other-message")

  if (!isCurrentUser) {
    const senderElement = document.createElement("div")
    senderElement.classList.add("message-sender")

    const nameElement = document.createElement("div")
    nameElement.classList.add("sender-name")
    nameElement.textContent = message.username

    senderElement.appendChild(nameElement)
    messageElement.appendChild(senderElement)
  }

  const messageContent = document.createElement("div")
  messageContent.classList.add("message-content")
  messageContent.textContent = message.text

  const messageTime = document.createElement("div")
  messageTime.classList.add("message-time")
  messageTime.textContent = formatTime(message.timestamp)

  messageElement.appendChild(messageContent)
  messageElement.appendChild(messageTime)

  chatMessages.appendChild(messageElement)

  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight
}

// Add system message
function addSystemMessage(text) {
  const messageElement = document.createElement("div")
  messageElement.classList.add("system-message")
  messageElement.textContent = text

  chatMessages.appendChild(messageElement)

  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight
}

// Format timestamp
function formatTime(timestamp) {
  const date = new Date(timestamp)
  let hours = date.getHours()
  let minutes = date.getMinutes()

  hours = hours < 10 ? "0" + hours : hours
  minutes = minutes < 10 ? "0" + minutes : minutes

  return `${hours}:${minutes}`
}

// Update members list
function updateMembersList() {
  roomMembers.innerHTML = ""

  // Array of cute pet animal images
  const petImages = [
    "https://images.unsplash.com/photo-1543852786-1cf6624b9987?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80", // Cute dog
    "https://images.unsplash.com/photo-1548802673-380ab8ebc7b7?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80", // Cat
    "https://images.unsplash.com/photo-1425082661705-1834bfd09dca?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80", // Hamster
    "https://images.unsplash.com/photo-1583301286816-f4f05e1e8b25?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80", // Rabbit
    "https://images.unsplash.com/photo-1612267168669-679c961c5b31?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80", // Guinea pig
  ]

  currentRoom.members.forEach((member, index) => {
    const memberElement = document.createElement("div")
    memberElement.classList.add("member-item")

    // Use modulo to cycle through the pet images
    const petImageIndex = index % petImages.length

    memberElement.innerHTML = `
      <div class="member-avatar">
        <img src="${petImages[petImageIndex]}" alt="Pet avatar">
        <div class="member-status"></div>
      </div>
      <div class="member-info">
        <div class="member-name">
          ${member.name}
          ${member.isHost ? '<span class="host-badge">Host</span>' : ""}
        </div>
      </div>
    `

    roomMembers.appendChild(memberElement)
  })

  // Update online count
  onlineCount.textContent = `${currentRoom.members.length} Online`
}

// Copy room code
copyRoomCodeBtn.addEventListener("click", () => {
  navigator.clipboard
    .writeText(currentRoom.id)
    .then(() => {
      alert("Room code copied to clipboard!")
    })
    .catch((err) => {
      console.error("Could not copy text: ", err)
    })
})

// Leave room
leaveRoomBtn.addEventListener("click", () => {
  socket.emit("leaveRoom", {
    roomId: currentRoom.id,
    userId: currentUser.id,
    username: currentUser.name,
  })

  // Reset and show join screen
  resetApp()
})

// Reset app state
function resetApp() {
  // Clear inputs
  usernameInput.value = ""
  roomCodeInput.value = ""
  messageInput.value = ""
  inlineYoutubeUrl.value = ""

  // Clear chat
  chatMessages.innerHTML = ""

  // Hide YouTube player
  youtubePlayerContainer.style.display = "none"

  // Show join screen
  appContainer.classList.add("hidden")
  joinRoomContainer.classList.remove("hidden")

  // Reset user and room data
  currentUser = {
    id: "",
    name: "",
    isHost: false,
  }

  currentRoom = {
    id: "",
    name: "Chat Room",
    members: [],
  }

  // Destroy YouTube player
  if (player) {
    player.destroy()
    player = null
  }

  // Stop progress bar update
  stopProgressBarUpdate()

  // Reset video title
  videoTitle.textContent = "No video playing"
}

// Share YouTube video
shareYoutubeBtn.addEventListener("click", () => {
  youtubeModal.style.display = "flex"
})

// Close modal
closeModal.addEventListener("click", () => {
  youtubeModal.style.display = "none"
})

// Share video button
shareVideoBtn.addEventListener("click", () => {
  const youtubeUrl = youtubeUrlInput.value.trim()
  shareYoutubeVideo(youtubeUrl)
  youtubeModal.style.display = "none"
})

// Click outside modal to close
window.addEventListener("click", (e) => {
  if (e.target === youtubeModal) {
    youtubeModal.style.display = "none"
  }
})

// Theme switching
themeLightBtn.addEventListener("click", () => {
  document.body.className = "theme-light"
  setActiveThemeButton(themeLightBtn)
})

themeDarkBtn.addEventListener("click", () => {
  document.body.className = "theme-dark"
  setActiveThemeButton(themeDarkBtn)
})

themeSpaceBtn.addEventListener("click", () => {
  document.body.className = "theme-space"
  setActiveThemeButton(themeSpaceBtn)
})

function setActiveThemeButton(activeBtn) {
  // Remove active class from all theme buttons
  themeLightBtn.classList.remove("active")
  themeDarkBtn.classList.remove("active")
  themeSpaceBtn.classList.remove("active")

  // Add active class to the clicked button
  activeBtn.classList.add("active")
}

// Chat background switching
document.querySelectorAll('.chat-bg-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.chat-bg-btn').forEach(b => b.classList.remove('active'))
    this.classList.add('active')
    chatMessages.classList.remove('bg-default', 'bg-paper', 'bg-gradient')
    chatMessages.classList.add('bg-' + this.dataset.bg)
  })
})
// Set default on load
chatMessages.classList.add('bg-default')

// Socket.io event listeners

// Room joined successfully
socket.on("roomJoined", (data) => {
  console.log("Received roomJoined event:", data)

  if (data.success) {
    // Update room data
    currentRoom.members = data.members

    // Show the chat interface
    joinRoomContainer.classList.add("hidden")
    appContainer.classList.remove("hidden")

    // Update UI
    currentRoomCode.textContent = currentRoom.id
    roomName.textContent = data.roomName || currentRoom.name
    updateMembersList()

    // Add system message
    addSystemMessage(`You joined the room as ${currentUser.name}`)

    // Load active video if any, but don't autoplay
    if (data.activeVideo) {
      createYouTubePlayer(data.activeVideo)
    }
  } else {
    alert(data.message || "Failed to join room")
  }
})

// New message received
socket.on("message", (data) => {
  console.log("Received message:", data)

  // Only add messages from other users
  if (data.message.userId !== currentUser.id) {
    addMessageToChat(data.message)
  }
})

// User joined
socket.on("userJoined", (data) => {
  console.log("User joined:", data)

  // Add user to members list
  const newMember = {
    id: data.userId,
    name: data.username,
    isHost: data.isHost,
  }

  currentRoom.members.push(newMember)
  updateMembersList()

  // Add system message
  addSystemMessage(`${data.username} joined the room`)
})

// User left
socket.on("userLeft", (data) => {
  console.log("User left:", data)

  // Remove user from members list
  currentRoom.members = currentRoom.members.filter((member) => member.id !== data.userId)
  updateMembersList()

  // Add system message
  addSystemMessage(`${data.username} left the room`)
})

// Video shared
socket.on("videoShared", (data) => {
  console.log("Video shared:", data)

  // Create YouTube player with the shared video
  if (data.userId !== currentUser.id) {
    addSystemMessage(`${data.username} shared a YouTube video`)
    createYouTubePlayer(data.videoId)
  }
})

// Video action
socket.on("videoAction", (data) => {
  console.log("Video action:", data)

  if (player && player.getVideoData().video_id === data.videoId) {
    if (data.action === "play") {
      player.seekTo(data.time)
      player.playVideo()
    } else if (data.action === "pause") {
      player.seekTo(data.time)
      player.pauseVideo()
    } else if (data.action === "seek") {
      player.seekTo(data.time)
    }
  }
})

// Room closed
socket.on("roomClosed", () => {
  console.log("Room closed")

  alert("The room has been closed by the host")
  resetApp()
})

// Connection error
socket.on("connect_error", (error) => {
  console.error("Connection error:", error)
  alert("Failed to connect to the server. Please try again.")
})

// Log when the document is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("Document loaded, checking elements:")
  console.log("Join room container:", joinRoomContainer)
  console.log("Create room button:", createRoomBtn)
  console.log("Socket.io loaded:", typeof window.io !== "undefined")
})
