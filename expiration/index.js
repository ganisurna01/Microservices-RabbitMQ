const express = require("express");
const { ordersConsumer } = require("./events/orders-consumer");
const rabbitMQInstance = require("./utils/rabbitMQInstance");

const app = express();
app.use(express.json());

// Connect to RabbitMQ
const connectRabbitMQ = async () => {
  try {
    if (!process.env.RABBITMQ_URL) {
      throw new Error("RABBITMQ_URL is not defined.");
    }

    await rabbitMQInstance.connect(process.env.RABBITMQ_URL);

    // Add this to your consumer initialization
    // await rabbitMQInstance.channel.purgeQueue("expiration_vs_orders");
    // console.log("Purged existing messages from expiration_vs_orders queue");

    // Graceful shutdown of the RabbitMQ
    rabbitMQInstance.connection.on("close", () => {
      console.log("RabbitMQ connection closed");
      process.exit(1);
    });
  } catch (error) {
    console.error("Error connecting to RabbitMQ:", error);
  }
};

// listen for events/messages
const consumeEvents = async () => {
  try {
    await ordersConsumer(rabbitMQInstance.channel)
  } catch (error) {
    console.error(error.message);
  }
};

app.listen(3000, async () => {
  await connectRabbitMQ();
  await consumeEvents();

  console.log("Tickets Service is running on port 3000");
});

process.on("SIGINT", () => rabbitMQInstance.connection.close());
process.on("SIGTERM", () => rabbitMQInstance.connection.close());
