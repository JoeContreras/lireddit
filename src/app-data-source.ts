import { DataSource } from "typeorm";
import { Post } from "./entities/Post";
import { User } from "./entities/User";
import { Updoot } from "./entities/Updoot";
import path from "path";

export const myDataSource = new DataSource({
  type: "postgres",
  port: 5432,
  username: "postgres",
  password: "9009",
  database: "lireddit2",
  entities: [Post, User, Updoot],
  logging: true,
  synchronize: true,
  migrations: [path.join(__dirname, "./migrations/*")],
});
