import { test, expect } from "vitest";
import { Syncer } from "./Syncer";
import dotenv from "dotenv";
import { createClient } from "redis";

test("getConfiguration", async () => {
  dotenv.config();
  const apiKey = process.env.PROTOCOL_ADMIN_KEY;
  if (!apiKey) {
    throw new Error("Missing PROTOCOL_ADMIN_KEY for this test");
  }
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("Missing REDIS_URL for this test");
  }
  const redisClient = createClient({ url: redisUrl });
  await redisClient.connect();

  const s = new Syncer({
    protocolAdminKey: apiKey,
    dataPointHandler: async () => { },
    subscriptionID: "test",
    subscriptionKey: "test",
    redisClient: redisClient,
    cachePrefix: "test",
  });

  type DiscordMemberConfig = {
    server_id: string;
  };
  const config = await s.getConfiguration<DiscordMemberConfig>(
    "8a9514c4fcd08ec07745d0e490d79c849af6e4f1cb82bf0c24a4cab058933d31",
  );
  expect(config?.data?.server_id).toBe("697041998728659035");
});

test("updateDataPoint", async () => {
  dotenv.config();
  const apiKey = process.env.PROTOCOL_ADMIN_KEY;
  if (!apiKey) {
    throw new Error("Missing PROTOCOL_ADMIN_KEY for this test");
  }

  const s = new Syncer({
    protocolAdminKey: apiKey,
    dataPointHandler: async () => { },
    subscriptionID: "test",
    subscriptionKey: "test",
  });

  await s.updateDataPoint(
    "DISCORD_MEMBER",
    "8a9514c4fcd08ec07745d0e490d79c849af6e4f1cb82bf0c24a4cab058933d31",
    "DISCORD",
    "398115483590852620",
    {
      roles: ["747865765243387960"],
      nickname: "",
      is_member: true,
      joined_at: 1751965799928,
      premium_since: null,
    },
  );
});
