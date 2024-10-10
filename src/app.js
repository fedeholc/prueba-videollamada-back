import process from "process";
import { readFileSync } from "fs";
import { createServer as createHTTPSServer } from "https";
import { db } from "./global-store.js";
import path from "path";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

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

/* const httpsOptions = {
  key: readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), "server.key")
  ),
  cert: readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), "server.cert")
  ),
};
const httpsServer = createHTTPSServer(httpsOptions, app); */

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

/* app.listen(process.env.PORT, () =>
  console.log(`Server running on port ${process.env.PORT}`)
); */
/* 
httpsServer.listen(process.env.PORT, () => {
  console.log(`HTTPS server listening on port ${process.env.PORT}`);
});
 */

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
  const httpsServer = createHTTPSServer(httpsOptions, app);

  httpsServer.listen(process.env.PORT || 3000, () => {
    console.log(`HTTPS server listening on port ${process.env.PORT}`);
  });
} else {
  // En producción o si no es 'development': usar HTTP (Express por defecto)
  app.listen(process.env.PORT || 3000, () => {
    console.log(`Server running on port ${process.env.PORT}`);
  });
}
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
