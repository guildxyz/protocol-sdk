import { DataPointError } from "./DataPointError";
import { EventsClient } from "./EventsClient";
import { DataPointEvent } from "./types";

export type SyncerParams = {
  subscriptionID: string;
  subscriptionKey: string;
  dataPointHandler: (data: DataPointEvent) => Promise<void>;
  customProtocolWsUrl?: string;
};

export class Syncer {
  private eventsClient: EventsClient;

  constructor(params: SyncerParams) {
    this.eventsClient = new EventsClient({
      customProtocolWsUrl: params.customProtocolWsUrl,
      subscriptionID: params.subscriptionID,
      subscriptionKey: params.subscriptionKey,
      handler: async (data) => {
        // skip in case the subscription is misconfigured
        if (
          (data.event.kind !== "data_point_create" &&
            data.event.kind !== "data_point_update") ||
          (data.event as DataPointEvent).data.status === "synced"
        ) {
          return;
        }
        try {
          await params.dataPointHandler(data.event);
          data.ack();
        } catch (error) {
          let dpError: DataPointError;
          if (error instanceof DataPointError) {
            dpError = error;
          } else {
            dpError = DataPointError.defaultFromError(error as Error);
          }
          if (!dpError.retryable || data.attempt == data.maxAttempts) {
            data.term();
          }
          data.nak();
        }
      },
    });
  }

  public start() {
    this.eventsClient.start();
  }

  public stop() {
    this.eventsClient.stop();
  }
}
