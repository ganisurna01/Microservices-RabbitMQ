const Order = require("../models/order");
const { orderCancelledPublisher } = require("./order-publishers");

async function expirationConsumer(channel) {

  // Delete the existing exchange (if needed)
  // await channel.deleteExchange("expiration_exchange").catch(() => {});
  // Declare Exchange
  await channel.assertExchange("expiration_exchange", "x-delayed-message", {
    durable: true,
    arguments: {
      "x-delayed-type": "direct",
    },
  });
  await channel.assertQueue("orders_vs_expiration", { durable: true });
  await channel.bindQueue("orders_vs_expiration", "expiration_exchange", "expiration.expired");
  // orders_vs_expiration Queue consuming messages from expiration_exchange Exchange

  channel.consume("orders_vs_expiration", async (data) => {
    try {
      const { content, fields } = data;
      const { routingKey, exchange } = fields;

      const parsedContent = JSON.parse(content);
      console.log(
        `Received for exchange[${exchange}] routingKey[${routingKey}]: `,
        parsedContent
      );

      if (routingKey === "expiration.expired") {
        const order = await Order.findById(parsedContent.orderId);
        if (!order) {
          console.error("Order not found");
          return;
        }
        //  If the payment has done, then acknowledge and exit
        if (order.status === "completed") {
          channel.ack(data);
          return;
        }
        order.set({ status: "cancelled" }); // Means ticket is unreserved by this order
        await order.save();

        // Emit OrderCancelledEvent to notify other services
        await orderCancelledPublisher({
          id: order.id,
          ticketId: order.ticketId,
          userId: order.userId,
          status: order.status,
          version: order.version,
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

module.exports = { expirationConsumer };
