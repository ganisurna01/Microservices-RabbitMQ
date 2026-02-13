const rabbitMQInstance = require("../utils/rabbitMQInstance");

async function paymentCreatedPublisher(data) {
  try {
    // await rabbitMQInstance.connect(process.env.RABBITMQ_URL); // Already called in index.js --> Singleton Instance
    const channel = rabbitMQInstance.channel // getter --> so NO paranthesis nedded
    
    // Declare Exchange
    await channel.assertExchange("payments_exchange", "topic", { durable: true });
    // Publish
    await channel.publish("payments_exchange", "payment.created", Buffer.from(JSON.stringify(data)), { persistent: true });
    console.log("Payment created event published successfully");

  } catch (e) {
    console.error(e);
    return;
  }
}

async function paymentSucceededPublisher(data) {
  try {
    // await rabbitMQInstance.connect(process.env.RABBITMQ_URL); // Already called in index.js --> Singleton Instance
    const channel = rabbitMQInstance.channel // getter --> so NO paranthesis nedded
    
    // Declare Exchange
    await channel.assertExchange("payments_exchange", "topic", { durable: true });
    // Publish
    await channel.publish("payments_exchange", "payment.succeeded", Buffer.from(JSON.stringify(data)), { persistent: true });
    console.log("Payment succeeded event published successfully");

  } catch (e) {
    console.error(e);
    return;
  }
}

async function paymentFailedPublisher(data) {
  try {
    // await rabbitMQInstance.connect(process.env.RABBITMQ_URL); // Already called in index.js --> Singleton Instance
    const channel = rabbitMQInstance.channel // getter --> so NO paranthesis nedded
    
    // Declare Exchange
    await channel.assertExchange("payments_exchange", "topic", { durable: true });
    // Publish
    await channel.publish("payments_exchange", "payment.failed", Buffer.from(JSON.stringify(data)), { persistent: true });
    console.log("Payment failed event published successfully");

  } catch (e) {
    console.error(e);
    return;
  }
}

module.exports = {paymentCreatedPublisher, paymentSucceededPublisher, paymentFailedPublisher}