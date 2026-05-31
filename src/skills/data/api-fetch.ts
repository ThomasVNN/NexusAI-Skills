import { z } from "zod";
import { Tool } from "../../internal/skills.interface.js";
import { createBaseSkillMetadata } from "../types.js";

/**
 * Input schema for API fetch operations
 */
const ApiFetchInputSchema = z.object({
  url: z.string().url().describe("Target API endpoint URL"),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional().default("GET"),
  headers: z.record(z.string()).optional().describe("HTTP headers"),
  body: z.any().optional().describe("Request body for POST/PUT/PATCH"),
  params: z.record(z.string()).optional().describe("URL query parameters"),
  timeout: z.number().int().positive().optional().default(30000).describe("Request timeout in ms"),
  followRedirects: z.boolean().optional().default(true),
});

/**
 * Output schema for API fetch results
 */
const ApiFetchOutputSchema = z.object({
  success: z.boolean(),
  status: z.number().optional(),
  statusText: z.string().optional(),
  headers: z.record(z.string()).optional(),
  data: z.any().optional(),
  executionTimeMs: z.number().optional(),
  error: z.string().optional(),
});

type ApiFetchInput = z.infer<typeof ApiFetchInputSchema>;
type ApiFetchOutput = z.infer<typeof ApiFetchOutputSchema>;

/**
 * API Fetch Skill
 * HTTP API fetcher with authentication and header support
 */
export class ApiFetchSkill implements Tool {
  name = "api_fetch";
  description = "Fetch data from HTTP APIs with authentication support and configurable headers";
  inputSchema = ApiFetchInputSchema;

  private readonly metadata = createBaseSkillMetadata({
    id: "api-fetch",
    name: "API Fetcher",
    description: "Fetch data from HTTP APIs with authentication, headers, and configurable options",
    category: "data",
    version: "1.0.0",
    author: "NexusAI",
    requiredPermissions: ["read:network"],
    requiredCapabilities: ["web-fetcher", "http-client"],
    estimatedDuration: "2-10s",
    trustScore: 88,
    requiresHumanApproval: false,
    rateLimitPerMinute: 100,
    inputSchema: ApiFetchInputSchema,
    outputSchema: ApiFetchOutputSchema,
  });

  getMetadata() {
    return this.metadata;
  }

  async execute(ctx: any, args: Record<string, any>): Promise<Record<string, any>> {
    const startTime = Date.now();
    const params = ApiFetchInputSchema.parse(args);

    try {
      // Validate URL for safety
      const urlValidation = this.validateUrl(params.url);
      if (!urlValidation.valid) {
        return {
          success: false,
          error: urlValidation.error,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Build URL with query params
      const url = new URL(params.url);
      if (params.params) {
        Object.entries(params.params).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
      }

      // Build fetch options
      const fetchOptions: RequestInit = {
        method: params.method,
        headers: {
          "Content-Type": "application/json",
          ...params.headers,
        },
        redirect: params.followRedirects ? "follow" : "manual",
        signal: AbortSignal.timeout(params.timeout),
      };

      if (params.body && ["POST", "PUT", "PATCH"].includes(params.method)) {
        fetchOptions.body = JSON.stringify(params.body);
      }

      // Execute fetch
      const response = await fetch(url.toString(), fetchOptions);
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Parse response
      let data: any;
      const contentType = response.headers.get("content-type") || "";
      
      if (contentType.includes("application/json")) {
        data = await response.json();
      } else if (contentType.includes("text/")) {
        data = await response.text();
      } else {
        data = await response.blob();
      }

      return {
        success: true,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        data,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: this.formatError(error),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  private validateUrl(url: string): { valid: boolean; error?: string } {
    try {
      const parsed = new URL(url);
      
      // Block dangerous protocols
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return { valid: false, error: `Invalid protocol: ${parsed.protocol}. Only HTTP(S) allowed.` };
      }
      
      // Block localhost/internal addresses in production
      const blockedHosts = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];
      if (blockedHosts.includes(parsed.hostname)) {
        return { valid: false, error: "Access to local addresses is not allowed" };
      }
      
      return { valid: true };
    } catch {
      return { valid: false, error: "Invalid URL format" };
    }
  }

  private formatError(error: any): string {
    if (error.name === "TimeoutError") {
      return "Request timed out";
    }
    if (error.name === "AbortError") {
      return "Request was aborted";
    }
    if (error.code === "ENOTFOUND") {
      return "DNS lookup failed - host not found";
    }
    if (error.code === "ECONNREFUSED") {
      return "Connection refused";
    }
    return error.message || "Unknown error occurred";
  }
}

/**
 * Batch API fetcher for multiple endpoints
 */
export async function batchFetch(
  requests: Array<{
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  }>,
  concurrency: number = 5
): Promise<Array<{ url: string; success: boolean; data?: any; error?: string }>> {
  const results: Array<{ url: string; success: boolean; data?: any; error?: string }> = [];
  
  // Process in batches
  for (let i = 0; i < requests.length; i += concurrency) {
    const batch = requests.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (req) => {
        try {
          const skill = new ApiFetchSkill();
          const result = await skill.execute({}, {
            url: req.url,
            method: req.method || "GET",
            headers: req.headers,
            body: req.body,
          });
          return { url: req.url, success: result.success, data: result.data, error: result.error };
        } catch (error: any) {
          return { url: req.url, success: false, error: error.message };
        }
      })
    );
    results.push(...batchResults);
  }
  
  return results;
}
