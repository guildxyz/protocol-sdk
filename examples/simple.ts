import { Syncer } from "../src/Syncer";

const syncer = new Syncer({
  protocolWsUrl: "ws://localhost:8081/api/v1/events/ws",
  subscriptionID: "test",
  subscriptionKey: "test",
  dataPointHandler: async (msg) => {
    // get and use configuration to evaluate data point
    const config = await syncer.getConfiguration(msg.data.configurationId);
    // update the data point
    await syncer.updateDataPoint(
      "MY_INTEGRATION",
      msg.data.configurationId,
      msg.data.identityType,
      msg.data.accountId,
      {
        value: 5,
      },
    );
    // throw DataPointError if something goes wrong
  },
  protocolUrl: "http://localhost:8080",
  protocolAdminKey: "70ad573f-ca5d-49e4-be60-01241e170157",
});

syncer.start();
