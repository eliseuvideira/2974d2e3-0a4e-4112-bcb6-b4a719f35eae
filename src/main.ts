import { LoggerBuilder } from "@42357b89-db02-462c-ad63-d35ca7e5367c/logger";
import dotenv from "dotenv";
import { AppBuilder } from "./app";
import { ConfigBuilder } from "./config";

const main = async (): Promise<void> => {
  dotenv.config({
    quiet: true,
  });

  const config = await ConfigBuilder(process.env);
  const logger = await LoggerBuilder(process.env);

  const app = await AppBuilder({
    config,
    logger,
  });

  const shutdown = async (): Promise<void> => {
    logger.info("Shutting down...");
    await app.stop();
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  await app.run();
};

main().catch(async (error) => {
  const logger = await LoggerBuilder(process.env);
  logger.fatal("Fatal error", { error });
  process.exit(1);
});
