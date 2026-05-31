import { z } from "zod";
import { Tool } from "../../internal/skills.interface.js";
import { SkillParams, SkillResult, createBaseSkillMetadata } from "../types.js";

/**
 * Input schema for database query execution
 */
const DatabaseQueryInputSchema = z.object({
  query: z.string().describe("SQL query to execute"),
  databaseId: z.string().optional().describe("Target database identifier"),
  parameters: z.record(z.any()).optional().describe("Query parameters for prepared statements"),
  limit: z.number().int().positive().optional().default(100).describe("Maximum rows to return"),
});

/**
 * Output schema for database query results
 */
const DatabaseQueryOutputSchema = z.object({
  success: z.boolean(),
  columns: z.array(z.string()).optional(),
  rows: z.array(z.record(z.any())).optional(),
  rowCount: z.number().optional(),
  executionTimeMs: z.number().optional(),
  error: z.string().optional(),
});

type DatabaseQueryInput = z.infer<typeof DatabaseQueryInputSchema>;
type DatabaseQueryOutput = z.infer<typeof DatabaseQueryOutputSchema>;

/**
 * Database Query Skill
 * Executes SQL queries with schema introspection support
 */
export class DatabaseQuerySkill implements Tool {
  name = "database_query";
  description = "Execute SQL queries against connected databases with schema introspection";
  inputSchema = DatabaseQueryInputSchema;

  private readonly metadata = createBaseSkillMetadata({
    id: "database-query",
    name: "Database Query Executor",
    description: "Execute SQL queries against connected databases with schema introspection and parameter binding",
    category: "data",
    version: "1.0.0",
    author: "NexusAI",
    requiredPermissions: ["read:database"],
    requiredCapabilities: ["sql-executor", "database-connector"],
    estimatedDuration: "5-30s",
    trustScore: 85,
    requiresHumanApproval: false,
    rateLimitPerMinute: 30,
    inputSchema: DatabaseQueryInputSchema,
    outputSchema: DatabaseQueryOutputSchema,
  });

  getMetadata() {
    return this.metadata;
  }

  async execute(ctx: any, args: Record<string, any>): Promise<Record<string, any>> {
    const startTime = Date.now();
    const params = DatabaseQueryInputSchema.parse(args);

    try {
      // Validate query for safety
      const validationResult = this.validateQuery(params.query);
      if (!validationResult.valid) {
        return {
          success: false,
          error: validationResult.error,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Mock database execution - in production, connect to actual database
      const mockResult = await this.executeMockQuery(params);

      return {
        success: true,
        columns: mockResult.columns,
        rows: mockResult.rows.slice(0, params.limit),
        rowCount: mockResult.rows.length,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Query execution failed",
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  private validateQuery(query: string): { valid: boolean; error?: string } {
    const dangerousPatterns = [
      /\bDROP\s+(TABLE|DATABASE|SCHEMA)\s+/i,
      /\bTRUNCATE\s+/i,
      /\bDELETE\s+FROM\s+\w+\s*;?\s*$/i,
      /\bGRANT\s+/i,
      /\bREVOKE\s+/i,
      /\bALTER\s+(TABLE|DATABASE)\s+\w+\s+DROP/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        return { valid: false, error: `Potentially dangerous operation detected: ${pattern.source}` };
      }
    }

    return { valid: true };
  }

  private async executeMockQuery(params: DatabaseQueryInput): Promise<{ columns: string[]; rows: any[] }> {
    // Mock implementation - returns sample data structure
    // In production, this would connect to actual database
    return {
      columns: ["id", "name", "created_at", "status"],
      rows: [
        { id: 1, name: "Sample Record 1", created_at: new Date().toISOString(), status: "active" },
        { id: 2, name: "Sample Record 2", created_at: new Date().toISOString(), status: "pending" },
        { id: 3, name: "Sample Record 3", created_at: new Date().toISOString(), status: "completed" },
      ],
    };
  }
}

/**
 * Schema introspection capability
 */
export async function introspectDatabaseSchema(databaseId?: string): Promise<{
  tables: Array<{ name: string; columns: Array<{ name: string; type: string; nullable: boolean }> }>;
}> {
  // Mock schema introspection
  return {
    tables: [
      {
        name: "users",
        columns: [
          { name: "id", type: "integer", nullable: false },
          { name: "name", type: "varchar(255)", nullable: false },
          { name: "email", type: "varchar(255)", nullable: true },
          { name: "created_at", type: "timestamp", nullable: false },
        ],
      },
      {
        name: "products",
        columns: [
          { name: "id", type: "integer", nullable: false },
          { name: "name", type: "varchar(255)", nullable: false },
          { name: "price", type: "decimal(10,2)", nullable: false },
          { name: "category_id", type: "integer", nullable: true },
        ],
      },
    ],
  };
}
