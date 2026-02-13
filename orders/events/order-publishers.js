const rabbitMQInstance = require("../utils/rabbitMQInstance");

async function orderCreatedPublisher(data) {
  try {
    // await rabbitMQInstance.connect(process.env.RABBITMQ_URL); // Already called in index.js --> Singleton Instance
    const channel = rabbitMQInstance.channel; // getter --> so NO paranthesis nedded

    // Declare Exchange
    await channel.assertExchange("orders_exchange", "topic", { durable: true });
    // Publish
    channel.publish(
      "orders_exchange",
      "order.created",
      Buffer.from(JSON.stringify(data)),
      { persistent: true }
    );
    console.log("Order created event published successfully");
  } catch (e) {
    console.error(e);
    return;
  }
}

async function orderCancelledPublisher(data) {
  try {
    // await rabbitMQInstance.connect(process.env.RABBITMQ_URL); // Already called in index.js --> Singleton Instance
    const channel = rabbitMQInstance.channel; // getter --> so NO paranthesis nedded

    // Declare Exchange
    await channel.assertExchange("orders_exchange", "topic", { durable: true });
    // Publish
    channel.publish(
      "orders_exchange",
      "order.cancelled",
      Buffer.from(JSON.stringify(data)),
      { persistent: true }
    );
    console.log("Order cancelled event published successfully");
  } catch (e) {
    console.error(e);
    return;
  }
}

async function orderFailedPublisher(data) {
  try {
    // await rabbitMQInstance.connect(process.env.RABBITMQ_URL); // Already called in index.js --> Singleton Instance
    const channel = rabbitMQInstance.channel; // getter --> so NO paranthesis nedded

    // Declare Exchange
    await channel.assertExchange("orders_exchange", "topic", { durable: true });
    // Publish
    channel.publish(
      "orders_exchange",
      "order.failed",
      Buffer.from(JSON.stringify(data)),
      { persistent: true }
    );
    console.log("Order failed event published successfully");
  } catch (e) {
    console.error(e);
    return;
  }
}

async function orderPendingPublisher(data) {
  try {
    // await rabbitMQInstance.connect(process.env.RABBITMQ_URL); // Already called in index.js --> Singleton Instance
    const channel = rabbitMQInstance.channel; // getter --> so NO paranthesis nedded

    // Declare Exchange
    await channel.assertExchange("orders_exchange", "topic", { durable: true });
    // Publish
    channel.publish(
      "orders_exchange",
      "order.pending",
      Buffer.from(JSON.stringify(data)),
      { persistent: true }
    );
    console.log("Order pending event published successfully");
  } catch (e) {
    console.error(e);
    return;
  }
}

module.exports = {
  orderCreatedPublisher,
  orderCancelledPublisher,
  orderFailedPublisher,
  orderPendingPublisher,
};
