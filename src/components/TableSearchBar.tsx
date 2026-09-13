import { Search } from "lucide-react";

type TableSearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function TableSearchBar({
  value,
  onChange,
  placeholder = "Search…",
  className = "",
}: TableSearchBarProps) {
  return (
    <div
      className={`flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 ${className}`}
    >
      <div className="relative min-w-[220px] flex-1 max-w-md">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          aria-label="Search table"
        />
      </div>
    </div>
  );
}
