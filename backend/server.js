require("dotenv").config(); // Load environment variables
const express = require("express"); // Import Express.js
const session = require("express-session"); // Import Express Session
const crypto = require("crypto"); // Import Crypto.js
const { Server } = require("socket.io"); // Using the Server class from the socket.io module for realtime update
const cors = require("cors"); // Import CORS middleware
const https = require("https"); // Import HTTPS module
const http = require("http"); // Import HTTP module
const mongoConnect = require("./db/mongodb"); // Import MongoDB connection

// Initialize app
const app = express();
const PORT = process.env.PORT || 5000;

// Generate a secure secret for session signing
const sessionSecret = crypto.randomBytes(64).toString("hex");

// Middleware for sessions
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 6, // 6 hour expiration
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    },
  })
);

const AuthenticationRoutes = require("./routes/auth"); // Import authentication routes
const RoomUpdaterRoutes = require("./routes/roomUpdater");
const RealTimeRoutes = require("./routes/realTime");
const VerificationRoutes = require("./routes/verify");

// Middleware
app.use(cors());
app.use(express.json());

app.use("/", AuthenticationRoutes);
app.use("/", RoomUpdaterRoutes);
app.use("/", RealTimeRoutes);
app.use("/", VerificationRoutes);

// Fetch public IP
https.get("https://api.ipify.org", (res) => {
  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    console.log("Your public IP address is: " + data);
  });
}).on("error", (e) => {
  console.log("Error: " + e.message);
});

// MongoDB connection
mongoConnect();

// Server test route
app.get('/', (req, res) => {
  res.send('TechFest Admin Panel API is running...');
});

// Create HTTP server using Express
const server = http.createServer(app);

// Create Socket.io server
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === "production" ? "https://your-production-domain.com" : "http://localhost:3000", // Allow localhost:3000 in development,
    methods: ["GET", "POST"]
  }
});

// Socket.io connection handling
io.on("connection", (socket) => {
  // Initialize user data
  let userName = "Unknown User"; // Default value

  // Listen for the 'user-connected' event to get the user's name
  socket.on("user-connected", (data) => {
    userName = data.name || "Unknown User";
    console.log(`User "${userName}" connected (ID: ${socket.id})`);
  });

  // Get client connection details
  const clientIp = socket.handshake.address;
  const userAgent = socket.handshake.headers['user-agent'];
  const timestamp = new Date().toISOString();
  console.log(`\nNew Socket.io connection (ID: ${socket.id})`);
  console.log(`Client IP: ${clientIp}`);
  console.log(`User-Agent: ${userAgent}`);
  console.log(`Connection Timestamp: ${timestamp}`);

  // Send welcome message to client
  socket.emit("message", { message: "Welcome to the Socket.io server!" });

  // Listen for incoming messages
  socket.on("message", (data) => {
    console.log("Received message:", data);

    // Echo back to client
    socket.emit("message", { message: `Server received: ${JSON.stringify(data)}` });
  });

  RoomUpdaterRoutes(io);

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`\nUser "${userName}" disconnected (ID: ${socket.id})`);
  });

  // Handle errors
  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`
  ____              _     _     _                                ____            _             _      ____                           
 / ___|  __ ___   _(_)___| |__ | | ____ _  __ _ _ __ __ _       / ___|___  _ __ | |_ _ __ ___ | |    / ___|  ___ _ ____   _____ _ __ 
 \\___ \\ / _\` \\ \\ / / / __| '_ \\| |/ / _\` |/ _\` | '__/ _\` |_____| |   / _ \\| '_ \\| __| '__/ _ \\| |____\\___ \\ / _ \\ '__\\ \\ / / _ \\ '__|
  ___) | (_| |\\ V /| \\__ \\ | | |   < (_| | (_| | | | (_| |_____| |__| (_) | | | | |_| | | (_) | |_____|__) |  __/ |   \\ V /  __/ |   
 |____/ \\__,_| \\_/ |_|___/_| |_|_|\\_\\__,_|\\__,_|_|  \\__,_|      \\____\\___/|_| |_|\\__|_|  \\___/|_|    |____/ \\___|_|    \\_/ \\___|_|   
                                                                                                                                     `);
  console.log("\nWelcome to Savishkaara-Control-Server\n");
  console.log(`Date:        `, new Date().toLocaleDateString());
  console.log(`Time:        `, new Date().toLocaleTimeString());
  console.log(`TimeStamp:   `, new Date(), `\n`);
  console.log(`HTTP server running on port ${PORT}`);
  console.log(`Socket.io server initialized`);
});