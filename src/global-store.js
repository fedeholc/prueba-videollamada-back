import { dbTurso } from "./db-adapter.js";
import process from "process";
import dotenv from "dotenv";

dotenv.config();
export const db = new dbTurso(
  process.env.TURSO_DATABASE_URL,
  process.env.TURSO_AUTH_TOKEN
);
