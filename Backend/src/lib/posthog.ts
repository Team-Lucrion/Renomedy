import { PostHog } from "posthog-node";
import { env } from "../config/env";
import { logger } from "../config/logger";

let posthogClient: PostHog | null = null;

export function isPostHogEnabled() {
  return env.POSTHOG_ENABLED.toLowerCase() === "true" && Boolean(env.POSTHOG_API_KEY);
}

export function getPostHogClient() {
  if (!isPostHogEnabled()) {
    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(env.POSTHOG_API_KEY!, {
      host: env.POSTHOG_HOST
    });

    logger.info("PostHog enabled");
  }

  return posthogClient;
}

type CaptureServerEventInput = {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
};

export function captureServerEvent(input: CaptureServerEventInput) {
  const client = getPostHogClient();
  if (!client) {
    return;
  }

  client.capture({
    distinctId: input.distinctId,
    event: input.event,
    properties: input.properties
  });
}

export async function shutdownPostHog() {
  if (!posthogClient) {
    return;
  }

  await posthogClient.shutdown();
  posthogClient = null;
}
