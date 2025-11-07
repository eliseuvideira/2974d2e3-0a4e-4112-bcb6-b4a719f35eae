import { z } from "zod";

const CONFIG_SCHEMA = z.object({
  BASE_URL: z.string().default("https://api.tryfinch.com"),
  RABBITMQ_URL: z.string().default("amqp://localhost"),
  RABBITMQ_QUEUE: z.string().default("queue_example"),
});

export type Config = z.infer<typeof CONFIG_SCHEMA>;

export const ConfigBuilder = async (env: unknown): Promise<Config> => {
  return CONFIG_SCHEMA.parse(env);
};
