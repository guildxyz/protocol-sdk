import { Syncer } from "../src/Syncer";

const syncer = new Syncer({
  customProtocolWsUrl: "ws://localhost:8081/api/v1/events/ws",
  subscriptionID: "test",
  subscriptionKey: "test",
  dataPointHandler: async (msg) => {
    console.log(msg);
  },
});

syncer.start();
