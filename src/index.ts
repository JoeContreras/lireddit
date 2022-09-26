import "reflect-metadata";
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import Redis from "ioredis";
import session from "express-session";
import connectRedis from "connect-redis";
import { __prod__, COOKIE_NAME } from "./constants";
import { MyContext } from "./types";
// import cors from "cors";
import { myDataSource } from "./app-data-source";
import { createUserLoader } from "./utils/createUserLoader";
import { createUpdootLoader } from "./utils/createUpdootLoader";
import "dotenv-safe/config";
import cors from "cors";

const main = async () => {
  // establish database connection
  myDataSource
    .initialize()
    .then(() => {
      console.log("Data Source has been initialized!");
      // conn.runMigrations();
    })
    .catch((err) => {
      console.error("Error during Data Source initialization:", err);
    });

  const app = express();

  app.set("trust proxy", !__prod__);
  app.set("Access-Control-Allow-Origin", "*");
  app.set("Access-Control-Allow-Credentials", true);
  !__prod__ && app.set("trust proxy", 1);

  app.use(
    cors({
      origin: [
        "http://localhost:3000",
        "https://studio.apollographql.com",
        "https://www.jce-projects.com/",
      ],
      credentials: true,
    })
  );
  // redis@v4
  const RedisStore = connectRedis(session);
  const redisClient = new Redis(process.env.REDIS_URL);

  app.use(
    session({
      saveUninitialized: false,
      store: new RedisStore({ client: redisClient }),
      cookie: {
        maxAge: 1000 * 60 * 24 * 365 * 1, //1 year
        httpOnly: true,
        sameSite: __prod__ ? "none" : "lax",
        secure: __prod__, //https only when in production
        domain: __prod__ ? ".jce-projects.com" : undefined,
      },
      name: COOKIE_NAME,
      secret: process.env.SESSION_SECRET as string,
      resave: false,
    })
  );

  if (__prod__) {
    console.log("Running in production mode");
  }

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }): MyContext => ({
      req,
      res,
      redisClient,
      userLoader: createUserLoader(),
      updootLoader: createUpdootLoader(),
    }),
  });
  await apolloServer.start();

  apolloServer.applyMiddleware({
    app,
    cors: {
      origin: [
        "http://localhost:3000",
        "https://studio.apollographql.com",
        "https://www.jce-projects.com",
      ],
      credentials: true,
    },
  });

  app.listen(process.env.PORT, () => {
    console.log("Server listening on port :" + process.env.PORT);
  });
  // const emFork = orm.em.fork();
  // const post = emFork.create(Post, { title: "my first post" });
  // await emFork.persistAndFlush(post);
  // const posts = await emFork.find(Post, {});
  // console.log(posts);
};
main();
