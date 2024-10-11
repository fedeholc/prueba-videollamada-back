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
    methods: ["GET", "POST"],
  },
});

function mapWithSetsToObject(map) {
  const result = {};

  map.forEach((valueSet, key) => {
    result[key] = Array.from(valueSet); // Convertir el Set a un Array
  });

  return result;
}

const rooms = new Map();
const roomsCalls = new Map();

io.on("connection", (socket) => {
  console.log("New client connected", socket.id);

  socket.on("getRooms", () => {
    console.log("Usuario ", socket.id, " pidiendo salas");
    console.log("Salas:", rooms);
    io.emit("updateRooms", mapWithSetsToObject(rooms));
  });

  socket.on("getUsersInRoom", (roomId) => {
    console.log("Usuario ", socket.id, " pidiendo usuarios en la sala", roomId);
    if (rooms.has(roomId)) {
      console.log("Usuarios en la sala", Array.from(rooms.get(roomId)));
      socket.emit("usersInRoom", Array.from(rooms.get(roomId)));
    }
  });

  socket.on("getUsersInCall", (roomId) => {
    console.log(
      "Usuario ",
      socket.id,
      " pidiendo usuarios en la llamada  ",
      roomId
    );
    console.log("Llamadas:", roomsCalls);
    if (roomsCalls.has(roomId)) {
      console.log("Usuarios en la llamada", Array.from(roomsCalls.get(roomId)));
      /* io.to(roomId).emit("usersInCall", Array.from(roomsCalls.get(roomId))); */
    }
  });

  socket.on("joinCall", (roomId, date) => {
    console.log(
      "Usuario ",
      socket.id,
      " conectado a la llamada en ",
      roomId,
      " a las ",
      date
    );

    if (!roomsCalls.has(roomId)) {
      roomsCalls.set(roomId, new Set());
    }
    roomsCalls.get(roomId).add(socket.id);

    io.to(roomId).emit("usersInCall", Array.from(roomsCalls.get(roomId)));
  });

  socket.on("joinRoom", (roomId) => {
    console.log("Usuario ", socket.id, " conectado a la sala", roomId);

    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(socket.id);

    console.log("Salas:", rooms);
    //en caso de querer implementar que cuando estén los dos se inicie la llamada
    /* if (rooms.get(roomId).size === 2) {
      socket.to(roomId).emit("startCall");
    } */

    io.emit("updateRooms", mapWithSetsToObject(rooms));
    io.to(roomId).emit("usersInRoom", Array.from(rooms.get(roomId)));
    if (roomsCalls.has(roomId)) {
      io.to(roomId).emit("usersInCall", Array.from(roomsCalls.get(roomId)));
    }
  });

  socket.on("leaveRoom", (roomId) => {
    if (rooms.has(roomId)) {
      rooms.get(roomId).delete(socket.id);
      if (rooms.get(roomId).size === 0) {
        rooms.delete(roomId);
      }
    }
    if (roomsCalls.has(roomId)) {
      roomsCalls.get(roomId).delete(socket.id);
      if (roomsCalls.get(roomId).size === 0) {
        roomsCalls.delete(roomId);
      }
    }
    if (roomsCalls.has(roomId)) {
      io.to(roomId).emit("usersInCall", Array.from(roomsCalls.get(roomId)));
    } else {
      io.to(roomId).emit("usersInCall", []);
    }

    io.emit("updateRooms", mapWithSetsToObject(rooms));
    socket.leave(roomId);
  });

  socket.on("disconnect", () => {
    console.log("Usuario desconectado", socket.id);

    rooms.forEach((clients, roomId) => {
      if (clients.has(socket.id)) {
        clients.delete(socket.id);
        if (clients.size === 0) {
          rooms.delete(roomId);
        } else {
          //por si me sirviera avisar que se desconectó
          //socket.to(roomId).emit("userDisconnected");
        }
      }
    });

    roomsCalls.forEach((clients, roomId) => {
      if (clients.has(socket.id)) {
        clients.delete(socket.id);
        if (clients.size === 0) {
          roomsCalls.delete(roomId);
        }
      }
    });

    io.emit("updateRooms", mapWithSetsToObject(rooms));
  });
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
