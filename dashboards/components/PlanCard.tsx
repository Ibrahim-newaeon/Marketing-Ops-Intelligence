import { cn } from "@/lib/utils";
import { JsonTree } from "./JsonTree";

/**
 * Structured view of a StrategyPlan (the payload the Principal approves).
 * Renders the plan as readable HTML — budget totals, per-market channel
 * tables, KPIs, SEO/GEO/AEO strategies as collapsible <details> so
 * everything is in the DOM without modals.
 */

type Channel = {
  channel: string;
  budget_usd: number;
  pct_of_market: number;
  rationale: string;
  cap_ref?: string;
};

type Kpi = {
  name: string;
  target: number;
  unit: string;
};

type SeoStrategy = {
  target_keywords: string[];
  content_plan: string[];
};
type GeoStrategy = {
  target_engines: string[];
  target_prompts: string[];
};
type AeoStrategy = {
  target_surfaces: string[];
  schema_types: string[];
};

type Market = {
  market_id: string;
  country: string;
  language: string;
  budget_usd: number;
  channels: Channel[];
  seo_strategy: SeoStrategy;
  geo_strategy: GeoStrategy;
  aeo_strategy: AeoStrategy;
  kpis: Kpi[];
  regulated: boolean;
  missing_data: string[];
};

export type StrategyPlanShape = {
  run_id: string;
  version: string;
  produced_at: string;
  status: string;
  first_run: boolean;
  total_budget_usd: number;
  optimization?: {
    method: string;
    iterations: number;
    objective: string;
    expected_outcomes: Array<{
      market_id: string;
      channel: string;
      kpi: string;
      forecast: number;
      ref: string;
    }>;
  };
  markets: Market[];
  assumptions?: string[];
  missing_data?: string[];
};

function fmtUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function PlanCard({ plan }: { plan: StrategyPlanShape }): JSX.Element {
  const totalAllocated = plan.markets.reduce((acc, m) => acc + m.budget_usd, 0);
  const channelCount = plan.markets.reduce((acc, m) => acc + m.channels.length, 0);
  const regulatedCount = plan.markets.filter((m) => m.regulated).length;

  return (
    <article
      data-testid="plan-card"
      data-run-id={plan.run_id}
      className="rounded-lg border border-border bg-background p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
        <div>
          <h2 className="text-base font-semibold" data-testid="plan-card-title">
            Strategy plan · v{plan.version}
          </h2>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {plan.run_id}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            produced {new Date(plan.produced_at).toLocaleString()}
            {plan.first_run && (
              <span className="ml-2 rounded bg-muted px-1.5 py-[1px] text-[10px] font-semibold">
                first run
              </span>
            )}
          </p>
        </div>
        <div
          className={cn(
            "rounded-md border px-2 py-1 text-[11px] font-semibold",
            plan.status === "pending_approval" || plan.status === "ready_for_human_review"
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : plan.status === "approved"
                ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                : "border-border bg-muted"
          )}
          data-testid="plan-card-status"
        >
          {plan.status}
        </div>
      </header>

      <section className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <dl data-testid="plan-card-total-budget">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Total budget
          </dt>
          <dd className="text-sm font-semibold">{fmtUsd(plan.total_budget_usd)}</dd>
        </dl>
        <dl data-testid="plan-card-allocated">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Allocated
          </dt>
          <dd className="text-sm font-semibold">
            {fmtUsd(totalAllocated)}
            <span className="ml-1 text-[10px] text-muted-foreground">
              ({fmtPct(totalAllocated / (plan.total_budget_usd || 1))})
            </span>
          </dd>
        </dl>
        <dl data-testid="plan-card-markets">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Markets
          </dt>
          <dd className="text-sm font-semibold">{plan.markets.length}</dd>
        </dl>
        <dl data-testid="plan-card-channels">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Channels
          </dt>
          <dd className="text-sm font-semibold">{channelCount}</dd>
        </dl>
      </section>

      {regulatedCount > 0 && (
        <div
          className="mt-3 rounded border border-destructive/30 bg-destructive/5 px-2 py-1 text-[11px] text-destructive"
          data-testid="plan-card-regulated-note"
        >
          {regulatedCount} regulated market{regulatedCount === 1 ? "" : "s"} — legal review required before execution.
        </div>
      )}

      {plan.optimization && (
        <section className="mt-4" data-testid="plan-card-optimization">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Optimization
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            <span className="font-mono">{plan.optimization.method}</span> · {plan.optimization.iterations} iteration
            {plan.optimization.iterations === 1 ? "" : "s"} · objective{" "}
            <span className="font-mono">{plan.optimization.objective}</span>
          </p>
        </section>
      )}

      <section className="mt-4" data-testid="plan-card-market-list">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Per-market breakdown
        </h3>
        <div className="mt-2 space-y-3">
          {plan.markets.map((m) => (
            <MarketBlock key={m.market_id} market={m} />
          ))}
        </div>
      </section>

      {plan.assumptions && plan.assumptions.length > 0 && (
        <section className="mt-4" data-testid="plan-card-assumptions">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Assumptions
          </h3>
          <ul className="mt-1 list-inside list-disc text-[11px] text-muted-foreground">
            {plan.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
      )}

      {plan.missing_data && plan.missing_data.length > 0 && (
        <section className="mt-4" data-testid="plan-card-missing-data">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-destructive">
            Missing data
          </h3>
          <ul className="mt-1 list-inside list-disc text-[11px] text-destructive/90">
            {plan.missing_data.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function MarketBlock({ market }: { market: Market }): JSX.Element {
  const chanSum = market.channels.reduce((a, c) => a + c.budget_usd, 0);
  return (
    <div
      className="rounded-md border border-border bg-muted/20 p-3"
      data-testid={`plan-card-market-${market.market_id}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded bg-primary/10 px-1.5 py-[1px] font-mono text-[10px] font-semibold text-primary">
            {market.country}
          </span>
          <span className="text-sm font-semibold">{market.market_id}</span>
          <span className="text-[10px] text-muted-foreground">{market.language}</span>
          {market.regulated && (
            <span className="rounded bg-destructive/10 px-1 py-[1px] text-[10px] font-semibold text-destructive">
              regulated
            </span>
          )}
        </div>
        <div className="text-xs">
          <span className="font-semibold">{fmtUsd(market.budget_usd)}</span>
          <span className="ml-1 text-[10px] text-muted-foreground">
            ({market.channels.length} channel{market.channels.length === 1 ? "" : "s"})
          </span>
        </div>
      </header>

      <table className="mt-2 w-full text-[11px]">
        <thead className="text-[10px] uppercase text-muted-foreground">
          <tr className="border-b border-border">
            <th className="py-1 text-left font-medium">Channel</th>
            <th className="py-1 text-right font-medium">Budget</th>
            <th className="py-1 text-right font-medium">% of market</th>
            <th className="py-1 text-left font-medium">Rationale</th>
          </tr>
        </thead>
        <tbody>
          {market.channels.map((c, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              <td className="py-1 font-mono">{c.channel}</td>
              <td className="py-1 text-right font-mono">{fmtUsd(c.budget_usd)}</td>
              <td className="py-1 text-right text-muted-foreground">{fmtPct(c.pct_of_market)}</td>
              <td className="py-1 text-muted-foreground">{c.rationale}</td>
            </tr>
          ))}
          <tr className="bg-muted/40 font-semibold">
            <td className="py-1">Sum</td>
            <td className="py-1 text-right font-mono">{fmtUsd(chanSum)}</td>
            <td colSpan={2} />
          </tr>
        </tbody>
      </table>

      {market.kpis.length > 0 && (
        <div className="mt-2 text-[11px]">
          <span className="text-[10px] uppercase text-muted-foreground">KPIs: </span>
          {market.kpis.map((k, i) => (
            <span key={i} className="ml-1 inline-block rounded border border-border px-1 py-[1px] font-mono">
              {k.name}={k.target}
              {k.unit && k.unit !== "bool" ? k.unit : ""}
            </span>
          ))}
        </div>
      )}

      <details className="mt-2">
        <summary className="cursor-pointer text-[10px] uppercase text-muted-foreground hover:text-foreground">
          SEO · GEO · AEO strategies
        </summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground">SEO keywords</div>
            <ul className="mt-0.5 list-inside list-disc text-[10px]">
              {market.seo_strategy.target_keywords.slice(0, 8).map((k, i) => (
                <li key={i} className="truncate">{k}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground">GEO engines + prompts</div>
            <div className="mt-0.5 text-[10px]">{market.geo_strategy.target_engines.join(", ")}</div>
            <ul className="mt-1 list-inside list-disc text-[10px]">
              {market.geo_strategy.target_prompts.slice(0, 4).map((k, i) => (
                <li key={i} className="truncate">{k}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground">AEO surfaces + schemas</div>
            <div className="mt-0.5 text-[10px]">{market.aeo_strategy.target_surfaces.join(", ")}</div>
            <div className="mt-1 text-[10px] font-mono text-muted-foreground">
              {market.aeo_strategy.schema_types.join(" · ")}
            </div>
          </div>
        </div>
      </details>

      {market.missing_data.length > 0 && (
        <div className="mt-2 text-[10px] text-destructive">
          Missing: {market.missing_data.join(" · ")}
        </div>
      )}
    </div>
  );
}

/**
 * Render JSON that isn't a StrategyPlan. Falls back to JsonTree.
 */
export function UnstructuredPlanFallback({ content }: { content: unknown }): JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="mb-2 text-xs text-muted-foreground">
        Plan artifact doesn't match the StrategyPlan shape — showing raw JSON:
      </p>
      <JsonTree value={content} defaultOpenDepth={2} />
    </div>
  );
}

export function isStrategyPlanShape(v: unknown): v is StrategyPlanShape {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.run_id === "string" &&
    typeof o.version === "string" &&
    Array.isArray(o.markets) &&
    typeof o.total_budget_usd === "number"
  );
}
