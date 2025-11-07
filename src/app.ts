import { RabbitMQApp } from "@42357b89-db02-462c-ad63-d35ca7e5367c/rabbitmq-app";
import type { Context } from "./types/Context";
import { handler } from "./handler";

export const AppBuilder = async (context: Context) =>
  RabbitMQApp<Context>({
    url: context.config.RABBITMQ_URL,
    queues: [
      {
        name: context.config.RABBITMQ_QUEUE,
        handler,
      },
      {
        name: "example",
        handler: async (error) => {
          return {};
        },
      },
    ],
    context,
  });
