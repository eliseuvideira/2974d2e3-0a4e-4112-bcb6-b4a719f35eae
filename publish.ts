import { StringCodec, connect, headers } from "nats";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";

const main = async () => {
  dotenv.config({ quiet: true });

  const count = process.argv[2] ? parseInt(process.argv[2], 10) : 700;

  if (Number.isNaN(count) || count <= 0) {
    console.error("Error: count must be a positive number");
    process.exit(1);
  }

  const nc = await connect({
    servers: [process.env.RABBITMQ_URL || "nats://127.0.0.1:4222"],
  });
  const js = nc.jetstream();
  const sc = StringCodec();

  const subject = process.env.RABBITMQ_QUEUE || "queue_example";

  console.log(`Publishing ${count} messages to subject: ${subject}`);

  const publishMessage = async (i: number) => {
    const replySubject = `${subject}.reply.${randomUUID()}`;
    const correlationId = randomUUID();

    const message = {
      test: `Hello from publisher! Message ${i}/${count}`,
      timestamp: new Date().toISOString(),
      messageNumber: i,
    };

    const sub = nc.subscribe(replySubject);

    const responsePromise = (async () => {
      for await (const msg of sub) {
        const responseData = sc.decode(msg.data);
        return JSON.parse(responseData);
      }
    })();

    const h = headers();
    h.set("reply-to", replySubject);
    h.set("correlation-id", correlationId);

    await js.publish(subject, sc.encode(JSON.stringify(message)), {
      headers: h,
    });

    const timeout = 30000;
    let timeoutId: NodeJS.Timeout;

    try {
      const response = await Promise.race([
        responsePromise.finally(() => {
          clearTimeout(timeoutId);
        }),
        new Promise((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error(`Message ${i}: timeout after ${timeout}ms`)),
            timeout,
          );
        }),
      ]);

      console.log(`Message ${i}: response received`, response);
    } finally {
      sub.unsubscribe();
    }
  };

  const promises: Promise<void>[] = [];

  const startTime = Date.now();

  for (let i = 1; i <= count; i++) {
    promises.push(publishMessage(i));
  }

  const responses = await Promise.all(promises);

  const endTime = Date.now();
  const duration = endTime - startTime;
  const messagesPerSecond = ((count / duration) * 1000).toFixed(2);

  console.log(`\nCompleted ${count} RPC calls`);
  console.log(`Duration: ${duration}ms`);
  console.log(`Rate: ${messagesPerSecond} messages/second`);
  console.log(`Received ${responses.length} responses`);

  await nc.close();
};

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
