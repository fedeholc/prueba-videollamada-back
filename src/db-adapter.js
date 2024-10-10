import { createClient } from "@libsql/client/web";
import dotenv from "dotenv";

dotenv.config();
export class dbTurso {
  /**
   * @param {string} dbURI
   * @param {string} authToken
   */
  constructor(dbURI, authToken) {
    this.db = null;
    this.dbURI = dbURI;
    this.authToken = authToken;
    this.init();
  }

  /**
   * Initialize the database
   */
  init() {
    this.db = this.#getDbInstance(this.dbURI, this.authToken);
    console.log("DBx turso", this.db, this.dbURI);
  }

  /**
   * Get the database instance
   * @param {string} dbURI - Database URI
   * @param {string} authToken - Auth token
   * @returns {import('@libsql/client').Client} - Database instance
   */
  #getDbInstance(dbURI, authToken) {
    if (this.db) {
      return this.db; // Retorna la instancia existente si ya está creada
    }
    let tursoDb = createClient({ url: dbURI, authToken: authToken });
    return tursoDb;
  }

  /**
   *
   * @param {string} user
   * @param {string} roomId
   * @param {string} date
   * @returns {Promise<number>} - User ID
   */
  async insertRoom(user, roomId, date) {
    try {
      this.init();

      const result = await this.db.execute({
        sql: "INSERT INTO sala (user, roomId, date) VALUES (?,?,?)",
        args: [user, roomId, date],
      });
      return Number(result.lastInsertRowid);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getRooms() {
    try {
      this.init();

      const result = await this.db.execute({
        sql: "SELECT * FROM sala",
        args: [],
      });
      return result.rows;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  closeDbConnection() {
    try {
      if (!this.db) {
        return true;
      }
      this.db.close();
      console.log("Database connection closed");
      return true;
    } catch (error) {
      console.error("Error closing the database:", error.message);
      return error;
    }
  }

  async createTables() {
    try {
      console.log("this.db turso", this.db);
      this.db.execute({
        sql: `CREATE TABLE IF NOT EXISTS sala (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user TEXT NOT NULL,
            roomId TEXT NOT NULL,
            date TEXT NOT NULL
          )`,
        args: [],
      });
    } catch (error) {
      console.error("Error creating tables", error);
      throw error;
    }
  }
}
