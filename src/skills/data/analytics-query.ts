import { z } from "zod";
import { Tool } from "../../internal/skills.interface.js";
import { createBaseSkillMetadata } from "../types.js";

/**
 * Input schema for analytics queries
 */
const AnalyticsQueryInputSchema = z.object({
  metrics: z.array(z.object({
    field: z.string().describe("Field to aggregate"),
    operation: z.enum(["count", "sum", "avg", "min", "max", "countDistinct", "percentile"]),
    alias: z.string().optional().describe("Alias for the result"),
    parameters: z.object({
      percentile: z.number().min(0).max(100).optional(),
      filter: z.record(z.any()).optional(),
    }).optional().default({}),
  })).min(1).describe("Metrics to calculate"),
  groupBy: z.array(z.string()).optional().describe("Fields to group by"),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.enum(["eq", "ne", "gt", "gte", "lt", "lte", "in", "nin", "contains", "startsWith", "endsWith"]),
    value: z.any(),
  })).optional().describe("Filter conditions"),
  orderBy: z.array(z.object({
    field: z.string(),
    direction: z.enum(["asc", "desc"]).optional().default("desc"),
  })).optional(),
  limit: z.number().int().positive().optional().default(100),
  timeRange: z.object({
    field: z.string().optional().default("created_at"),
    from: z.string().or(z.number()),
    to: z.string().or(z.number()).optional(),
    bucket: z.enum(["minute", "hour", "day", "week", "month", "quarter", "year"]).optional(),
  }).optional(),
  dataSource: z.string().optional().describe("Analytics data source identifier"),
});

/**
 * Output schema for analytics results
 */
const AnalyticsOutputSchema = z.object({
  success: z.boolean(),
  results: z.array(z.record(z.any())).optional(),
  summary: z.object({
    totalRecords: z.number().optional(),
    executionTimeMs: z.number().optional(),
    queryId: z.string().optional(),
  }).optional(),
  metadata: z.object({
    metrics: z.array(z.string()).optional(),
    groupBy: z.array(z.string()).optional(),
    timeRange: z.record(z.any()).optional(),
  }).optional(),
  error: z.string().optional(),
});

type AnalyticsQueryInput = z.infer<typeof AnalyticsQueryInputSchema>;
type AnalyticsOutput = z.infer<typeof AnalyticsOutputSchema>;

/**
 * Analytics Query Skill
 * Performs analytics and aggregation queries on data
 */
export class AnalyticsQuerySkill implements Tool {
  name = "analytics_query";
  description = "Execute analytics queries with aggregations, grouping, and time-series analysis";
  inputSchema = AnalyticsQueryInputSchema;

  private readonly metadata = createBaseSkillMetadata({
    id: "analytics-query",
    name: "Analytics Query Engine",
    description: "Execute analytics queries with aggregations, grouping, filtering, and time-series analysis",
    category: "data",
    version: "1.0.0",
    author: "NexusAI",
    requiredPermissions: ["read:database", "read:analytics"],
    requiredCapabilities: ["sql-executor", "analytics-engine"],
    estimatedDuration: "10-60s",
    trustScore: 85,
    requiresHumanApproval: false,
    rateLimitPerMinute: 30,
    inputSchema: AnalyticsQueryInputSchema,
    outputSchema: AnalyticsOutputSchema,
  });

  getMetadata() {
    return this.metadata;
  }

