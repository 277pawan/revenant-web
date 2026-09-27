import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Calendar,
  Database,
  FileCheck,
  LayoutDashboard,
  PlayCircle,
  Shield,
  Sparkles,
} from "lucide-react";

export type ProductGuideStep = {
  id: string;
  title: string;
  summary: string;
  detail: string;
  icon: LucideIcon;
  target: string;
  /** Optional deep link — wizard explains only; user navigates themselves */
  href?: string;
  hrefLabel?: string;
};

export const PRODUCT_GUIDE_STEPS: ProductGuideStep[] = [
  {
    id: "welcome",
    title: "Welcome to Revenant Cloud",
    summary: "Prove backups actually restore — before an outage.",
    detail:
      "Revenant runs managed restore drills on your databases, measures how long recovery takes, and stores signed evidence you can share with leadership or auditors. This guide walks through how the product fits together.",
    icon: Sparkles,
    target: "dashboard-hero",
  },
  {
    id: "dashboard",
    title: "Your dashboard",
    summary: "See fleet health at a glance.",
    detail:
      "Green means the last drill passed. Amber means something needs attention (no schedule, stale drill). Red means failed checks or missing configuration. KPI cards show pass rate, average recovery time, and evidence count.",
    icon: LayoutDashboard,
    target: "dashboard-metrics",
    href: "/",
    hrefLabel: "Open dashboard",
  },
  {
    id: "database",
    title: "Register a database",
    summary: "One connection = one protected workflow.",
    detail:
      "Add AWS RDS or direct Postgres. Credentials are encrypted server-side. Start with the AWS free-tier sample if you want a guided first workflow without touching production.",
    icon: Database,
    target: "nav-databases",
    href: "/databases/new?sample=aws-freetier",
    hrefLabel: "Add database",
  },
  {
    id: "validation",
    title: "Validation plan",
    summary: "Define what “healthy” means after restore.",
    detail:
      "YAML checks run after every drill: schema, row counts, SQL queries, freshness, and optional HTTP health on your API. The plan is separate from your recovery contract (RTO/RPO targets).",
    icon: Shield,
    target: "nav-validation-plans",
    href: "/settings/validation-plans",
    hrefLabel: "Validation plans",
  },
  {
    id: "drill",
    title: "Run a restore drill",
    summary: "Snapshot → sandbox → verify → cleanup (AWS).",
    detail:
      "Revenant Cloud executes the drill for Starter plans — no Docker agent required. Each run records recovery time (RTO), check results, and generates downloadable evidence.",
    icon: PlayCircle,
    target: "nav-workflows",
    href: "/workflows",
    hrefLabel: "Restore drills",
  },
  {
    id: "http",
    title: "Database + API health",
    summary: "Prove the app answers after restore.",
    detail:
      "Set recovery.application.healthcheck in your contract, or add http_health checks to the validation plan. After DB checks pass, Revenant pings your API and includes results in the run.",
    icon: Shield,
    target: "dashboard-run-drill",
    href: "/workflows",
    hrefLabel: "Workflow command center",
  },
  {
    id: "evidence",
    title: "Evidence & share proof",
    summary: "One click to download PDF and copy a manager summary.",
    detail:
      "Every finished drill produces signed JSON and a branded PDF. Use “Share with manager” on a run to copy a Slack-ready message and download the certificate in one step.",
    icon: FileCheck,
    target: "nav-evidence",
    href: "/evidence",
    hrefLabel: "Evidence vault",
  },
  {
    id: "schedule",
    title: "Schedule automatic drills",
    summary: "Set weekly proof and forget.",
    detail:
      "Pick a workflow, choose daily or weekly timing, and Revenant runs drills on autopilot. Failed runs show up on the dashboard and can alert your team.",
    icon: Calendar,
    target: "nav-schedules",
    href: "/schedules",
    hrefLabel: "Schedules",
  },
  {
    id: "alerts",
    title: "Slack & email alerts",
    summary: "Hear about failures without opening the app.",
    detail:
      "Connect Slack, email, or a custom HTTP webhook under Integrations. Subscribe to pass, fail, and contract-breach events. Send a test alert to verify delivery.",
    icon: Bell,
    target: "nav-webhooks",
    href: "/settings/webhooks",
    hrefLabel: "Integrations",
  },
];
