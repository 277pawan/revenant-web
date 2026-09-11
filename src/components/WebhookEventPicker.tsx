import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { WEBHOOK_EVENTS, type WebhookEventType } from "../lib/webhook-events";

type Props = {
  value: WebhookEventType[];
  onChange: (events: WebhookEventType[]) => void;
  error?: string;
};

export function WebhookEventPicker({ value, onChange, error }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return WEBHOOK_EVENTS;
    return WEBHOOK_EVENTS.filter(
      (e) =>
        e.value.toLowerCase().includes(q) ||
        e.label.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q)
    );
  }, [query]);

  function toggle(event: WebhookEventType) {
    if (value.includes(event)) {
      onChange(value.filter((v) => v !== event));
    } else {
      onChange([...value, event]);
    }
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">Events</label>
      <div className="relative mb-2">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search events…"
          className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>
      <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-slate-500">No events match your search.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {filtered.map((event) => {
              const checked = value.includes(event.value);
              return (
                <li key={event.value}>
                  <label
                    className={`flex cursor-pointer gap-3 px-3 py-2.5 hover:bg-white ${
                      checked ? "bg-white" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(event.value)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900">
                        {event.label}
                        <span className="ml-2 font-mono text-xs font-normal text-slate-400">
                          {event.value}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {event.description}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {value.length > 0 && (
        <p className="mt-1.5 text-xs text-slate-500">
          {value.length} selected: {value.join(", ")}
        </p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
