import type { Logger } from "@42357b89-db02-462c-ad63-d35ca7e5367c/rabbitmq-app";
import type { Config } from "../config";

export type Context = {
  config: Config;
  logger: Logger;
};
