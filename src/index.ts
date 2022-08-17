import { MikroORM } from "@mikro-orm/core";
import mikroConfig from "./mikro-orm.config";

const main = async () => {
  const orm = await MikroORM.init(mikroConfig);
  orm.getMigrator().up();
  const generator = orm.getSchemaGenerator();
  await generator.updateSchema();
  // const emFork = orm.em.fork();
  // const post = emFork.create(Post, { title: "my first post" });
  // await emFork.persistAndFlush(post);
  // const posts = await emFork.find(Post, {});
  // console.log(posts);
};
main();
