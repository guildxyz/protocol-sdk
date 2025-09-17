import { EventsClient } from "./EventsClient";

const ec = new EventsClient({
  protocolWsURL: "ws://localhost:8081/api/v1/events/ws",
  subscriptionID: "test",
  subscriptionKey: "test",
  handler: (msg) => {
    console.log(msg);
    msg.ack();
  },
});

ec.start();
