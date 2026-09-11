/** Must match API `webhooks.schema.ts` webhookEventSchema */
export type WebhookEventType = "job.pass" | "job.fail" | "job.error";

export const WEBHOOK_EVENTS: Array<{
  value: WebhookEventType;
  label: string;
  description: string;
}> = [
  {
    value: "job.pass",
    label: "Job passed",
    description: "Validation run completed successfully — all checks passed.",
  },
  {
    value: "job.fail",
    label: "Job failed",
    description: "Validation run finished but one or more checks failed.",
  },
  {
    value: "job.error",
    label: "Job error",
    description: "Run could not complete (agent/connection/runtime error).",
  },
];
