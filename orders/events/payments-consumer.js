const Order = require("../models/order");
const {
  orderPendingPublisher,
  orderFailedPublisher,
} = require("./order-publishers");

async function paymentsConsumer(channel) {

  // Declare exchange
  await channel.assertExchange("payments_exchange", "topic", { durable: true });
  await channel.assertQueue("orders_vs_payments", { durable: true });
  await channel.bindQueue("orders_vs_payments", "payments_exchange", "payment.*");
  // orders_vs_payments Queue consuming messages from payments_exchange Exchange

  await channel.consume("orders_vs_payments", async (data) => {
    try {
      const { content, fields } = data;
      const { routingKey, exchange } = fields;

      const parsedContent = JSON.parse(content);
      console.log(
        `Received for exchange[${exchange}] routingKey[${routingKey}]: `,
        parsedContent
      );

      if (routingKey === "payment.created") {
        console.log("Inside payment.created routing key");
        // Update Order status to "completed" in Orders_vs_payments
        const order = await Order.findById(parsedContent.orderId);
        if (!order) {
          console.error("Order not found");
          channel.ack(data); // Prevent reprocessing
          return; // return early to avoid unnecessary database operations
        }
        order.status = "pending_payment";
        await order.save();

        // Publish to Payments_Service to match version(updates).
        // Must be awaited, before acknowledging the message
        await orderPendingPublisher({
          orderId: order.id,
          status: order.status,
          ticketId: order.ticketId,
          version: order.version,
        });

        // Manual acknowledgement
        channel.ack(data);
      }
      if (routingKey === "payment.succeeded") {
        console.log("Inside payment.succeeded routing key");
        // Update Order status to "completed" in Orders_vs_payments
        const order = await Order.findById(parsedContent.orderId);
        if (!order) {
          console.error("Order not found");
          channel.ack(data); // Prevent reprocessing
          return; // return early to avoid unnecessary database operations
        }
        console.log("Order found");
        order.status = "completed";
        await order.save();
        console.log("Order status changed to completed", order.status);

        /* No need to emit event here, because order-completed means ticket sold, 
            so orderId should be there in Ticket_Service 
        */

        // Manual acknowledgement
        channel.ack(data);
      }
      if (routingKey === "payment.failed") {
        console.log("Inside payment.failed routing key");
        // Update Order status to "completed" in Orders_vs_payments
        const order = await Order.findById(parsedContent.orderId);
        if (!order) {
          console.error("Order not found");
          channel.ack(data); // Prevent reprocessing
          return; // return early to avoid unnecessary database operations
        }
        order.status = "failed";
        await order.save();

        // Publish OrderCancelled event to Tickets_Servie to relase lock on ticket (as it is failed to buy)
        // And also Publish to Payments_Service to match version(updates).
        // Must be awaited, before acknowledging the message
        await orderFailedPublisher({
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

module.exports = { paymentsConsumer };
