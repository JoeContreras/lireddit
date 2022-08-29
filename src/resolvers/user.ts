import { MyContext } from "src/types";
import {
  Arg,
  Ctx,
  Field,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from "type-graphql";
import { User } from "../entities/User";
import argon2 from "argon2";
import { EntityManager } from "@mikro-orm/postgresql";
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from "../constants";
import { UsernamePasswordInput } from "./UsernamePasswordInput";
import { validateRegister } from "../utils/validations";
import { sendEmail } from "../utils/sendEmail";
import { v4 } from "uuid";

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
  @Mutation(() => UserResponse)
  async changePassword(
    @Arg("token") token: string,
    @Arg("newPassword") newPassword: string,
    @Ctx() { redisClient, em, req }: MyContext
  ): Promise<UserResponse> {
    if (newPassword.length <= 6) {
      return {
        errors: [
          {
            field: "newPassword",
            message: "Password must contain at least 6 characters",
          },
        ],
      };
    }
    const userId = await redisClient.get(FORGET_PASSWORD_PREFIX + token);
    if (!userId) {
      return {
        errors: [
          {
            field: "token",
            message: "token expired or invalid",
          },
        ],
      };
    }
    //    parseInt because redis stores it as string
    const user = await em.findOne(User, { id: parseInt(userId) });
    if (!user) {
      return {
        errors: [
          {
            field: "token",
            message: "user no longer exists",
          },
        ],
      };
    }
    const key = FORGET_PASSWORD_PREFIX + token;
    user.password = await argon2.hash(newPassword);
    await em.flush();
    await redisClient.del(key);
    //Login user after password change
    req.session.userId = user.id;
    return { user };
  }
  @Mutation(() => Boolean)
  async forgotPassword(
    @Arg("email") email: string,
    @Ctx() { em, redisClient }: MyContext
  ) {
    const user = await em.findOne(User, { email });
    if (!user) {
      return true;
    }
    const token = v4();
    await redisClient.set(
      FORGET_PASSWORD_PREFIX + token,
      user.id,
      "EX",
      1000 * 60 * 60 * 24 * 3 //3 days
    );
    const link = `<a href="http://localhost:3000/change-password/${token}">reset password</a>`;
    await sendEmail(email, link);
    return true;
  }
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
    const errors = validateRegister(options);
    if (errors) {
      return { errors };
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
          email: options.email,
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
              message: "Username already exists",
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
    @Arg("usernameOrEmail") usernameOrEmail: string,
    @Arg("password") password: string,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const user = await em.findOne(
      User,
      usernameOrEmail.includes("@")
        ? { email: usernameOrEmail }
        : { username: usernameOrEmail }
    );
    if (!user) {
      return {
        errors: [
          {
            field: "usernameOrEmail",
            message: "Username or email does not exist",
          },
        ],
      };
    }
    const valid = await argon2.verify(user.password, password);
    if (!valid) {
      return {
        errors: [
          {
            field: "password",
            message: "Password is incorrect",
          },
        ],
      };
    }

    req.session.userId = user.id;
    return {
      user,
    };
  }
  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyContext) {
    return new Promise((resolve) =>
      req.session.destroy((err) => {
        if (err) {
          console.log(err);
          resolve(false);
          return;
        }
        resolve(true);
        res.clearCookie(COOKIE_NAME);
      })
    );
  }
}
