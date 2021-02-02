import "reflect-metadata";
import "apollo-cache-control";

import path from "path";

import { Context } from "koa";
import { getOperationAST, DocumentNode } from "graphql";
import { Container } from "typedi";
import * as TypeORM from "typeorm";
import { buildSchemaSync, ResolverData } from "type-graphql";
import { ApolloServer } from "apollo-server-koa";

import { GraphQLRequestContext } from "apollo-server-plugin-base";
import { ApolloServerLoaderPlugin } from "type-graphql-dataloader";

// TODO: generate resolver groups by fs mod
import ExecutorResolver from "./resolvers/Executor.resolver";
import RecipeResolver from "./resolvers/Recipe.resolver";
import TaskResolver from "./resolvers/Task.resolver";
import PubSubResolver from "./resolvers/PubSub.resolver";
import AccountResolver from "./resolvers/Account.resolver";
import SubstanceResolver from "./resolvers/Substance.resolver";
import PublicResolver from "./resolvers/Public.resolver";
import RecordResolver from "./resolvers/Record.resolver";

// Prisma Integration
import PrismaResolver from "./resolvers/prisma/index.resolver";

import { log } from "./utils/helper";
import { genarateRandomID } from "./utils/auth";
import { authChecker } from "./utils/authChecker";
import { PLAY_GROUND_SETTINGS } from "./utils/constants";
import { setRecipeInContainer, insertInitMockData } from "./utils/mock";
import { dbConnect } from "./utils/connect";

// Middlewares applied on TypeGraphQL
import ResolveTime from "./middlewares/time";
import { InterceptorOnSCP1128 } from "./middlewares/interceptor";
import LogAccessMiddleware from "./middlewares/log";
import ErrorLoggerMiddleware from "./middlewares/error";

// Extensions powered by TypeGraphQL
import { ExtensionsMetadataRetriever } from "./extensions/getMetadata";
// Extension pn Apollo(GraphQL-Extensions Package)
import { CustomExtension } from "./extensions/apollo";

// Apollo Data Source
import SpaceXDataSource from "./datasource/SpaceX";

import { IContext } from "./typing";

import { GraphQLResponse } from "graphql-extensions";

// Apollo Server Plugin
import complexityPlugin from "./plugins/complexity";
import extensionPlugin from "./plugins/extension";
import { schemaPlugin, usagePlugin } from "./plugins/report";
import scopedContainerPlugin from "./plugins/scopedContainer";
import responseCachePlugin from "apollo-server-plugin-response-cache";

import { validateToken } from "./utils/jwt";

import { PrismaClient } from "./prisma/client";

const prisma = new PrismaClient();

Container.set({ id: "INIT_INJECT_DATA", factory: () => new Date() });

TypeORM.useContainer(Container);

const dev = process.env.NODE_ENV === "development";

export default async (): Promise<ApolloServer> => {
  const basicMiddlewares = [
    ResolveTime,
    // InterceptorOnSCP1128,
    ExtensionsMetadataRetriever,
    LogAccessMiddleware,
  ];

  setRecipeInContainer();

  const schema = buildSchemaSync({
    resolvers: [
      ExecutorResolver,
      RecipeResolver,
      TaskResolver,
      PubSubResolver,
      AccountResolver,
      SubstanceResolver,
      PublicResolver,
      RecordResolver,
      PrismaResolver,
    ],
    // container: Container,
    // scoped-container，每次从context中拿到本次注册容器
    container: ({ context }: ResolverData<IContext>) => context.container,
    // TypeGraphQL built-in Scalar Date
    dateScalarMode: "timestamp",
    // authChecker: dev ? () => true : authChecker,
    authChecker,
    authMode: "error",
    emitSchemaFile: path.resolve(__dirname, "./typegraphql/schema.graphql"),
    validate: true,
    globalMiddlewares: dev
      ? basicMiddlewares
      : [...basicMiddlewares, ErrorLoggerMiddleware],
  });

  const server = new ApolloServer({
    schema,
    tracing: true,
    subscriptions: {
      onConnect: () => log("[Subscription] Connected to websocket"),
    },
    context: async ({ ctx }: { ctx: Context }) => {
      // const token: string = ctx.request?.headers?.token ?? null;

      // if (!token) {
      //   return;
      // }

      // const tokenValidation = validateToken(token);
      const { id, accountType, accountRole } = genarateRandomID();
      // 每次请求使用一个随机ID注册容器
      const container = Container.of(id);

      // if (!tokenValidation.valid) {
      //   return {};
      // }

      // const context: IContext = {
      //   currentUser: {
      //     accountId: id,
      //     accountType: tokenValidation.info.accountType,
      //     accountRole: tokenValidation.info.accountRole,
      //   },
      //   container,
      // };

      const context: IContext = {
        currentUser: {
          accountId: id,
          accountType,
          accountRole,
        },
        container,
        prisma,
      };

      container.set("context", context);
      return context;
    },
    extensions: [() => new CustomExtension()],
    // 其实放在context里就可以自己用了
    dataSources: () => ({
      SpaceXAPI: new SpaceXDataSource(),
    }),
    plugins: [
      schemaPlugin(),
      usagePlugin(),
      complexityPlugin(schema),
      extensionPlugin(),
      scopedContainerPlugin(Container),
      ApolloServerLoaderPlugin({
        typeormGetConnection: TypeORM.getConnection,
      }),
      responseCachePlugin({
        // 被标记为PRIVATE的字段缓存只会用于相同sessionID
        sessionId: (ctx: GraphQLRequestContext) =>
          ctx.request.http?.headers.get("sessionId") || null,
        shouldReadFromCache: (ctx: GraphQLRequestContext) => false,
        shouldWriteToCache: (ctx: GraphQLRequestContext) => false,
      }),
    ],
    // 关于RootValue和Context：https://stackoverflow.com/questions/44344560/context-vs-rootvalue-in-apollo-graphql
    // 简单的说，RootValue就像是一个自定义的类型（和其他类型一样），但它只拥有一个动态解析的字段
    // RootValue是解析链的初始值 也就是入口Resolver的parent参数
    rootValue: (documentAST: DocumentNode) => {
      const op = getOperationAST(documentAST);
      return {
        operation: op?.operation,
      };
    },
    // 2333 关掉不能在生产环境用playground了hhh 但是能正常查询
    introspection: true,
    // engine: true,
    // formatError: () => {},
    formatResponse: (
      response: GraphQLResponse | null,
      requestContext: GraphQLRequestContext<object>
    ) => {
      response!.extensions = {
        ...response!.extensions,
        FROM_RESPONSE_FORMATTER: "FROM_RESPONSE_FORMATTER",
      };

      return response as GraphQLResponse;
    },
    playground: {
      settings: PLAY_GROUND_SETTINGS,
    },
    cacheControl: {
      defaultMaxAge: 60,
    },
  });

  await dbConnect();

  await insertInitMockData();

  return server;
};