import { MikroORM } from "@mikro-orm/core";
import express from "express";
import mikroConfig from "./mikro-orm.config";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import { createClient } from "redis";
import session from "express-session";
import connectRedis from "connect-redis";
import { __prod__ } from "./constants";
import { MyContext } from "./types";

const main = async () => {
  const orm = await MikroORM.init(mikroConfig);
  orm.getMigrator().up();
  const generator = orm.getSchemaGenerator();
  await generator.updateSchema();
  const app = express();

  app.set("trust proxy", !__prod__);
  app.set("Access-Control-Allow-Origin", "https://studio.apollographql.com");
  app.set("Access-Control-Allow-Credentials", true);
  !__prod__ && app.set("trust proxy", 1);

  // redis@v4
  const RedisStore = connectRedis(session);
  const redisClient = createClient({
    socket: {
      host: "redis-14306.c114.us-east-1-4.ec2.cloud.redislabs.com",
      port: 14306,
    },
    username: "joec",
    password: "Andy1209.",
    legacyMode: true,
  });
  redisClient.connect().catch(console.error);
  app.use(
    session({
      saveUninitialized: false,
      store: new RedisStore({ client: redisClient }),
      cookie: {
        maxAge: 1000 * 60 * 24 * 365 * 1, //1 year
        httpOnly: true,
        sameSite: "none",
        secure: true, //https only when in production
      },
      name: "qid",
      secret: "keyboard cat",
      resave: false,
    })
  );

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }): MyContext => ({ em: orm.em.fork(), req, res }),
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
