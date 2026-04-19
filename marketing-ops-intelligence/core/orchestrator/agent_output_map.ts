/**
 * Runtime map from agent name → Zod output schema.
 * The dispatcher converts the Zod schema to a JSON schema, passes it as
 * the single tool `emit_output` with strict:true, and forces the model
 * to call it — guaranteeing structured output matching the agent's
 * contract.
 */
import type { z } from "zod";
import {
  OrchestratorStep,
  MemoryContext,
  MemoryUpdateResult,
  MarketResearchReport,
  CompetitorIntelReport,
  AudienceInsightsReport,
  KeywordResearchReport,
  StrategyPlanDraft,
  AllocatedPlan,
  StrategyPlan,
  ApprovalHandoff,
  LegalReviewReport,
  MetaExecutionReport,
  GenericPaidExecutionReport,
  SeoExecutionReport,
  GeoExecutionReport,
  AeoExecutionReport,
  AnomalyReport,
  PerformanceSnapshot,
  StructuredReport,
  DashboardPayload,
  ResolvedClientContext,
} from "../schemas";

export const AGENT_OUTPUT_SCHEMAS: Record<string, z.ZodTypeAny> = {
  client_resolver_agent: ResolvedClientContext,
  orchestrator: OrchestratorStep,
  memory_retrieval_agent: MemoryContext,
  memory_update_agent: MemoryUpdateResult,
  market_research_agent: MarketResearchReport,
  competitor_intel_agent: CompetitorIntelReport,
  audience_insights_agent: AudienceInsightsReport,
  keyword_research_agent: KeywordResearchReport,
  strategy_planner_agent: StrategyPlanDraft,
  multi_market_allocator_agent: AllocatedPlan,
  budget_optimizer_agent: StrategyPlan,
  approval_manager_agent: ApprovalHandoff,
  legal_review_agent: LegalReviewReport,
  meta_execution_agent: MetaExecutionReport,
  google_execution_agent: GenericPaidExecutionReport,
  snap_execution_agent: GenericPaidExecutionReport,
  tiktok_execution_agent: GenericPaidExecutionReport,
  seo_execution_agent: SeoExecutionReport,
  geo_execution_agent: GeoExecutionReport,
  aeo_execution_agent: AeoExecutionReport,
  anomaly_detection_agent: AnomalyReport,
  performance_agent: PerformanceSnapshot,
  reporting_agent: StructuredReport,
  dashboard_aggregator_agent: DashboardPayload,
};

export function getAgentSchema(agentName: string): z.ZodTypeAny {
  const s = AGENT_OUTPUT_SCHEMAS[agentName];
  if (!s) throw new Error(`no output schema registered for agent '${agentName}'`);
  return s;
}
