import { cn } from "@/lib/utils";

/**
 * Recursive JSON viewer. Uses native <details>/<summary> so everything
 * is in the DOM — no JS click-to-open, screen-reader friendly, printable.
 * Initially collapsed past depth 1 to keep long artifacts readable;
 * consumer can override with `defaultOpenDepth`.
 */
export interface JsonTreeProps {
  value: unknown;
  name?: string;
  defaultOpenDepth?: number;
  depth?: number;
  testId?: string;
}

function typeOf(v: unknown): "object" | "array" | "string" | "number" | "boolean" | "null" {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v as "object" | "string" | "number" | "boolean";
}

function Primitive({ value }: { value: unknown }): JSX.Element {
  const t = typeOf(value);
  const className =
    t === "string"
      ? "text-emerald-700"
      : t === "number"
        ? "text-amber-700"
        : t === "boolean"
          ? "text-blue-700"
          : "text-muted-foreground italic";
  return (
    <span className={className}>
      {t === "string" ? `"${value as string}"` : String(value)}
    </span>
  );
}

export function JsonTree({
  value,
  name,
  defaultOpenDepth = 1,
  depth = 0,
  testId,
}: JsonTreeProps): JSX.Element {
  const t = typeOf(value);

  if (t !== "object" && t !== "array") {
    return (
      <div className="flex items-baseline gap-2 py-0.5 text-xs font-mono">
        {name !== undefined && (
          <span className="text-foreground">{name}:</span>
        )}
        <Primitive value={value} />
      </div>
    );
  }

  const entries =
    t === "array"
      ? (value as unknown[]).map((v, i) => [String(i), v] as const)
      : Object.entries(value as Record<string, unknown>);

  const openByDefault = depth < defaultOpenDepth;
  const count = entries.length;
  const summary =
    t === "array" ? `Array · ${count} item${count === 1 ? "" : "s"}` : `${count} field${count === 1 ? "" : "s"}`;

  return (
    <details
      open={openByDefault}
      data-testid={testId}
      className="group"
    >
      <summary
        className={cn(
          "cursor-pointer select-none rounded px-1 py-0.5 text-xs font-mono",
          "hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
          "marker:text-muted-foreground"
        )}
      >
        {name !== undefined ? (
          <>
            <span className="text-foreground">{name}</span>
            <span className="ml-2 text-[10px] text-muted-foreground">{summary}</span>
          </>
        ) : (
          <span className="text-[10px] text-muted-foreground">{summary}</span>
        )}
      </summary>
      <ul className="ml-3 border-l border-border pl-3">
        {count === 0 && (
          <li className="text-[10px] italic text-muted-foreground">empty</li>
        )}
        {entries.map(([k, v]) => (
          <li key={k}>
            <JsonTree
              value={v}
              name={k}
              defaultOpenDepth={defaultOpenDepth}
              depth={depth + 1}
            />
          </li>
        ))}
      </ul>
    </details>
  );
}
