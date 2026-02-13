const Ticket = require("../models/ticket");

async function ticketsConsumer(channel) {
  // Delete the existing exchange (if needed)
  // await channel.deleteExchange("tickets_exchange").catch(() => {});

  // Declare exchange
  await channel.assertExchange("tickets_exchange", "topic", { durable: true });
  await channel.assertQueue("orders_vs_tickets", { durable: true });
  await channel.bindQueue("orders_vs_tickets", "tickets_exchange", "ticket.*");
  // orders_vs_tickets Queue consuming messages from tickets_exchange Exchange

  channel.consume("orders_vs_tickets", async (data) => {
    try {
      const { content, fields } = data;
      const { routingKey, exchange } = fields;

      const parsedContent = JSON.parse(content);
      console.log(
        `Received for exchange[${exchange}] routingKey[${routingKey}]: `,
        parsedContent
      );

      if (routingKey === "ticket.created") {
        console.log('Inside ticket.created routing key')
        const { id, title, price } = parsedContent;
        // Save (with same id of ticket to identify later) to Tickets database in OrdersService
        const ticket = new Ticket({ _id: id, title: title, price: price });
        await ticket.save();

        // Manual acknowledgement
        channel.ack(data);
      }
      if (routingKey === "ticket.updated") {
        console.log('Inside ticket.updated routing key')
        const { id, title, price, version } = parsedContent;
        const ticket = await Ticket.findOne({ _id: id, version: version - 1 });
        if (!ticket) {
          // throw new Error('Ticket not found');
          console.log("Ticket not found");
          // channel.ack(data); --> Do not acknowledge the message, it will be retried by the broker
          return; // return early to avoid unnecessary database operations
        }
        ticket.set({ title: title, price: price, version: version }); // Include version, using pre, $where
        await ticket.save();

        // Manual acknowledgement
        channel.ack(data);
      }
    } catch (error) {
      console.error("Error processing message:", err);
      channel.nack(data, false, true); // Requeue for Retry
    }
  });
}

module.exports = { ticketsConsumer };
