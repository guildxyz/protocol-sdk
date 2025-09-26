import { EventsClient } from "./EventsClient";

export type ServerToClientMsgRaw = {
  attempt: number;
  max_attempts: number;
  reply_subject: string;
  event: DataPointEventRaw | GroupAccessEventRaw;
};

type DataPointRaw = {
  id: string;
  user_id: string;
  account_id: string;
  identity_type: string;
  configuration_id: string;
  integration_id: string;
  priority: number;
  status: "initiated" | "data_required" | "synced";
  data: any;
  created_at: Date;
  updated_at: Date;
  read_at: Date;
  successful_updated_at: Date;
};

type Attribute = {
  key: string;
  value: string;
};

type DataPointEventRaw = {
  kind: "data_point_create" | "data_point_update";
  priority: 1 | 2;
  correlation_id: string;
  attributes: Attribute[];
  data: DataPointRaw;
};

type GroupAccessEventRaw = {
  kind: "group_access_update";
  priority: 1 | 2;
  correlation_id: string;
  attributes: Attribute[];
  data: {
    group_access: {
      user_id: string;
      group_id: string;
      has_access: boolean;
      created_at: Date;
      updated_at: Date;
    };
    rule_accesses: {
      rule_access: boolean;
      rule_id: string;
      data_points: DataPointRaw[];
    }[];
    error?: {
      message: string
    }
  };
};

export type DataPoint = {
  id: string;
  userId: string;
  accountId: string;
  identityType: string;
  configurationId: string;
  integrationId: string;
  priority: number; // data point level priority
  status: "initiated" | "data_required" | "synced";
  data: any;
  createdAt: Date;
  updatedAt: Date;
  readAt: Date;
  successfulUpdatedAt: Date;
};

export type DataPointEvent = {
  kind: "data_point_create" | "data_point_update";
  priority: 1 | 2; // event level priority
  correlationId: string;
  attributes: Attribute[];
  data: DataPoint;
};

export type GroupAccessEvent = {
  kind: "group_access_update";
  priority: 1 | 2;
  correlationId: string;
  attributes: Attribute[];
  data: {
    groupAccess: {
      userId: string;
      groupId: string;
      hasAccess: boolean;
      createdAt: Date;
      updatedAt: Date;
    };
    ruleAccesses: {
      ruleAccess: boolean;
      ruleId: string;
      dataPoints: DataPoint[];
    }[];
    error?: {
      message: string
    }
  };
};

export class ServerToClientMsg {
  public attempt: number;
  public maxAttempts: number;
  public event: DataPointEvent | GroupAccessEvent | any;
  private replySubject: string;
  private eventsClient: EventsClient;
  constructor(eventsClient: EventsClient, params: ServerToClientMsgRaw) {
    this.eventsClient = eventsClient;
    this.attempt = params.attempt;
    this.maxAttempts = params.max_attempts;
    this.replySubject = params.reply_subject;
    if (
      params.event.kind === "data_point_create" ||
      params.event.kind === "data_point_update"
    ) {
      this.event = parseDataPointEvent(params.event);
    } else if (params.event.kind === "group_access_update") {
      this.event = parseGroupAccessEvent(params.event);
    } else {
      // unhandled event type
      this.event = params.event;
    }
  }

  public ack() {
    this.eventsClient.send({
      signal: "ACK",
      replySubject: this.replySubject,
    });
  }

  public nak(delayMs?: number) {
    this.eventsClient.send({
      signal: "NAK",
      replySubject: this.replySubject,
      delayMs: delayMs,
    });
  }

  public term() {
    this.eventsClient.send({
      signal: "TERM",
      replySubject: this.replySubject,
    });
  }
}

function parseDataPoint(dp: DataPointRaw): DataPoint {
  return {
    id: dp.id,
    userId: dp.user_id,
    accountId: dp.account_id,
    identityType: dp.identity_type,
    configurationId: dp.configuration_id,
    integrationId: dp.integration_id,
    priority: dp.priority,
    status: dp.status,
    data: dp.data,
    createdAt: dp.created_at,
    updatedAt: dp.updated_at,
    readAt: dp.read_at,
    successfulUpdatedAt: dp.successful_updated_at,
  };
}

function parseDataPointEvent(msg: DataPointEventRaw): DataPointEvent {
  return {
    kind: msg.kind,
    priority: msg.priority,
    correlationId: msg.correlation_id,
    attributes: msg.attributes,
    data: parseDataPoint(msg.data),
  };
}

function parseGroupAccessEvent(msg: GroupAccessEventRaw): GroupAccessEvent {
  return {
    kind: msg.kind,
    priority: msg.priority,
    correlationId: msg.correlation_id,
    attributes: msg.attributes,
    data: {
      groupAccess: {
        userId: msg.data.group_access.user_id,
        groupId: msg.data.group_access.group_id,
        hasAccess: msg.data.group_access.has_access,
        createdAt: msg.data.group_access.created_at,
        updatedAt: msg.data.group_access.updated_at,
      },
      ruleAccesses: msg.data.rule_accesses?.map((ra) => ({
        ruleAccess: ra.rule_access,
        ruleId: ra.rule_id,
        dataPoints: ra.data_points?.map((dp) => parseDataPoint(dp)),
      })),
      error: msg.data.error
    },
  };
}

export type ClientToServerMsgRaw = {
  signal: "ACK" | "NAK" | "TERM" | "STOP";
  reply_subject?: string;
  delay_ms?: number;
};

export type ClientToServerMsg = {
  signal: "ACK" | "NAK" | "TERM" | "STOP";
  replySubject?: string;
  delayMs?: number;
};

export function clientToServerMsgToRaw(
  msg: ClientToServerMsg,
): ClientToServerMsgRaw {
  return {
    signal: msg.signal,
    reply_subject: msg.replySubject,
    delay_ms: msg.delayMs,
  };
}
