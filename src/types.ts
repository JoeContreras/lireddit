import { Request, Response } from "express";
import { Session } from "express-session";
import Redis from "ioredis";
import { createUserLoader } from "./utils/createUserLoader";
import { createUpdootLoader } from "./utils/createUpdootLoader";

export type MyContext = {
  req: Request & { session: Session };
  res: Response;
  redisClient: Redis;
  userLoader: ReturnType<typeof createUserLoader>;
  updootLoader: ReturnType<typeof createUpdootLoader>;
};
