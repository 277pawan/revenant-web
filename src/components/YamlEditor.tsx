import { useMemo, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import yaml from "js-yaml";

import { load as yamlLoad, dump as yamlDump } from "js-yaml";

type YamlEditorProps = {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  height?: string;
};

export function formatYaml(text: string): string {
  const doc = yamlLoad(text);
  return yamlDump(doc, {
    indent: 2,
    lineWidth: 100,
    noRefs: true,
    sortKeys: false,
  });
}

export function parseYamlChecks(text: string): {
  ok: boolean;
  error?: string;
  checks: Array<{ type: string }>;
} {
  try {
    const doc = yamlLoad(text) as { checks?: Array<{ type?: string }> } | null;
    if (!doc || typeof doc !== "object") {
      return { ok: false, error: "YAML must be a mapping/object", checks: [] };
    }
    const checks = Array.isArray(doc.checks)
      ? doc.checks
          .filter(
            (c) => c && typeof c === "object" && typeof c.type === "string",
          )
          .map((c) => ({ type: String(c.type) }))
      : [];
    return { ok: true, checks };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Invalid YAML",
      checks: [],
    };
  }
}

export function YamlEditor({
  value,
  onChange,
  readOnly = false,
  height = "360px",
}: YamlEditorProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const onMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  return (
    <div className="overflow-hidden rounded-md border border-slate-300">
      <Editor
        height={height}
        defaultLanguage="yaml"
        theme="vs"
        value={value}
        onChange={(v) => onChange(v ?? "")}
        onMount={onMount}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: '"JetBrains Mono", ui-monospace, Menlo, monospace',
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          tabSize: 2,
          automaticLayout: true,
          renderWhitespace: "selection",
        }}
      />
    </div>
  );
}

export function useYamlPreview(text: string) {
  return useMemo(() => parseYamlChecks(text), [text]);
}