  async execute(ctx: any, args: Record<string, any>): Promise<Record<string, any>> {
    const startTime = Date.now();
    const params = AnalyticsQueryInputSchema.parse(args);

    try {
      // Generate mock data for demonstration
      const mockData = this.generateMockData(params);
      
      // Apply filters
      let filteredData = this.applyFilters(mockData, params.filters);
      
      // Apply grouping
      const groupedData = params.groupBy?.length
        ? this.applyGrouping(filteredData, params.groupBy, params.metrics)
        : this.applyMetrics(filteredData, params.metrics);
      
      // Apply ordering
      const orderedData = this.applyOrdering(groupedData, params.orderBy);
      
      // Apply limit
      const limitedData = orderedData.slice(0, params.limit);

      return {
        success: true,
        results: limitedData,
        summary: {
          totalRecords: filteredData.length,
          executionTimeMs: Date.now() - startTime,
          queryId: `aq_${Date.now()}`,
        },
        metadata: {
          metrics: params.metrics.map(m => m.alias || `${m.operation}_${m.field}`),
          groupBy: params.groupBy,
          timeRange: params.timeRange,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Analytics query failed",
        summary: {
          executionTimeMs: Date.now() - startTime,
        },
      };
    }
  }

  private generateMockData(params: AnalyticsQueryInput): any[] {
    // Generate realistic mock data based on metrics requested
    const records: any[] = [];
    const count = 100;
    
    for (let i = 0; i < count; i++) {
      const record: any = {
        id: i + 1,
        created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: ["active", "pending", "completed", "failed"][Math.floor(Math.random() * 4)],
        category: ["A", "B", "C", "D"][Math.floor(Math.random() * 4)],
        amount: Math.floor(Math.random() * 10000) / 100,
        quantity: Math.floor(Math.random() * 100),
        user_id: `user_${Math.floor(Math.random() * 50)}`,
      };
      records.push(record);
    }
    
    return records;
  }

  private applyFilters(data: any[], filters: any[] | undefined): any[] {
    if (!filters || filters.length === 0) return data;
    
    return data.filter(record => {
      return filters.every(filter => {
        const value = this.getNestedValue(record, filter.field);
        
        switch (filter.operator) {
          case "eq": return value === filter.value;
          case "ne": return value !== filter.value;
          case "gt": return value > filter.value;
          case "gte": return value >= filter.value;
          case "lt": return value < filter.value;
          case "lte": return value <= filter.value;
          case "in": return filter.value.includes(value);
          case "nin": return !filter.value.includes(value);
          case "contains": return String(value).includes(String(filter.value));
          case "startsWith": return String(value).startsWith(String(filter.value));
          case "endsWith": return String(value).endsWith(String(filter.value));
          default: return true;
        }
      });
    });
  }

  private applyMetrics(data: any[], metrics: any[]): any[] {
    const result: any = {};
    
    for (const metric of metrics) {
      const values = data.map((r: any) => this.getNestedValue(r, metric.field)).filter((v: any) => v !== undefined && v !== null);
      const alias = metric.alias || `${metric.operation}_${metric.field}`;
      
      switch (metric.operation) {
        case "count":
          result[alias] = values.length;
          break;
        case "sum":
          result[alias] = values.reduce((a: number, b: number) => a + b, 0);
          break;
        case "avg":
          result[alias] = values.length > 0 ? values.reduce((a: number, b: number) => a + b, 0) / values.length : 0;
          break;
        case "min":
          result[alias] = Math.min(...values);
          break;
        case "max":
          result[alias] = Math.max(...values);
          break;
        case "countDistinct":
          result[alias] = new Set(values).size;
          break;
        case "percentile":
          const sorted = [...values].sort((a: number, b: number) => a - b);
          const p = metric.parameters?.percentile || 50;
          const idx = Math.ceil((p / 100) * sorted.length) - 1;
          result[alias] = sorted[Math.max(0, idx)];
          break;
      }
    }
    
    return [result];
  }

  private applyGrouping(data: any[], groupBy: string[], metrics: any[]): any[] {
    const groups = new Map<string, any[]>();
    
    // Group records
    for (const record of data) {
      const key = groupBy.map(field => this.getNestedValue(record, field)).join("|");
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(record);
    }
    
    // Calculate metrics per group
    const results: any[] = [];
    for (const [key, records] of groups) {
      const result: any = {};
      const keyParts = key.split("|");
      groupBy.forEach((field, i) => {
        result[field] = keyParts[i];
      });
      
      for (const metric of metrics) {
        const values = records.map((r: any) => this.getNestedValue(r, metric.field)).filter((v: any) => v !== undefined && v !== null);
        const alias = metric.alias || `${metric.operation}_${metric.field}`;
        
        switch (metric.operation) {
          case "count":
            result[alias] = values.length;
            break;
          case "sum":
            result[alias] = values.reduce((a: number, b: number) => a + b, 0);
            break;
          case "avg":
            result[alias] = values.length > 0 ? values.reduce((a: number, b: number) => a + b, 0) / values.length : 0;
            break;
          case "min":
            result[alias] = values.length > 0 ? Math.min(...values) : null;
            break;
          case "max":
            result[alias] = values.length > 0 ? Math.max(...values) : null;
            break;
          case "countDistinct":
            result[alias] = new Set(values).size;
            break;
        }
      }
      
      results.push(result);
    }
    
    return results;
  }

  private applyOrdering(data: any[], orderBy: any[] | undefined): any[] {
    if (!orderBy || orderBy.length === 0) return data;
    
    return [...data].sort((a, b) => {
      for (const order of orderBy) {
        const aVal = this.getNestedValue(a, order.field);
        const bVal = this.getNestedValue(b, order.field);
        
        if (aVal < bVal) return order.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return order.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }
}
