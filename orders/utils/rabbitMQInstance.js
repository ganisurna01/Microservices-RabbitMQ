const amqp = require("amqplib");

class RabbitMQWrapper {
  constructor() {
    this._connection = null;
    this._channel = null;
  }

  async connect(url) {
    try {
      this._connection = await amqp.connect(url);
      this._channel = await this._connection.createChannel();

      console.log(`Connected to RabbitMQ at ${url}`);

      // Handle connection errors/closures
      this._connection.on("error", (err) => {
        console.error("RabbitMQ connection error:", err.message);
      });

      this._connection.on("close", () => {
        console.log("RabbitMQ connection closed!");
        this._connection = null;
        this._channel = null;
      });
    } catch (err) {
      console.error("Failed to connect to RabbitMQ:", err.message);
      throw err;
    }
  }

  /* Getters to use this just like :
    ✅ "rabbitMQInstance.channel" or "rabbitMQInstance.connection" ✅
    instead of "rabbitMQInstance.channel()" or "rabbitMQInstance.connection()"
  */

  /**
   * Get the active channel (throws if not connected)
   */
  get channel() {
    if (!this._channel) {
      console.error("Cannot access RabbitMQ channel before connecting");
      // throw new Error('Cannot access RabbitMQ channel before connecting');
    }
    return this._channel;
  }

  // get active connection
  get connection(){
    if (!this._connection) {
      console.error("Cannot access RabbitMQ connection before connecting");
      // throw new Error('Cannot access RabbitMQ connection before connecting');
    }
    return this._connection;
  }
}

// Singleton instance
const rabbitMQInstance = new RabbitMQWrapper();
module.exports = rabbitMQInstance;
