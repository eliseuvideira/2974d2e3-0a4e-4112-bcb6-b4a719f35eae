import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";

const main = async () => {
  dotenv.config({ quiet: true });

  const count = process.argv[2] ? parseInt(process.argv[2], 10) : 700;

  if (Number.isNaN(count) || count <= 0) {
    console.error("Error: count must be a positive number");
    process.exit(1);
  }

  const client = new SQSClient({
    endpoint: process.env.SQS_ENDPOINT || "http://127.0.0.1:4566",
  });

  const queueUrl =
    process.env.SQS_QUEUE_URL ||
    "http://127.0.0.1:4566/000000000000/test-queue";

  console.log(`Publishing ${count} messages to queue: ${queueUrl}`);

  const publishMessage = async (i: number) => {
    const correlationId = randomUUID();
    const replyQueueUrl =
      process.env.SQS_REPLY_QUEUE_URL ||
      "http://127.0.0.1:4566/000000000000/test-queue";

    const message = {
      test: `Hello from publisher! Message ${i}/${count}`,
      timestamp: new Date().toISOString(),
      messageNumber: i,
    };

    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message),
      MessageAttributes: {
        replyTo: {
          DataType: "String",
          StringValue: replyQueueUrl,
        },
        correlationId: {
          DataType: "String",
          StringValue: correlationId,
        },
      },
    });

    await client.send(command);
    console.log(`Message ${i}: sent`);
  };

  const promises: Promise<void>[] = [];

  const startTime = Date.now();

  for (let i = 1; i <= count; i++) {
    promises.push(publishMessage(i));
  }

  await Promise.all(promises);

  const endTime = Date.now();
  const duration = endTime - startTime;
  const messagesPerSecond = ((count / duration) * 1000).toFixed(2);

  console.log(`\nCompleted sending ${count} messages`);
  console.log(`Duration: ${duration}ms`);
  console.log(`Rate: ${messagesPerSecond} messages/second`);
};

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
