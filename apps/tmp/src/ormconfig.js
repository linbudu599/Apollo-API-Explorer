const chalk = require("chalk");

const IS_DEV =
  process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

const IS_TEST = process.env.NODE_ENV === "test";

console.log(`
${chalk.green(`[TypeORM] Config Env: `)} ${chalk.cyan(
  IS_DEV ? "-DEV-" : "-PROD-"
)}
`);

module.exports = {
  type: "sqlite",
  name: "default",
  database: IS_DEV ? "db.sqlite" : "db-prod.sqlite",
  // synchronize: IS_DEV,
  synchronize: true,
  dropSchema: IS_DEV,
  // logging: IS_DEV ? false : "all",
  maxQueryExecutionTime: 1000,
  logger: "advanced-console",
  entities: [IS_DEV ? "server/entities/*.ts" : "dist/entities/*.js"],
  factories: ["server/entities/factories/*.ts"],
  seeds: ["server/entities/seeds/*.ts"],
  cache: {
    duration: 1000,
  },
  subscribers: [
    IS_DEV
      ? "server/entities/subscribers/*.ts"
      : "dist/entities/subscribers/*.js",
  ],
};
