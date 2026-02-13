const rabbitMQInstance = require("../utils/rabbitMQInstance");

async function ticketCreatedPublisher(data) {
  try {
    // await rabbitMQInstance.connect(process.env.RABBITMQ_URL); // Already called in index.js --> Singleton Instance
    const channel = rabbitMQInstance.channel // getter --> so NO paranthesis nedded
    
    // Declare Exchange
    await channel.assertExchange("tickets_exchange", "topic", { durable: true });
    // Publish
    channel.publish("tickets_exchange", "ticket.created", Buffer.from(JSON.stringify(data)), { persistent: true });
    console.log("Ticket created event published successfully");

  } catch (e) {
    console.error(e);
    return;
  }
}

async function ticketUpdatedPublisher(data) {
  try {
    const channel = rabbitMQInstance.channel // getter --> so NO paranthesis nedded
    
    // Declare Exchange
    await channel.assertExchange("tickets_exchange", "topic", { durable: true });
    // Publish
    channel.publish(
      "tickets_exchange", // Exchange name
      "ticket.updated", // Routing key
      Buffer.from(JSON.stringify(data)), // Message body
       { persistent: true } // Message properties
    );
    console.log("Ticket updated event published successfully");

  } catch (e) {
    console.error(e);
    return;
  }
}

module.exports = {ticketCreatedPublisher, ticketUpdatedPublisher};
