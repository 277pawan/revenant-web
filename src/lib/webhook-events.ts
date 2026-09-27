/** Must match API `webhooks.schema.ts` webhookEventSchema */
export type WebhookEventType =
  | "job.pass"
  | "job.fail"
  | "job.error"
  | "contract.breach"
  | "contract.regression";

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
  {
    value: "contract.breach",
    label: "Contract breach",
    description:
      "Drill passed checks but RTO or RPO exceeded targets in your recovery contract.",
  },
  {
    value: "contract.regression",
    label: "Recovery regression",
    description:
      "Drill passed but RTO, RPO, or readiness score worsened vs the previous passing drill.",
  },
];
