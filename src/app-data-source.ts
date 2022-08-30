import { DataSource } from "typeorm";
import { Post } from "./entities/Post";
import { User } from "./entities/User";

export const myDataSource = new DataSource({
  type: "postgres",
  port: 5432,
  username: "postgres",
  password: "9009",
  database: "lireddit2",
  entities: [Post, User],
  logging: true,
  synchronize: true,
});
