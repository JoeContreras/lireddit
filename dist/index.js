"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@mikro-orm/core");
const express_1 = __importDefault(require("express"));
const mikro_orm_config_1 = __importDefault(require("./mikro-orm.config"));
const apollo_server_express_1 = require("apollo-server-express");
const type_graphql_1 = require("type-graphql");
const hello_1 = require("./resolvers/hello");
const post_1 = require("./resolvers/post");
const user_1 = require("./resolvers/user");
const ioredis_1 = __importDefault(require("ioredis"));
const express_session_1 = __importDefault(require("express-session"));
const connect_redis_1 = __importDefault(require("connect-redis"));
const constants_1 = require("./constants");
const cors_1 = __importDefault(require("cors"));
const main = async () => {
    const orm = await core_1.MikroORM.init(mikro_orm_config_1.default);
    orm.getMigrator().up();
    const generator = orm.getSchemaGenerator();
    await generator.updateSchema();
    const app = (0, express_1.default)();
    app.set("trust proxy", !constants_1.__prod__);
    app.set("Access-Control-Allow-Origin", "https://studio.apollographql.com");
    app.set("Access-Control-Allow-Credentials", true);
    !constants_1.__prod__ && app.set("trust proxy", 1);
    app.use((0, cors_1.default)({
        origin: ["http://localhost:3000", "https://studio.apollographql.com"],
        credentials: true,
    }));
    const RedisStore = (0, connect_redis_1.default)(express_session_1.default);
    const redisClient = new ioredis_1.default({
        host: "redis-14306.c114.us-east-1-4.ec2.cloud.redislabs.com",
        port: 14306,
        username: "joec",
        password: "Andy1209.",
    });
    app.use((0, express_session_1.default)({
        saveUninitialized: false,
        store: new RedisStore({ client: redisClient }),
        cookie: {
            maxAge: 1000 * 60 * 24 * 365 * 1,
            httpOnly: true,
            sameSite: "lax",
            secure: constants_1.__prod__,
        },
        name: constants_1.COOKIE_NAME,
        secret: "keyboard cat",
        resave: false,
    }));
    const apolloServer = new apollo_server_express_1.ApolloServer({
        schema: await (0, type_graphql_1.buildSchema)({
            resolvers: [hello_1.HelloResolver, post_1.PostResolver, user_1.UserResolver],
            validate: false,
        }),
        context: ({ req, res }) => ({
            em: orm.em.fork(),
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
};
main();
//# sourceMappingURL=index.js.map