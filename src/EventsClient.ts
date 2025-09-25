import { ReconnectingWS } from "./ReconnectingWebSocket";
import {
  ClientToServerMsg,
  clientToServerMsgToRaw,
  ServerToClientMsg,
  ServerToClientMsgRaw,
} from "./types";

const DEFAULT_PROTOCOL_WS_URL =
  "wss://api.protocol.guild-api.xyz/api/v1/events/ws";

export class EventsClient {
  private protocolWsUrl: string;
  private subscriptionId: string;
  private subscriptionKey: string;
  private ws?: ReconnectingWS;
  private handler: (data: ServerToClientMsg) => Promise<void>;

  constructor(params: EventsClientParams) {
    this.protocolWsUrl = params.protocolWsUrl ?? DEFAULT_PROTOCOL_WS_URL;
    this.subscriptionId = params.subscriptionID;
    this.subscriptionKey = params.subscriptionKey;
    this.handler = params.handler;
  }

  public start() {
    this.ws = new ReconnectingWS({
      url: this.protocolWsUrl,
      onOpen: () => {
        this.sendInitialMessage();
        console.log("ws opened");
      },
      onMessage: (data) => {
        let parsed: ServerToClientMsg;
        try {
          const msgString = data.toString();
          const msg: ServerToClientMsgRaw = JSON.parse(msgString);
          parsed = new ServerToClientMsg(this, msg);
        } catch (error) {
          console.log("EventsClient on message prepare error", error);
          return;
        }
        try {
          this.handler(parsed);
        } catch (error) {
          console.log("EventsClient handler error", error);
        }
      }
    });
  }

  public stop() {
    this.send({ signal: "STOP" });
    this.ws?.close();
  }

  public send(msg: ClientToServerMsg) {
    this.ws?.send(JSON.stringify(clientToServerMsgToRaw(msg)));
  }

  private sendInitialMessage() {
    this.ws?.send(
      JSON.stringify({
        subscription_id: this.subscriptionId,
        subscription_key: this.subscriptionKey,
      }),
    );
  }
}

export type EventsClientParams = {
  protocolWsUrl?: string;
  subscriptionID: string;
  subscriptionKey: string;
  handler: (data: ServerToClientMsg) => Promise<void>;
};
