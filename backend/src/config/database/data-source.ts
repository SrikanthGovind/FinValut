import dotenv from "dotenv";
import { DataSource } from "typeorm";

dotenv.config();

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5000"),
  username: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_NAME || "FinVault",
  synchronize: true,
  logging: false,
  entities: [__dirname + "/../../modules/**/entities/*.entity.{ts,js}"],
});
