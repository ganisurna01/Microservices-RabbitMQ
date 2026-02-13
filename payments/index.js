const express = require("express");
const paymentRoutes = require("./routes/payment-routes");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { currentUser, requireAuth } = require("@ganeshsurnaticketingapp/common");
const { ordersConsumer } = require("./events/orders-consumer");
const rabbitMQInstance = require("./utils/rabbitMQInstance");

const app = express();
// Use express.json() for all routes except the webhook endpoint
app.use((req, res, next) => {
  if (req.originalUrl === "/api/payments/webhooks/stripe") {
    next(); // Skip JSON parsing for the webhook endpoint
  } else {
    express.json()(req, res, next); // Use JSON parsing for other routes
  }
});

app.use(cors()); // Will also work
// app.use(
//   cors({
//     origin: ["http://localhost:3000", "https://ticketing.dev", "http://ingress-nginx-controller.ingress-nginx.svc.cluster.local"], // Allowed origins
//     credentials: true, // Allow credentials (cookies)
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
//   })
// );

app.set("trust proxy", true); // To allow traffic coming from Ingress-Nginx
app.use(cookieParser());

app.use("/api/payments", paymentRoutes);

// Connect to mongoose server
const connectMongo = async () => {
  if (!process.env.JWT_KEY) {
    throw new Error("JWT_KEY is not defined.");
  }
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined.");
  }

  try {
    await mongoose.connect(
      // "mongodb://tickets-mongo-srv:27017/tickets" // tickets will be db name ||| tickets-mongo-srv ==> see in tickets-mongo-depl.yaml
      process.env.MONGODB_URI // Set in tickets-depl.yaml ==> env ==> mongodb://tickets-mongo-srv:27017/tickets
    );
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error.message);
    process.exit(1);
  }
};

// Connect to RabbitMQ
const connectRabbitMQ = async () => {
  try {
    if (!process.env.RABBITMQ_URL) {
      throw new Error("RABBITMQ_URL is not defined.");
    }

    await rabbitMQInstance.connect(process.env.RABBITMQ_URL);

    // Add this to your consumer initialization
    // await rabbitMQInstance.channel.purgeQueue("payments_vs_orders");
    // console.log("Purged existing messages from payments_vs_orders queue");

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
    await ordersConsumer(rabbitMQInstance.channel);
  } catch (error) {
    console.error(error.message);
  }
};

app.listen(3000, async () => {
  await connectRabbitMQ();
  await consumeEvents();
  await connectMongo();

  console.log("Payments Service is running on port 3000");
});

process.on("SIGINT", () => rabbitMQInstance.connection.close());
process.on("SIGTERM", () => rabbitMQInstance.connection.close());
