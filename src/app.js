import process from "process";
import { readFileSync } from "fs";
import { createServer as createHTTPSServer } from "https";
import { db } from "./global-store.js";
import path from "path";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { Server } from "socket.io";
import { createServer } from "http";
dotenv.config();

checkEnvVariables();
const ALLOWED_ORIGINS = [
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://127.0.0.1:8080",
  "http://localhost:8080",
  "http://127.0.0.1:5174",
  "http://localhost:5174",
  "https://192.168.0.59:5174",
];

db.createTables();

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
        return callback(null, true);
      } else {
        return callback(null, true); //por ahora permitir todo
        /*return callback(new Error("Not allowed by CORS"));*/
      }
    },
    credentials: true,
  })
);

app.post("/insert-room", async (req, res) => {
  try {
    const { user, roomId, date } = req.body;
    console.log(req.body);
    const result = await db.insertRoom(user, roomId, date);
    console.log("result", result);
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json("Internal Server Error");
  }
});

app.get("/get-rooms", async (req, res) => {
  try {
    const result = await db.getRooms();
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json("Internal Server Error");
  }
});

app.get("*", (req, res) => {
  res.status(404).send("¡Hola! 404 Page not found");
});

let server;

// Verificar si estamos en desarrollo o producción
if (process.env.NODE_ENV === "development") {
  // Solo en desarrollo: usar HTTPS
  const httpsOptions = {
    key: readFileSync(
      path.join(path.dirname(new URL(import.meta.url).pathname), "server.key")
    ),
    cert: readFileSync(
      path.join(path.dirname(new URL(import.meta.url).pathname), "server.cert")
    ),
  };
  server = createHTTPSServer(httpsOptions, app);
} else {
  server = createServer(app);
}

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const rooms = new Map();
let salas = {};

io.on("connection", (socket) => {
  console.log("New client connected", socket.id);

  socket.on("joinRoom", (salaId) => {
    console.log("Usuario conectado", socket.id, "a la sala", salaId);
    socket.join(salaId);

    // Actualizar la lista de usuarios en la sala
    if (!salas[salaId]) {
      salas[salaId] = [];
    }
    salas[salaId].push(socket.id);

    // Notificar a todos los clientes la actualización de la sala
    io.emit("updateSalas", salas);
  });

  socket.on("leaveRoom", (salaId) => {
    socket.leave(salaId);
    if (salas[salaId]) {
      salas[salaId] = salas[salaId].filter((id) => id !== socket.id);
      if (salas[salaId].length === 0) {
        delete salas[salaId]; // Eliminar la sala si está vacía
      }
    }
    io.emit("updateSalas", salas); // Notificar el cambio
  });

  socket.on("disconnect", () => {
    console.log("Usuario desconectado", socket.id);
    // Limpiar las salas en las que estaba
    for (let salaId in salas) {
      salas[salaId] = salas[salaId].filter((id) => id !== socket.id);
      if (salas[salaId].length === 0) {
        delete salas[salaId];
      }
    }
    io.emit("updateSalas", salas);
  });

  /* 
  socket.on("join", (roomId) => {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(socket.id);
    socket.join(roomId);
    socket.emit("room_joined", roomId);

    if (rooms.get(roomId).size === 2) {
      socket.to(roomId).emit("start_call");
    }
  });

  socket.on("offer", (offer, roomId) => {
    socket.to(roomId).emit("offer", offer);
  });

  socket.on("answer", (answer, roomId) => {
    socket.to(roomId).emit("answer", answer);
  });

  socket.on("ice-candidate", (candidate, roomId) => {
    socket.to(roomId).emit("ice-candidate", candidate);
  });

  socket.on("disconnect", () => {
    rooms.forEach((clients, roomId) => {
      if (clients.has(socket.id)) {
        clients.delete(socket.id);
        if (clients.size === 0) {
          rooms.delete(roomId);
        } else {
          socket.to(roomId).emit("user_disconnected");
        }
      }
    });
    console.log("Client disconnected");
  }); */
});

server.listen(process.env.PORT || 3000, () =>
  console.log(`Server is running on port ${process.env.PORT || 3000}`)
);

function checkEnvVariables() {
  const requiredEnvVars = [
    "NODE_ENV",
    "PORT",
    "TURSO_DATABASE_URL",
    "TURSO_AUTH_TOKEN",
  ];

  const missingEnvVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );

  if (missingEnvVars.length > 0) {
    throw new Error(
      `Faltan las siguientes variables de entorno: ${missingEnvVars.join(", ")}`
    );
  }
}
