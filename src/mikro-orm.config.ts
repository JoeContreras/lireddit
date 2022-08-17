import { Post } from "./entities/Post";
import { __prod__ } from "./constants";
import { MikroORM } from "@mikro-orm/core";
import * as path from "path";

const mikroconfig = {
  migrations: {
    path: path.join(__dirname, "./migrations"),
  },
  entities: [Post],
  dbName: "lireddit",
  type: "postgresql",
  debug: !__prod__,
  password: "9009",
} as Parameters<typeof MikroORM.init>[0];
export default mikroconfig;
