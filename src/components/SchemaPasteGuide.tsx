import { useState } from "react";
import { Copy, Check } from "lucide-react";

export type SchemaGuideTab = "prisma" | "drizzle" | "sql" | "rails" | "mongodb";

const GUIDES: Record<
  SchemaGuideTab,
  { title: string; bullets: string[]; command?: string }
> = {
  prisma: {
    title: "Prisma Help",
    bullets: [
      "Run the following terminal command to extract your local database schema:",
      "Copy the contents of the generated schema.prisma file and paste it into the editor area above.",
    ],
    command: "npx prisma db pull",
  },
  drizzle: {
    title: "Drizzle Help",
    bullets: [
      "Paste src/db/schema.ts (pgTable, relations) from your repo.",
      "Or paste one SQL file from drizzle/migrations/ — CREATE TABLE statements only.",
    ],
    command: "cat src/db/schema.ts",
  },
  sql: {
    title: "SQL Help",
    bullets: [
      "Export structure only — no INSERT row data.",
      "Paste CREATE TABLE / INDEX / CONSTRAINT output into the schema area above.",
    ],
    command:
      'pg_dump "$DATABASE_URL" --schema-only --no-owner --no-privileges',
  },
  rails: {
    title: "Rails Help",
    bullets: [
      "Paste db/schema.rb or db/structure.sql from your Rails app.",
      "Laravel: use schema dump or a migration with CREATE TABLE.",
    ],
    command: "cat db/schema.rb",
  },
  mongodb: {
    title: "MongoDB Help",
    bullets: [
      "The selected MongoDB database sets the YAML engine and MongoDB check types automatically.",
      "Paste a collection's MongoDB JSON Schema validator from Atlas, or a few representative documents after removing personal data.",
      "In Atlas, open Database → Collections → your collection → Validation to find a declared validator. If none exists, document samples only suggest possible fields and BSON types.",
      "Never paste a connection URI, password, or real customer documents. The composer drafts YAML from the structure you provide; it does not connect to Atlas to discover collections.",
    ],
  },
};

const TAB_LABELS: Record<SchemaGuideTab, string> = {
  prisma: "Prisma Help",
  drizzle: "Drizzle",
  sql: "SQL",
  rails: "Rails",
  mongodb: "MongoDB",
};

type SchemaPasteGuideProps = {
  activeTab: SchemaGuideTab;
  onTabChange: (tab: SchemaGuideTab) => void;
  engine: "sql" | "mongodb";
};

export function SchemaPasteGuide({
  activeTab,
  onTabChange,
  engine,
}: SchemaPasteGuideProps) {
  const [copied, setCopied] = useState(false);
  const guide = GUIDES[activeTab];

  async function copyCommand() {
    if (!guide.command) return;
    await navigator.clipboard.writeText(guide.command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const tabs: SchemaGuideTab[] =
    engine === "mongodb"
      ? ["mongodb"]
      : ["prisma", "drizzle", "sql", "rails"];

  return (
    <div className="rounded-lg border border-slate-100 bg-white p-3">
      <div className="flex gap-4 border-b border-slate-100 pb-1.5 text-xs">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={
              tab === activeTab
                ? "font-bold text-brand"
                : "font-medium text-slate-500 hover:text-slate-700"
            }
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>
      <div className="mt-2.5 space-y-1 text-xs text-slate-700">
        {guide.bullets.map((line, i) => (
          <p key={i}>• {line}</p>
        ))}
        {guide.command && (
          <div className="relative mt-1">
            <pre className="overflow-x-auto rounded bg-slate-50 px-2 py-2 font-mono text-[11px] text-slate-900">
              {guide.command}
            </pre>
            <button
              type="button"
              onClick={() => void copyCommand()}
              className="absolute right-1.5 top-1.5 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              title="Copy command"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Small links above the schema box for supported schema formats. */
export function SchemaSourceTabs({
  active,
  onChange,
  engine,
}: {
  active: SchemaGuideTab;
  onChange: (tab: SchemaGuideTab) => void;
  engine: "sql" | "mongodb";
}) {
  const items: Array<{ id: SchemaGuideTab; label: string }> =
    engine === "mongodb"
      ? [{ id: "mongodb", label: "MongoDB" }]
      : [
          { id: "prisma", label: "Prisma" },
          { id: "drizzle", label: "Drizzle" },
          { id: "sql", label: "SQL" },
          { id: "rails", label: "Rails" },
        ];
  return (
    <div className="flex gap-1.5 text-[11px]">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={
            item.id === active
              ? "font-semibold text-brand"
              : "text-slate-400 hover:text-slate-600"
          }
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
