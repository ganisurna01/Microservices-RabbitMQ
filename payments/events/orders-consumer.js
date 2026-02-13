const Order = require("../models/order");

async function ordersConsumer(channel) {
  // Delete the existing exchange (if needed)
  // await channel.deleteExchange("orders_exchange").catch(() => {});

  // Declare exchange
  await channel.assertExchange("orders_exchange", "topic", { durable: true });
  await channel.assertQueue("payments_vs_orders", { durable: true });
  await channel.bindQueue("payments_vs_orders", "orders_exchange", "order.*");
  // payments_vs_orders Queue consuming messages from orders_exchange Exchange

  channel.consume("payments_vs_orders", async (data) => {
    try {
      const { content, fields } = data;
      const { routingKey, exchange } = fields;

      const parsedContent = JSON.parse(content);
      console.log(
        `Received for exchange[${exchange}] routingKey[${routingKey}]: `,
        parsedContent
      );

      if (routingKey === "order.created") {
        const order = new Order({
          _id: parsedContent.id,
          status: parsedContent.status,
          userId: parsedContent.userId,
          price: parsedContent.price,
        });
        await order.save();

        // Manual acknowledgement
        channel.ack(data);
      }
      if (routingKey === "order.cancelled") {
        const order = await Order.findOne({
          _id: parsedContent.id,
          version: parsedContent.version - 1,
        });
        if (!order) {
          console.error("Order not found");
          return; // return early to avoid unnecessary database operations
        }
        order.set({ status: parsedContent.status || "cancelled" }); // version changes automatically by plugin(if we use .set() & .save()), so need to include version here
        await order.save();

        // Manual acknowledgement
        channel.ack(data);
      }
      if (routingKey === "order.pending") {
        // const allOrders = await Order.find({});
        // console.log("All Orders", allOrders);
        const order = await Order.findOne({
          _id: parsedContent.orderId,
          version: parsedContent.version - 1,
        });
        if (!order) {
          console.error("Order not found");
          return; // return early to avoid unnecessary database operations
        }
        order.set({ status: parsedContent.status || "pending_payment" }); // version changes automatically by plugin(if we use .set() & .save()), so need to include version here
        await order.save();

        // Manual acknowledgement
        channel.ack(data);
      }
      if (routingKey === "order.failed") {
        const order = await Order.findOne({
          _id: parsedContent.id,
          version: parsedContent.version - 1,
        });
        if (!order) {
          console.error("Order not found");
          return; // return early to avoid unnecessary database operations
        }
        order.set({ status: parsedContent.status || "failed" }); // version changes automatically by plugin(if we use .set() & .save()), so need to include version here
        await order.save();

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
