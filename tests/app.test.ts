import { randomUUID } from "node:crypto";
import http from "node:http";
import amqplib from "amqplib";
import { AppBuilder } from "../src/app";
import type { Config } from "../src/config";
import { LoggerBuilder } from "@42357b89-db02-462c-ad63-d35ca7e5367c/logger";
import { App } from "@42357b89-db02-462c-ad63-d35ca7e5367c/rabbitmq-app";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendRpcRequest(
  rabbitmqUrl: string,
  queueName: string,
  timeout = 30000,
): Promise<{
  status: string;
  data: unknown;
  timestamp: number;
}> {
  const connection = await amqplib.connect(rabbitmqUrl);
  const channel = await connection.createChannel();

  const replyQueue = await channel.assertQueue("", { exclusive: true });
  const correlationId = randomUUID();

  const responsePromise = new Promise<{
    status: string;
    data: unknown;
    timestamp: number;
  }>((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      reject(new Error(`Request timeout after ${timeout}ms`));
    }, timeout);

    channel.consume(
      replyQueue.queue,
      (message) => {
        if (!message) {
          return;
        }

        if (message.properties.correlationId === correlationId) {
          clearTimeout(timeoutHandle);
          const response = JSON.parse(message.content.toString());
          resolve(response);
        }
      },
      { noAck: true },
    );
  });

  channel.sendToQueue(queueName, Buffer.from(JSON.stringify({})), {
    correlationId,
    replyTo: replyQueue.queue,
    persistent: true,
  });

  const response = await responsePromise;

  await channel.close();
  await connection.close();

  return response;
}

const setupServer = async ({
  version,
  tag,
}: {
  version: string;
  tag: string;
}) => {
  const { server, address } = await new Promise<{
    server: http.Server;
    address: string;
  }>((resolve, reject) => {
    const server = http
      .createServer((req, res) => {
        res.end(JSON.stringify({ version, tag }));
      })
      .listen(0, () => {
        const address = server.address();

        if (typeof address === "string") {
          reject(new Error("Server address is not an object"));
          return;
        }

        if (!address) {
          reject(new Error("Server address not found"));
          return;
        }

        const port = address.port;

        resolve({
          server,
          address: `http://127.0.0.1:${port}`,
        });
      });
    server.on("error", (error) => {
      reject(error);
    });
  });

  return { server, address };
};

describe("App Integration Tests", () => {
  const rabbitmqUrl = process.env.RABBITMQ_URL || "amqp://127.0.0.1";

  it("should process message and send reply", async () => {
    const { server, address } = await setupServer({
      version: "1.0.0",
      tag: "test",
    });

    try {
      const testQueue = `test-queue-${randomUUID()}`;

      const config: Config = {
        BASE_URL: address,
        RABBITMQ_URL: rabbitmqUrl,
        RABBITMQ_QUEUE: testQueue,
      };

      const logger = await LoggerBuilder({ NODE_ENV: "test" });
      const app = await AppBuilder({ config, logger });

      const runPromise = app.run();

      await sleep(500);

      const response = await sendRpcRequest(rabbitmqUrl, testQueue);

      expect(response).toMatchObject({
        status: "success",
        data: {
          version: "1.0.0",
          tag: "test",
        },
      });
      expect(response).toHaveProperty("timestamp");

      await app.stop();
      await runPromise;
    } finally {
      server.close();
    }
  });

  it("should handle multiple concurrent messages", async () => {
    const { server, address } = await setupServer({
      version: "1.0.0",
      tag: "test",
    });

    try {
      const testQueue = `test-queue-${randomUUID()}`;

      const config: Config = {
        BASE_URL: address,
        RABBITMQ_URL: rabbitmqUrl,
        RABBITMQ_QUEUE: testQueue,
      };

      const logger = await LoggerBuilder({ NODE_ENV: "test" });
      const app = await AppBuilder({ config, logger });

      const runPromise = app.run();

      await sleep(500);

      const responses = await Promise.all(
        Array.from({ length: 3 }).map(() =>
          sendRpcRequest(rabbitmqUrl, testQueue),
        ),
      );

      expect(responses).toHaveLength(3);

      for (let i = 0; i < 3; i++) {
        expect(responses[i]).toMatchObject({
          status: "success",
          data: {
            version: "1.0.0",
            tag: "test",
          },
        });
      }

      await app.stop();
      await runPromise;
    } finally {
      server.close();
    }
  });

  it("should gracefully handle shutdown with in-flight messages", async () => {
    const { server, address } = await setupServer({
      version: "1.0.0",
      tag: "test",
    });

    try {
      const testQueue = `test-queue-${randomUUID()}`;

      const config: Config = {
        BASE_URL: address,
        RABBITMQ_URL: rabbitmqUrl,
        RABBITMQ_QUEUE: testQueue,
      };

      const logger = await LoggerBuilder({ NODE_ENV: "test" });
      const app = await AppBuilder({ config, logger });

      const runPromise = app.run();

      await sleep(500);

      const responsePromise = sendRpcRequest(rabbitmqUrl, testQueue);

      await sleep(100);

      const stopPromise = app.stop();

      const response = await responsePromise;

      expect(response).toMatchObject({
        status: "success",
        data: {},
      });

      await stopPromise;
      await runPromise;
    } finally {
      server.close();
    }
  });
});
