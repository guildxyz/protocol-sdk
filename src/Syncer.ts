import { DataPointError } from "./DataPointError";
import { EventsClient } from "./EventsClient";
import {
  Configuration,
  Data,
  DataPointEvent,
  DataPointEventWithMethods,
} from "./types";
import { createClient } from "redis";

const DEFAULT_PROTOCOL_URL = "https://api.protocol.guild-api.xyz";
const CONFIGURATION_CACHE_EX = 60 * 60; // 1 hour

export class Syncer {
  private eventsClient: EventsClient;
  private protocolUrl: string;
  private protocolAdminKey: string;
  private redisClient?: ReturnType<typeof createClient>;
  private cachePrefix?: string;

  constructor(params: SyncerParams) {
    this.protocolUrl = params.protocolUrl ?? DEFAULT_PROTOCOL_URL;
    this.protocolAdminKey = params.protocolAdminKey;
    this.redisClient = params.redisClient;
    this.cachePrefix = params.cachePrefix;
    this.eventsClient = new EventsClient({
      protocolWsUrl: params.protocolWsUrl,
      subscriptionID: params.subscriptionID,
      subscriptionKey: params.subscriptionKey,
      handler: async (msg) => {
        // skip in case the subscription is misconfigured
        if (
          msg.event.kind !== "data_point_create" &&
          msg.event.kind !== "data_point_update"
        ) {
          msg.ack();
          return;
        }
        const event = msg.event as DataPointEvent;
        if (event.data.status === "synced") {
          msg.ack();
          return;
        }
        const eventWithMethods: DataPointEventWithMethods = {
          ...event,
          getConfiguration: async () => {
            return this.getConfiguration(event.data.configurationId);
          },
          updateDataPoint: async (data) => {
            await this.updateDataPoint(
              event.data.integrationId,
              event.data.configurationId,
              event.data.identityType,
              event.data.accountId,
              data,
            );
          },
        };
        try {
          await params.dataPointHandler(eventWithMethods);
          msg.ack();
        } catch (error) {
          console.log("Syncer: error", error);
          let dpError: DataPointError;
          if (error instanceof DataPointError) {
            dpError = error;
          } else {
            dpError = DataPointError.defaultFromError(error as Error);
          }
          if (!dpError.retryable || msg.attempt == msg.maxAttempts) {
            await this.updateDataPointWithError(
              event.data.integrationId,
              event.data.configurationId,
              event.data.identityType,
              event.data.accountId,
              dpError,
            );
            msg.term();
          } else {
            msg.nak();
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

  public async getConfiguration<ConfigurationData>(
    configurationId: string,
  ): Promise<Configuration<ConfigurationData>> {
    if (!this.redisClient) {
      return this.getConfigurationFromApi(configurationId);
    }

    const redisKey = `${this.cachePrefix ? this.cachePrefix + ":" : ""}configuration:${configurationId}`;

    const fromCache = await this.redisClient.get(redisKey);
    if (fromCache) {
      return JSON.parse(fromCache);
    }

    const fromApi =
      await this.getConfigurationFromApi<ConfigurationData>(configurationId);
    await this.redisClient.set(redisKey, JSON.stringify(fromApi), {
      EX: CONFIGURATION_CACHE_EX,
    });

    return fromApi;
  }

  private async getConfigurationFromApi<ConfigurationData>(
    configurationId: string,
  ): Promise<Configuration<ConfigurationData>> {
    const res = await fetch(
      `${this.protocolUrl}/api/v1/configurations/${configurationId}`,
      {
        headers: {
          Authorization: `API_KEY ${this.protocolAdminKey}`,
        },
      },
    );
    if (res.status !== 200) {
      throw new Error(
        `Failed to fetch configuration: ${res.status} ${await res.text()}`,
      );
    }
    return await res.json();
  }

  public async updateDataPoint(
    integrationId: string,
    configurationId: string,
    identityType: string,
    accountId: string,
    data: Data,
  ) {
    const ops = [];
    for (const [key, value] of Object.entries(data)) {
      ops.push({
        op: "set",
        field: key,
        value,
      });
    }
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
          ops,
        }),
      },
    );

    if (res.status >= 400) {
      throw new Error(
        "Failed to update data point: " + res.status + " " + (await res.text()),
      );
    }
  }

  private async updateDataPointWithError(
    integrationId: string,
    configurationId: string,
    identityType: string,
    accountId: string,
    error: DataPointError,
  ) {
    const data = {
      error_type: error.type,
      error_message: error.msg,
    };
    try {
      this.updateDataPoint(
        integrationId,
        configurationId,
        identityType,
        accountId,
        data,
      );
    } catch (e) {
      console.log("Failed to update data point with error", e);
    }
  }
}

export type DataPointHandler = (
  data: DataPointEventWithMethods,
) => Promise<void>;

export type SyncerParams = {
  subscriptionID: string;
  subscriptionKey: string;
  dataPointHandler: DataPointHandler;
  protocolWsUrl?: string;
  protocolUrl?: string;
  protocolAdminKey: string;
  redisClient?: ReturnType<typeof createClient>;
  cachePrefix?: string;
};
