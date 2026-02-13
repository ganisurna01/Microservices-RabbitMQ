const rabbitMQInstance = require("../utils/rabbitMQInstance");

async function orderExpiredPublisher(data) {
  try {
    // await rabbitMQInstance.connect(process.env.RABBITMQ_URL); // Already called in index.js --> Singleton Instance
    const channel = rabbitMQInstance.channel; // getter --> so NO paranthesis nedded

    // Delete the existing exchange (if needed)
    // await channel.deleteExchange("expiration_exchange").catch(() => {});

    // Declare Exchange
    await channel.assertExchange("expiration_exchange", "x-delayed-message", {
      durable: true,
      arguments: {
        "x-delayed-type": "direct",
      },
    });
    // Publish
    await channel.publish(
      "expiration_exchange",
      "expiration.expired",
      Buffer.from(JSON.stringify({ orderId: data.orderId })),
      {
        persistent: true,
        headers: {
          "x-delay": data.delay, // Delay in milliseconds
        },
      }
    );
    console.log(`Order expired event will be published(Received by the queues) after ${data.delay} ms`);
  } catch (e) {
    console.error(e);
    return;
  }
}

module.exports = { orderExpiredPublisher };
