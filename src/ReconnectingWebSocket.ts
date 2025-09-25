import { type BackoffOptions, backOff } from "exponential-backoff";

type MessageListener = (this: WebSocket, ev: MessageEvent<any>) => any;
type OpenListener = (ev: Event) => any;

export class ReconnectingWS {
  private url: string;

  private onMessage?: MessageListener;

  private onOpen?: OpenListener;

  private ws: WebSocket | null = null;

  private backoffOptions: BackoffOptions | undefined;

  constructor({
    url,
    onMessage, onOpen,
    backoffOptions,
  }: { url: string; onMessage?: MessageListener; onOpen?: OpenListener; backoffOptions?: BackoffOptions }) {
    this.url = url;
    this.onMessage = onMessage;
    this.onOpen = onOpen;
    this.backoffOptions = backoffOptions;
  }

  async connect() {
    await this.connectToWs();
    this.keepAliveWs();
  }

  close() {
    this.ws?.close()
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    this.ws?.send(data);
  }

  private async connectToWs() {

    this.ws = await backOff(
      () =>
        new Promise<WebSocket>((resolve, reject) => {
          const ws = new WebSocket(this.url);
          ws.addEventListener("error", (error) => {
            console.log("ReconnectingWS: got error, might recover", { error });
            reject(new Error("WS client error"));
          });
          ws.addEventListener("open", (event) => {
            console.log("ReconnectingWS: connected");

            this.onOpen?.(event)
            resolve(ws);
          });

          if (this.onMessage) {
            ws.addEventListener("message", this.onMessage);
          }
        }),
      this.backoffOptions,
    ).catch((error) => {
      console.error("ReconnectingWS: failed to reconnect, giving up", { error });
      throw new Error("WS failed to reconnect");
    });
  }

  private async keepAliveWs() {
    while (true) {
      await new Promise<void>((resolve) => {
        this.ws?.addEventListener("close", () => {
          console.log(
            "ReconnectingWS: connection closed, attempting reconnection",
          );
          resolve();
        });
      });

      await this.connectToWs();
    }
  }
}
