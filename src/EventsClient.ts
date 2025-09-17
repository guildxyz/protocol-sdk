import WebSocket from "ws";
import {
  ClientToServerMsg,
  clientToServerMsgToRaw,
  ServerToClientMsg,
  ServerToClientMsgRaw,
} from "./types";

export class EventsClient {
  private protocolWsUrl: string;
  private subscriptionId: string;
  private subscriptionKey: string;
  private ws?: WebSocket;
  private handler: (data: ServerToClientMsg) => void;

  constructor(params: EventsClientParams) {
    this.protocolWsUrl = params.protocolWsURL;
    this.subscriptionId = params.subscriptionID;
    this.subscriptionKey = params.subscriptionKey;
    this.handler = params.handler;
  }

  public start() {
    this.ws = new WebSocket(this.protocolWsUrl);
    this.ws.on("open", () => {
      this.sendInitialMessage();
      console.log("ws opened");
    });
    this.ws.on("close", (_: WebSocket, code: number, reason: Buffer) => {
      console.log("ws closed", code, reason);
    });
    this.ws.on("message", (data, isBinary) => {
      if (!isBinary) {
        const msgString = data.toString();
        const msg: ServerToClientMsgRaw = JSON.parse(msgString);
        const parsed = new ServerToClientMsg(this, msg);
        this.handler(parsed);
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
  protocolWsURL: string;
  subscriptionID: string;
  subscriptionKey: string;
  handler: (data: ServerToClientMsg) => void;
};
