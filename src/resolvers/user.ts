import { MyContext } from "src/types";
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from "type-graphql";
import { User } from "../entities/User";
import argon2 from "argon2";
import { EntityManager } from "@mikro-orm/postgresql";

@InputType()
class UsernamePasswordInput {
  @Field()
  username: string;

  @Field()
  password: string;
}

@ObjectType()
class FieldError {
  @Field()
  field: string;

  @Field()
  message: string;
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => User, { nullable: true })
  user?: User;
}

@Resolver()
export class UserResolver {
  @Query(() => User, { nullable: true })
  async me(@Ctx() { req, em }: MyContext) {
    //  You are not logged in
    if (!req.session.userId) {
      return null;
    }
    const user = await em.findOne(User, { id: req.session.userId });
    return user;
  }
  @Mutation(() => UserResponse)
  async register(
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    if (options.username.length <= 2) {
      return {
        errors: [
          {
            field: "username",
            message: "username must contain at least 3 characters",
          },
        ],
      };
    }
    if (options.password.length <= 6) {
      return {
        errors: [
          {
            field: "password",
            message: "password must contain at least 6 characters",
          },
        ],
      };
    }
    const hashedPassword = await argon2.hash(options.password);
    /*
    const user = em.create(User, {
      username: options.username,
      password: hashedPassword,
    });
*/
    let user;
    try {
      const result = await (em as EntityManager)
        .createQueryBuilder(User)
        .getKnexQuery()
        .insert({
          username: options.username,
          password: hashedPassword,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning("*");
      user = result[0];
      // await em.persistAndFlush(user);
    } catch (e) {
      // duplicate username error
      if (e.detail.includes("already exists")) {
        return {
          errors: [
            {
              field: "username",
              message: "username already exists",
            },
          ],
        };
      }
    }

    //Store userId session
    //this will set a cookie on the user to keep the logged in
    req.session.userId = user.id;
    /*
     * {userId: 1} -> send that to redis
     * * *
     * redis is a key value store*
     * on redis it will look like this*
     * keyName: sess:qweokdfsdfscvih  value:{cookie:..., userId:1}
     *
     * * *
     *express-session will set a cookie on my browser that will look like:
     * qwsldfhsouadfnbousdnfasojdnfodsfasdf* like a signed(encrypted) version of the key
     * *
     * when user makes a request
     * qwsldfhsouadfnbousdnfasojdnfodsfasdf *  gets sent to the server (bc it contains our user info)
     *
     * * *
     * on the server it will unsign (decrypt) it
     * turn this: qwsldfhsouadfnbousdnfasojdnfodsfasdf -> into this sess:qweokdfsdfscvih
     *
     * * *
     * server will make a request to redis to look up that key:*
     * sess:qweokdfsdfscvih*
     *
     * * *
     * obtain value for that key*
     * value:{cookie:..., userId:1}
     * now the browser knows who I am! (userId)
     * * * * * */
    return { user };
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const user = await em.findOne(User, { username: options.username });
    if (!user) {
      return {
        errors: [
          {
            field: "username",
            message: "Username does not exist",
          },
        ],
      };
    }
    const valid = await argon2.verify(user.password, options.password);
    if (!valid) {
      return {
        errors: [
          {
            field: "password",
            message: "password is incorrect",
          },
        ],
      };
    }

    req.session.userId = user.id;
    return {
      user,
    };
  }
}
