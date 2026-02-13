# RabbitMQ – What It Is, Why & How (With Examples)

A simple guide to RabbitMQ before diving into this project’s event flow.

---

## What Is RabbitMQ?

**RabbitMQ is a message broker.** It sits in the middle: one service sends a message, RabbitMQ holds it, and other services receive it when they’re ready.

```
  Service A                    RabbitMQ                     Service B
  (Producer)                  (Broker)                      (Consumer)
      │                           │                             │
      │  "Order #123 created"     │                             │
      │ ────────────────────────>│                             │
      │                          │  (stores in a queue)        │
      │                          │ ───────────────────────────>│
      │                          │     "Order #123 created"    │
```

- **Producer** = service that sends (publishes) messages  
- **Consumer** = service that receives (consumes) messages  
- **Broker** = RabbitMQ; it stores and delivers messages

---

## Why Use RabbitMQ?

| Benefit | Meaning |
|--------|---------|
| **Decoupling** | Services don’t call each other directly. They only send/receive messages. |
| **Async** | Producer can continue without waiting for the consumer to finish. |
| **Reliability** | Messages are stored until consumed. If a consumer is down, messages wait in the queue. |
| **Scale** | Add more consumers for the same queue to handle more load. |
| **One-to-many** | One message can be delivered to many queues (many services). |

**Without a broker:** Service A calls Service B’s API. If B is down or slow, A fails or blocks.

**With RabbitMQ:** Service A publishes a message and continues. Service B (and others) consume when ready.

---

## How RabbitMQ Works (Main Pieces)

### 1. Exchange

- Receives messages from **producers**.
- Does **not** store messages.
- Routes each message to one or more **queues** using rules (e.g. routing key).

### 2. Queue

- A **buffer** that stores messages.
- **Consumers** read from queues.
- If no consumer is connected, messages stay in the queue.

### 3. Binding

- A **link** between an exchange and a queue.
- Has a **routing key** (or pattern). Only messages that match go to that queue.

### 4. Routing Key

- A string attached to each message (e.g. `order.created`, `ticket.updated`).
- The exchange uses it (and exchange type) to decide which queues get the message.

**Flow in one sentence:** Producer → sends to **Exchange** with a **routing key** → Exchange uses **bindings** → message is copied to matching **Queues** → **Consumers** read from queues.

```
                    routing key: "order.created"
    Producer ──────────────────────────────────> Exchange
                                                       │
                                    binding: "order.*" │ binding: "order.*"
                                                       ▼
                                              ┌────────┴────────┐
                                              ▼                 ▼
                                          Queue A           Queue B
                                              │                 │
                                          Consumer 1       Consumer 2
```

---

## Basic Operations (With Examples)

We use the **amqplib** library in Node.js. Steps are: connect → create channel → declare exchange/queue → bind → publish or consume.

### 1. Connect & Create a Channel

```javascript
const amqp = require("amqplib");

// Connect to RabbitMQ (default: amqp://localhost)
const connection = await amqp.connect("amqp://localhost");
const channel = await connection.createChannel();
```

- **Connection** = one TCP connection to the broker.  
- **Channel** = light-weight “session” on that connection; we publish and consume on channels.

---

### 2. Declare an Exchange

*“Create this exchange if it doesn’t exist.”*

```javascript
await channel.assertExchange("orders_exchange", "topic", { durable: true });
```

- **Name:** `orders_exchange`  
- **Type:** `topic` (routing by key pattern; see below).  
- **durable: true** = survives broker restart.

---

### 3. Declare a Queue

*“Create this queue if it doesn’t exist.”*

```javascript
await channel.assertQueue("tickets_vs_orders", { durable: true });
```

- **Name:** `tickets_vs_orders`  
- **durable: true** = queue (and messages) survive broker restart.

---

### 4. Bind Queue to Exchange

*“Send to this queue only messages whose routing key matches this pattern.”*

```javascript
await channel.bindQueue("tickets_vs_orders", "orders_exchange", "order.*");
```

- Queue `tickets_vs_orders` receives messages from `orders_exchange` when routing key matches `order.*` (e.g. `order.created`, `order.cancelled`).

---

### 5. Publish a Message

*“Send this message to this exchange with this routing key.”*

```javascript
const message = { id: "123", userId: "user-1", ticketId: "ticket-456", status: "created" };

channel.publish(
  "orders_exchange",      // exchange
  "order.created",       // routing key
  Buffer.from(JSON.stringify(message)),
  { persistent: true }   // store on disk so message survives restart
);
```

