const Ticket = require("../models/ticket");
const { ticketUpdatedPublisher } = require("./ticket-publishers");

async function ordersConsumer(channel) {

  // Declare exchange
  await channel.assertExchange("orders_exchange", "topic", { durable: true });
  await channel.assertQueue("tickets_vs_orders", { durable: true });
  await channel.bindQueue("tickets_vs_orders", "orders_exchange", "order.*");
  // tickets_vs_orders Queue consuming messages from orders_exchange Exchange

  channel.consume("tickets_vs_orders", async (data) => {
    try {
      const { content, fields } = data;
      const { routingKey, exchange } = fields;

      const parsedContent = JSON.parse(content);
      console.log(
        `Received for exchange[${exchange}] routingKey[${routingKey}]: `,
        parsedContent
      );

      if (routingKey === "order.created") {
        const ticket = await Ticket.findById(parsedContent.ticketId);
        if (!ticket) {
          console.error("Ticket not found");
          // channel.ack(data); --> Do not acknowledge the message, it will be retried by the broker
          return; // return early to avoid unnecessary database operations
        }
        ticket.set({ orderId: parsedContent.id });
        await ticket.save(); // ticket updates, means its version changes. Need to emit event to Orders_Service to match version of ticket

        // Ticket Updated publisher
        await ticketUpdatedPublisher({
          id: ticket.id,
          title: ticket.title,
          price: ticket.price,
          version: ticket.version,
        });

        // Manual acknowledgement
        channel.ack(data);
      }
      if (routingKey === "order.cancelled") {
        const ticket = await Ticket.findById({
          _id: parsedContent.ticketId,
          orderId: parsedContent.id,
        });
        if (!ticket) {
          console.error("Ticket not found, or Order ID mismatch");
          channel.ack(data);
          return;
        }
        ticket.set({ orderId: null });
        await ticket.save(); // ticket updates, means its version changes. Need to emit event to Orders_Service to match version of ticket

        // Ticket Updated publisher
        await ticketUpdatedPublisher({
          id: ticket.id,
          title: ticket.title,
          price: ticket.price,
          version: ticket.version,
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
