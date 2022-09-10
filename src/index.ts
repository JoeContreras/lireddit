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
import cors from "cors";
import { myDataSource } from "./app-data-source";

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
  /*
  const orm = await MikroORM.init(mikroConfig);
  // await orm.em.fork().nativeDelete(User, {});
  orm.getMigrator().up();
  const generator = orm.getSchemaGenerator();
  await generator.updateSchema();
*/
  const app = express();

  app.set("trust proxy", !__prod__);
  app.set("Access-Control-Allow-Origin", "https://studio.apollographql.com");
  app.set("Access-Control-Allow-Credentials", true);
  !__prod__ && app.set("trust proxy", 1);

  app.use(
    cors({
      origin: ["http://localhost:3000", "https://studio.apollographql.com"],
      credentials: true,
    })
  );
  // redis@v4
  const RedisStore = connectRedis(session);
  const redisClient = new Redis({
    host: "redis-14306.c114.us-east-1-4.ec2.cloud.redislabs.com",
    port: 14306,
    username: "joec",
    password: "Andy1209.",
  });
  /*
  const redisClient = new Redis(
    14306,
    "redis-14306.c114.us-east-1-4.ec2.cloud.redislabs.com",
    {
      username: "joec",
      password: "Andy1209.",
    }
  );
*/
  app.use(
    session({
      saveUninitialized: false,
      store: new RedisStore({ client: redisClient }),
      cookie: {
        maxAge: 1000 * 60 * 24 * 365 * 1, //1 year
        httpOnly: true,
        sameSite: "lax",
        secure: __prod__, //https only when in production
      },
      name: COOKIE_NAME,
      secret: "keyboard cat",
      resave: false,
    })
  );

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }): MyContext => ({
      req,
      res,
      redisClient,
    }),
  });
  await apolloServer.start();

  apolloServer.applyMiddleware({
    app,
    cors: {
      origin: ["http://localhost:3000", "https://studio.apollographql.com"],
      credentials: true,
    },
  });

  app.listen(4000, () => {
    console.log("Server listening on port 4000");
  });
  // const emFork = orm.em.fork();
  // const post = emFork.create(Post, { title: "my first post" });
  // await emFork.persistAndFlush(post);
  // const posts = await emFork.find(Post, {});
  // console.log(posts);
};
main();
