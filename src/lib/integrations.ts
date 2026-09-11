import type { WebhookProvider } from "../types/api";

export const INTEGRATION_PROVIDERS: Array<{
  id: WebhookProvider;
  name: string;
  description: string;
  setupHint: string;
}> = [
  {
    id: "slack",
    name: "Slack",
    description: "Post to a Slack channel",
    setupHint:
      "Slack → Apps → Incoming Webhooks → Add to Slack → copy the webhook URL.",
  },
  {
    id: "email",
    name: "Gmail / Email",
    description: "Email alerts to your inbox",
    setupHint: "Your Gmail + App Password. Mail is sent from your account.",
  },
  {
    id: "http",
    name: "Custom HTTP",
    description: "POST signed JSON to your API",
    setupHint: "Zapier, Make, or your own backend. Signing secret shown once.",
  },
];

export function providerLabel(id: string): string {
  return INTEGRATION_PROVIDERS.find((p) => p.id === id)?.name ?? id;
}

export function configSummary(provider: string, config: Record<string, unknown>): string {
  switch (provider) {
    case "slack":
      return String(config.webhookUrl ?? "—");
    case "email": {
      const from = config.smtpUser ? `From ${String(config.smtpUser)} → ` : "";
      const to = Array.isArray(config.recipients)
        ? (config.recipients as string[]).join(", ")
        : "—";
      return `${from}${to}`;
    }
    case "http":
      return String(config.url ?? "—");
    default:
      return "—";
  }
}
