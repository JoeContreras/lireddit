import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { Post } from "../entities/Post";
import { MyContext } from "../types";
import { isAuth } from "../middleware/isAuth";
import { myDataSource } from "../app-data-source";
import { Updoot } from "../entities/Updoot";

@InputType()
class PostInput {
  @Field()
  title: string;

  @Field()
  text: string;
}

@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
  posts: Post[];

  @Field()
  hasMore: boolean;
}

@Resolver(Post)
export class PostResolver {
  @FieldResolver(() => String)
  textSnippet(@Root() root: Post) {
    return root.text.slice(0, 50);
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async vote(
    @Arg("postId", () => Int) postId: number,
    @Arg("value", () => Int) value: number,
    @Ctx() { req }: MyContext
  ) {
    const isUpdoot = value !== -1;
    const valueToUse = isUpdoot ? 1 : -1;
    const { userId } = req.session;
    const updoot = await Updoot.findOneBy({ postId, userId });
    //Do it with transaction so if one fails, the other one will not be executed

    // the user has voted on the post before
    // and they are changing their vote
    if (updoot && updoot.value !== valueToUse) {
      await myDataSource.transaction(async (tm) => {
        await tm.query(
          `
                    UPDATE updoot
                    SET value = $1
                    WHERE "postId" = $2 AND "userId" = $3
                    `,
          [valueToUse, postId, userId]
        );
        await tm.query(
          `
                    UPDATE post
                    SET points = points + $1
                    WHERE id = $2
                    `,
          [2 * valueToUse, postId]
        );
      });
    } else if (!updoot) {
      // never voted before
      await myDataSource.transaction(async (tm) => {
        await tm.query(
          `
                    INSERT INTO updoot ("userId", "postId", value)
                    VALUES ($1, $2, $3)
                `,
          [userId, postId, valueToUse]
        );

        await tm.query(
          `
                    UPDATE post
                    SET points = points + $1
                    WHERE id = $2
                `,
          [valueToUse, postId]
        );
      });
    }

    return true;
  }
  @Query(() => PaginatedPosts)
  async posts(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null,
    @Ctx() { req }: MyContext
  ): Promise<PaginatedPosts> {
    const realLimit = Math.min(50, limit);
    const realLimitPlusOne = Math.min(50, limit) + 1;
    const replacements: any[] = [realLimitPlusOne];

    if (req.session.userId) {
      replacements.push(req.session.userId);
    }

    let cursorIndex = 3;
    if (cursor) {
      replacements.push(new Date(parseInt(cursor)));
      cursorIndex = replacements.length;
    }

    const posts = await myDataSource.query(
      `
    select p.* ,
    jsonb_build_object('id', u.id, 'username', u.username, 'email', u.email, 'createdAt', u."createdAt", 'updatedAt', u."updatedAt") creator,
    ${
      req.session.userId
        ? '(SELECT value FROM updoot WHERE "userId" = $2 AND "postId" = p.id) "voteStatus"'
        : 'null as "voteStatus"'
    }
     from post p
    inner join public.user u on u.id = p."creatorId"
    ${cursor ? `where p."createdAt" < $${cursorIndex}` : ""}
    order by p."createdAt" DESC
    limit $1
    `,
      replacements
    );
    /*
    const qb = await myDataSource
      .getRepository(Post)
      .createQueryBuilder("p")
        .innerJoinAndSelect("p.creator", "u", 'u.id = p."creatorId"')
      .orderBy('p."createdAt"', "DESC")
      .take(realLimitPlusOne);
    if (cursor) {
      qb.where('p."createdAt" < :cursor', { cursor: new Date(parseInt(cursor)) });
    }
    const posts = await qb.getMany();
*/

    return {
      posts: posts.slice(0, realLimit),
      hasMore: posts.length === realLimitPlusOne,
    };
  }

  @Query(() => Post, { nullable: true })
  post(@Arg("id", () => Int) id: number): Promise<Post | null> {
    return Post.findOne({ where: { id }, relations: ["creator"] });
  }

  @Mutation(() => Post)
  @UseMiddleware(isAuth)
  async createPost(
    @Arg("input") input: PostInput,
    @Ctx() { req }: MyContext
  ): Promise<Post> {
    return Post.create({ ...input, creatorId: req.session.userId }).save();
  }

  @Mutation(() => Post, { nullable: true })
  @UseMiddleware(isAuth)
  async updatePost(
    @Arg("id", () => Int) id: number,
    @Arg("title") title: string,
    @Arg("text") text: string,
    @Ctx() { req }: MyContext
  ): Promise<Post | null> {
    const result = await myDataSource
      .createQueryBuilder()
      .update(Post)
      .set({ title, text })
      .where('id = :id and "creatorId" = :creatorId', {
        id,
        creatorId: req.session.userId,
      })
      .returning("*")
      .execute();

    return result.raw[0];
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async deletePost(
    @Arg("id", () => Int) id: number,
    @Ctx() { req }: MyContext
  ): Promise<boolean> {
    try {
      await Post.delete({ id: id, creatorId: req.session.userId });
      return true;
    } catch (e) {
      console.log(e);
      return false;
    }
  }
}