- **persistent: true** = message is stored on disk.  
- Body must be a **Buffer** (e.g. `Buffer.from(JSON.stringify(...))`).

---

### 6. Consume Messages

*“When a message arrives in this queue, run this callback.”*

```javascript
channel.consume("tickets_vs_orders", async (msg) => {
  if (!msg) return;

  const content = JSON.parse(msg.content.toString());
  console.log("Received:", content);

  // Do work (e.g. reserve ticket in DB)...
  await reserveTicket(content.ticketId, content.id);

  // Acknowledge = "I'm done, remove from queue"
  channel.ack(msg);
});
```

- **msg.content** is a Buffer; use `msg.content.toString()` then `JSON.parse` for JSON.  
- **channel.ack(msg)** = “message handled; RabbitMQ can remove it.”  
- If you don’t ack (or nack), the message can be redelivered.

---

### 7. Acknowledgement (Ack) and Negative Acknowledgement (Nack)

| Operation | Meaning |
|-----------|--------|
| **ack(msg)** | “Message processed successfully. Remove it from the queue.” |
| **nack(msg, false, true)** | “Processing failed. Put it back in the queue (requeue).” |

**Example: ack on success, nack on error**

```javascript
channel.consume("tickets_vs_orders", async (msg) => {
  try {
    const content = JSON.parse(msg.content.toString());
    await processOrder(content);
    channel.ack(msg);   // success
  } catch (err) {
    channel.nack(msg, false, true);  // requeue for retry
  }
});
```

---

## Exchange Types (Simple Overview)

| Type | How routing works | Example use |
|------|-------------------|-------------|
| **direct** | Routing key must match exactly. | One queue per key, e.g. `orders`, `payments`. |
| **topic** | Routing key matches a pattern (`*` = one word, `#` = zero or more words). | `order.*` = all order events; `order.created`, `order.cancelled`. |
| **fanout** | Ignore routing key; send to all bound queues. | Broadcast to every subscriber. |

**Example – topic:**

- Binding `order.*` → matches `order.created`, `order.cancelled`, `order.failed`, etc.  
- Binding `payment.succeeded` → matches only that exact key.

---

## End-to-End Example (Minimal)

**Producer (e.g. Orders service):**

```javascript
const amqp = require("amqplib");

async function main() {
  const conn = await amqp.connect("amqp://localhost");
  const ch = await conn.createChannel();

  await ch.assertExchange("orders_exchange", "topic", { durable: true });

  ch.publish(
    "orders_exchange",
    "order.created",
    Buffer.from(JSON.stringify({ id: "order-1", ticketId: "ticket-1" })),
    { persistent: true }
  );

  console.log("Published order.created");
  await conn.close();
}

main();
```

**Consumer (e.g. Tickets service):**

```javascript
const amqp = require("amqplib");

async function main() {
  const conn = await amqp.connect("amqp://localhost");
  const ch = await conn.createChannel();

  await ch.assertExchange("orders_exchange", "topic", { durable: true });
  await ch.assertQueue("tickets_vs_orders", { durable: true });
  await ch.bindQueue("tickets_vs_orders", "orders_exchange", "order.*");

  ch.consume("tickets_vs_orders", (msg) => {
    const data = JSON.parse(msg.content.toString());
    console.log("Consumed:", data);
    ch.ack(msg);
  });

  console.log("Waiting for messages...");
}

main();
```

Run the consumer first, then the producer. The consumer will receive the message.

---

## Summary

| Term | Role |
|------|------|
| **Producer** | Publishes messages to an exchange. |
| **Exchange** | Receives messages; routes to queues by routing key (and type). |
| **Queue** | Stores messages until a consumer processes them. |
| **Binding** | Connects queue to exchange with a routing key (or pattern). |
| **Consumer** | Reads from a queue; processes messages; acks or nacks. |
| **Ack** | Tells RabbitMQ to remove the message from the queue. |
| **Nack** | Can requeue the message for retry. |

---

## In This Project

- **Exchanges:** `tickets_exchange`, `orders_exchange`, `payments_exchange`, `expiration_exchange`  
- **Queues:** e.g. `tickets_vs_orders`, `orders_vs_tickets`, `orders_vs_payments`  
- **Operations:** Each service uses a shared connection/channel (e.g. `rabbitMQInstance.js`), declares exchanges/queues on startup, then publishes or consumes.

For the exact events, payloads, and flows in this app, see **RABBITMQ_EVENTS_FLOW.md**.
