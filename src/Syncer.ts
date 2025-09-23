import { DataPointError } from "./DataPointError";
import { EventsClient } from "./EventsClient";
import { DataPointEvent } from "./types";

const DEFAULT_PROTOCOL_URL = "https://api.protocol.guild-api.xyz";

export class Syncer {
  private eventsClient: EventsClient;
  private protocolUrl: string;
  private protocolAdminKey: string;

  constructor(params: SyncerParams) {
    this.protocolUrl = params.customProtocolUrl ?? DEFAULT_PROTOCOL_URL;
    this.protocolAdminKey = params.protocolAdminKey;
    this.eventsClient = new EventsClient({
      customProtocolWsUrl: params.customProtocolWsUrl,
      subscriptionID: params.subscriptionID,
      subscriptionKey: params.subscriptionKey,
      handler: async (data) => {
        // skip in case the subscription is misconfigured
        if (
          data.event.kind !== "data_point_create" &&
          data.event.kind !== "data_point_update"
        ) {
          return;
        }
        const event = data.event as DataPointEvent;
        if (event.data.status === "synced") {
          return;
        }
        try {
          await params.dataPointHandler(event);
          data.ack();
        } catch (error) {
          console.log("Syncer: error", error)
          let dpError: DataPointError;
          if (error instanceof DataPointError) {
            dpError = error;
          } else {
            dpError = DataPointError.defaultFromError(error as Error);
          }
          if (!dpError.retryable || data.attempt == data.maxAttempts) {
            await this.updateDataPointWithError(
              event.data.integrationId,
              event.data.configurationId,
              event.data.accountId,
              event.data.identityType,
              dpError,
            );
            data.term();
          } else {
            data.nak();
          }
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

  private async updateDataPointWithError(
    integrationId: string,
    configurationId: string,
    accountId: string,
    identityType: string,
    error: DataPointError,
  ) {
    const res = await fetch(
      `${this.protocolUrl}/api/v1/integrations/${integrationId}/data-points`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `API_KEY ${this.protocolAdminKey}`,
        },
        body: JSON.stringify({
          configuration: { id: configurationId },
          identity: {
            identity_id: accountId,
            identity_type: identityType,
          },
          integration_id: integrationId,
          ops: [
            {
              op: "set",
              field: "error_type",
              value: error.type,
            },
            {
              op: "set",
              field: "error_message",
              value: error.msg,
            },
          ],
        }),
      },
    );

    if (res.status >= 400) {
      console.log(
        "updateDataPointWithError error",
        res.status,
        await res.text(),
      );
    }
  }
}

export type SyncerParams = {
  subscriptionID: string;
  subscriptionKey: string;
  dataPointHandler: (data: DataPointEvent) => Promise<void>;
  customProtocolWsUrl?: string;
  customProtocolUrl?: string;
  protocolAdminKey: string;
};
