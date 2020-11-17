import "reflect-metadata";
import { Context } from "koa";
import path from "path";
import { Container } from "typedi";
import * as TypeORM from "typeorm";
import { buildSchema } from "type-graphql";
import { ApolloServer } from "apollo-server-koa";

// TypeGraphQL
import { JOB } from "../graphql/User";
import UserResolver from "../resolver/User.resolver";
import RecipeResolver from "../resolver/Recipe.resolver";
import TaskResolver from "../resolver/Task.resolver";
import PubSubResolver from "../resolver/PubSub.resolver";

// TypeORM
import User from "../entity/User";
import Task from "../entity/Task";

import { log } from "./helper";
import { authChecker } from "./authChecker";
import { ACCOUNT_AUTH } from "./constants";

// Middlewares applied on TypeGraphQL
import ResolveTime from "../middleware/time";
import InterceptorOnUID1 from "../middleware/interceptor";

TypeORM.useContainer(Container);

export default async (): Promise<ApolloServer> => {
  const schema = await buildSchema({
    resolvers: [UserResolver, RecipeResolver, TaskResolver, PubSubResolver],
    container: Container,
    // TypeGraphQL built-in Scalar Date
    dateScalarMode: "timestamp",
    authChecker,
    authMode: "error",
    emitSchemaFile: path.resolve(__dirname, "../typegraphql/shema.gql"),
    validate: true,
    globalMiddlewares: [ResolveTime, InterceptorOnUID1],
  });

  await dbConnect();

  const server = new ApolloServer({
    // options schema will override typeDefs & resolvers
    // so donot use typegraphql and apollo-server to merge schema
    schema,
    subscriptions: {
      path: "/pubsub",
    },
    context: async (ctx: Context) => {
      // 随机鉴权
      const randomID = Math.floor(Math.random() * 100);
      // 0-30 unlogin
      // 31-60 common
      // 61-100 admin

      const UN_LOGIN = randomID >= 0 && randomID <= 30;
      const COMMON = randomID >= 31 && randomID <= 60;
      const ADMIN = randomID >= 61 && randomID <= 100;

      const ACCOUNT_TYPE = UN_LOGIN
        ? ACCOUNT_AUTH.UN_LOGIN
        : COMMON
        ? ACCOUNT_AUTH.COMMON
        : ACCOUNT_AUTH.ADMIN;

      const context = {
        // req,
        env: process.env.NODE_ENV,
        // token: ctx.headers.authorization,
        currentUser: {
          uid: randomID,
          roles: ACCOUNT_TYPE,
        },
      };
      return context;
    },
    // 关于RootValue和Context：https://stackoverflow.com/questions/44344560/context-vs-rootvalue-in-apollo-graphql
    // 简单的说，RootValue就像是一个自定义的类型（和其他类型一样），但它只拥有一个动态解析的字段
    // RootValue是解析链的初始值 也就是入口Resolver的parent参数
    rootValue: (documentAST) => {
      // const op = getOperationAST(documentNode);
      // return op === "mutation" ? mutationRoot : queryRoot;
    },
    introspection: true,
    // tracing: true,
    // engine: true,
    // formatError: () => {},
    // formatResponse: () => {},
    playground: {
      settings: {
        "editor.theme": "dark",
        "editor.fontSize": 16,
        "tracing.hideTracingResponse": false,
        "queryPlan.hideQueryPlanResponse": false,
        "editor.fontFamily": `'Fira Code', 'Source Code Pro', 'Consolas'`,
      },
    },
  });

  return server;
};

export const dbConnect = async (): Promise<any> => {
  log("=== [TypeORM] TypeORM Connecting ===");
  try {
    const connection = await TypeORM.createConnection();

    const task1 = new Task();
    task1.taskTitle = "task1";
    task1.taskContent = "task1";
    task1.taskReward = 1000;
    task1.taskRate = 1;

    await connection.manager.save(task1);

    const task2 = new Task();
    task2.taskTitle = "task2";
    task2.taskContent = "task2";
    task2.taskReward = 1000;
    task2.taskRate = 1;

    await connection.manager.save(task2);

    const task3 = new Task();
    task3.taskTitle = "task3";
    task3.taskContent = "task3";
    task3.taskReward = 1000;
    task3.taskRate = 1;

    await connection.manager.save(task3);

    const user = new User();
    user.name = "林不渡-Lv1";
    user.job = JOB.FE;

    user.tasks = [task1, task2];

    await connection.manager.save(user);

    log("=== [TypeORM] Database Connection Established ===");
    await connection.manager.insert(User, {
      name: "林不渡1",
      age: 21,
      isFool: true,
    });
    await connection.manager.insert(User, {
      name: "林不渡2",
      age: 21,
      isFool: true,
    });
    await connection.manager.insert(User, {
      name: "林不渡3",
      age: 21,
      isFool: true,
    });
    log("=== [TypeORM] Initial Mock Data Inserted ===\n");
  } catch (error) {
    log(error, "red");
  }
};
