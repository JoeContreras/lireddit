import { MikroORM } from "@mikro-orm/core";
import express from "express";
import mikroConfig from "./mikro-orm.config";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";

const main = async () => {
  const orm = await MikroORM.init(mikroConfig);
  orm.getMigrator().up();
  const generator = orm.getSchemaGenerator();
  await generator.updateSchema();
  const app = express();

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver],
      validate: false,
    }),
    context: () => ({ em: orm.em.fork() }),
  });
  await apolloServer.start();

  apolloServer.applyMiddleware({ app });

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
