const { orderExpiredPublisher } = require("./expiration-publishers");

async function ordersConsumer(channel) {
  // Delete the existing exchange (if needed)
  // await channel.deleteExchange("orders_exchange").catch(() => {});

  // Declare exchange
  await channel.assertExchange("orders_exchange", "topic", { durable: true });
  await channel.assertQueue("expiration_vs_orders", { durable: true });
  await channel.bindQueue("expiration_vs_orders", "orders_exchange", "order.*");
  // expiration_vs_orders Queue consuming messages from orders_exchange Exchange

  channel.consume("expiration_vs_orders", async (data) => {
    try {
      const { content, fields } = data;
      const { routingKey, exchange } = fields;

      const parsedContent = JSON.parse(content);
      console.log(
        `Received for exchange[${exchange}] routingKey[${routingKey}]: `,
        parsedContent
      );

      if (routingKey === "order.created") {
        const delayInMilliSeconds =
          new Date(parsedContent.expiresAt).getTime() - new Date().getTime();
        console.log(
          `Order will expire in ${delayInMilliSeconds} milli seconds`
        );

        // Publish order expired event after a delay of "delayInMilliSeconds"
        await orderExpiredPublisher({
          delay: delayInMilliSeconds,
          orderId: parsedContent.id,
        });

        // Manual acknowledgement
        channel.ack(data);
      }
    } catch (error) {
      console.error("Error processing message:", err);
      channel.nack(data, false, true); // Requeue for Retry
    }
  });
}

module.exports = { ordersConsumer };
