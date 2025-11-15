import { SQSApp } from "@42357b89-db02-462c-ad63-d35ca7e5367c/sqs-app";
import type { Context } from "./types/Context";
import { handler } from "./handler";

export const AppBuilder = async (context: Context) =>
  SQSApp<Context>({
    sqsEndpoint: "http://127.0.0.1:4566",
    redisUrl: "redis://127.0.0.1:6380",
    queues: [{ url: "http://127.0.0.1:4566/000000000000/test-queue", handler }],
    context,
  });
