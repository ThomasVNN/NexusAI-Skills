/**
 * Jira Enterprise Connector
 * Phase 2 - Item 2.3 Enterprise Connector: Jira
 * Enables AI agents to create, update, and query Jira issues with proper auth
 */

import { Connector, Tool } from "./skills.interface.js";

/**
 * Jira API Configuration
 */
export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  defaultProject?: string;
  defaultIssueType?: string;
}

/**
 * Jira Issue representation
 */
export interface JiraIssue {
  id: string;
  key: string;
  summary: string;
  description?: string;
  status: string;
  priority?: string;
  assignee?: string;
  reporter?: string;
  labels?: string[];
  components?: string[];
  sprint?: string;
  epicLink?: string;
  parent?: { id: string; key: string };
  created: string;
  updated: string;
  resolution?: string;
  issueType: string;
  project: { id: string; key: string };
}

/**
 * Jira Issue search result
 */
export interface JiraSearchResult {
  total: number;
  issues: JiraIssue[];
  startAt: number;
  maxResults: number;
}

/**
 * Jira Issue Create/Update input
 */
export interface JiraIssueInput {
  summary: string;
  description?: string;
  projectKey: string;
  issueType: string;
  priority?: string;
  assignee?: string;
  labels?: string[];
  components?: string[];
  parentIssueKey?: string;
  sprint?: string;
}

/**
 * Jira Connector implementation
 */
export class JiraConnector implements Connector {
  id: string;
  type = "jira" as const;
  
  private config: JiraConfig | null = null;
  private connected = false;

  constructor(id: string) {
    this.id = id;
  }

  async connect(credentials: Record<string, unknown>): Promise<boolean> {
    try {
      const config = credentials as unknown as JiraConfig;
      
      if (!config.baseUrl || !config.email || !config.apiToken) {
        throw new Error("Missing required Jira credentials: baseUrl, email, apiToken");
      }

      // Validate baseUrl format
      try {
        new URL(config.baseUrl);
      } catch {
        throw new Error(`Invalid Jira baseUrl: ${config.baseUrl}`);
      }

      this.config = config;
      
      // Test connection
      await this.request("/rest/api/3/myself");
      
      this.connected = true;
      return true;
    } catch (error) {
      this.connected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.config = null;
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<Record<string, unknown>> {
    if (!this.connected) {
      throw new Error("Jira connector not connected. Call connect() first.");
    }
    return this.request("/rest/api/3/myself");
  }

  /**
   * Search issues using JQL
   */
  async searchIssues(jql: string, options?: {
    startAt?: number;
    maxResults?: number;
    fields?: string[];
  }): Promise<JiraSearchResult> {
    if (!this.connected) {
      throw new Error("Jira connector not connected. Call connect() first.");
    }

    const fields = options?.fields ?? [
      "summary", "description", "status", "priority", 
      "assignee", "reporter", "labels", "created", "updated", 
      "issuetype", "project"
    ];

    const body = {
      jql,
      startAt: options?.startAt ?? 0,
      maxResults: options?.maxResults ?? 50,
      fields,
    };

    const response = await this.request("/rest/api/3/search", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return this.mapSearchResult(response);
  }

  /**
   * Get issue by key
   */
  async getIssue(issueKey: string, fields?: string[]): Promise<JiraIssue> {
    if (!this.connected) {
      throw new Error("Jira connector not connected. Call connect() first.");
    }

    const queryParams = fields ? `&fields=${fields.join(",")}` : "";
    const response = await this.request(
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}${queryParams}`
    );

    return this.mapIssue(response);
  }

  /**
   * Create a new issue
   */
  async createIssue(input: JiraIssueInput): Promise<JiraIssue> {
    if (!this.connected) {
      throw new Error("Jira connector not connected. Call connect() first.");
    }

    const fields: Record<string, unknown> = {
      summary: input.summary,
      project: { key: input.projectKey },
      issuetype: { name: input.issueType },
    };

    if (input.description) {
      fields.description = {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: input.description }],
          },
        ],
      };
    }

    if (input.priority) {
      fields.priority = { name: input.priority };
    }

    if (input.assignee) {
      fields.assignee = { name: input.assignee };
    }

    if (input.labels && input.labels.length > 0) {
      fields.labels = input.labels;
    }

    if (input.components && input.components.length > 0) {
      fields.components = input.components.map((c) => ({ name: c }));
    }

    if (input.parentIssueKey) {
      fields.parent = { key: input.parentIssueKey };
    }

    const response = await this.request("/rest/api/3/issue", {
      method: "POST",
      body: JSON.stringify({ fields }),
    });

    return this.mapIssue(response);
  }

  /**
   * Update an existing issue
   */
  async updateIssue(issueKey: string, updates: Partial<JiraIssueInput>): Promise<JiraIssue> {
    if (!this.connected) {
      throw new Error("Jira connector not connected. Call connect() first.");
    }

    const fields: Record<string, unknown> = {};

    if (updates.summary !== undefined) {
      fields.summary = updates.summary;
    }

    if (updates.description !== undefined) {
      fields.description = {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: updates.description }],
          },
        ],
      };
    }

    if (updates.priority !== undefined) {
      fields.priority = { name: updates.priority };
    }

    if (updates.assignee !== undefined) {
      fields.assignee = { name: updates.assignee };
    }

    if (updates.labels !== undefined) {
      fields.labels = updates.labels;
    }

    await this.request(
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}`,
      {
        method: "PUT",
        body: JSON.stringify({ fields }),
      }
    );

    return this.getIssue(issueKey);
  }

  /**
   * Add comment to issue
   */
  async addComment(issueKey: string, comment: string): Promise<Record<string, unknown>> {
    if (!this.connected) {
      throw new Error("Jira connector not connected. Call connect() first.");
    }

    const body = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: comment }],
        },
      ],
    };

    return this.request(
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );
  }

  /**
   * Transition issue to a new status
   */
  async transitionIssue(issueKey: string, statusName: string): Promise<void> {
    if (!this.connected) {
      throw new Error("Jira connector not connected. Call connect() first.");
    }

    // Get available transitions
    const transitionsResponse = await this.request(
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`
    );

    const transitions = (transitionsResponse.transitions as Array<{ id: string; name: string }>) || [];
    const targetTransition = transitions.find(
      (t) => t.name.toLowerCase() === statusName.toLowerCase()
    );

    if (!targetTransition) {
      throw new Error(
        `Transition '${statusName}' not found. Available: ${transitions.map((t) => t.name).join(", ")}`
      );
    }

    await this.request(
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
      {
        method: "POST",
        body: JSON.stringify({ transition: { id: targetTransition.id } }),
      }
    );
  }

  /**
   * Get project info
   */
  async getProject(projectKey: string): Promise<Record<string, unknown>> {
    if (!this.connected) {
      throw new Error("Jira connector not connected. Call connect() first.");
    }
    return this.request(`/rest/api/3/project/${encodeURIComponent(projectKey)}`);
  }

  /**
   * Get available issue types for a project
   */
  async getIssueTypes(projectKey: string): Promise<Record<string, unknown>[]> {
    if (!this.connected) {
      throw new Error("Jira connector not connected. Call connect() first.");
    }
    const project = await this.getProject(projectKey);
    const issueTypes = project["issueTypes"] as Record<string, unknown>[];
    return issueTypes || [];
  }

  /**
   * Make authenticated request to Jira API
   */
  private async request(
    path: string,
    options?: {
      method?: string;
      body?: string;
    }
  ): Promise<Record<string, unknown>> {
    if (!this.config) {
      throw new Error("Jira connector not connected. Call connect() first.");
    }

    const url = `${this.config.baseUrl}${path}`;
    const auth = Buffer.from(`${this.config.email}:${this.config.apiToken}`).toString("base64");

    const response = await fetch(url, {
      method: options?.method ?? "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: options?.body,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `Jira API error: ${response.status} ${response.statusText}. ${errorBody}`
      );
    }

    // Handle empty responses
    const text = await response.text();
    if (!text) {
      return {};
    }

    return JSON.parse(text);
  }

  /**
   * Map Jira API response to JiraIssue
   */
  private mapIssue(response: Record<string, unknown>): JiraIssue {
    const fields = (response["fields"] as Record<string, unknown>) || {};
    const project = (fields["project"] as Record<string, unknown>) || {};
    const issueType = (fields["issuetype"] as Record<string, unknown>) || {};

    return {
      id: response["id"] as string,
      key: response["key"] as string,
      summary: (fields["summary"] as string) || "",
      description: this.extractTextFromAdf(fields["description"]),
      status: ((fields["status"] as Record<string, unknown>)?.["name"] as string) || "",
      priority: (fields["priority"] as Record<string, unknown>)?.["name"] as string,
      assignee: (fields["assignee"] as Record<string, unknown>)?.["displayName"] as string,
      reporter: (fields["reporter"] as Record<string, unknown>)?.["displayName"] as string,
      labels: (fields["labels"] as string[]) || [],
      created: (fields["created"] as string) || "",
      updated: (fields["updated"] as string) || "",
      resolution: (fields["resolution"] as Record<string, unknown>)?.["name"] as string,
      issueType: (issueType["name"] as string) || "",
      project: {
        id: (project["id"] as string) || "",
        key: (project["key"] as string) || "",
      },
    };
  }

  /**
   * Map search response to JiraSearchResult
   */
  private mapSearchResult(response: Record<string, unknown>): JiraSearchResult {
    const issues = ((response["issues"] as Record<string, unknown>[]) || []).map((issue) =>
      this.mapIssue(issue)
    );

    return {
      total: (response["total"] as number) || 0,
      issues,
      startAt: (response["startAt"] as number) || 0,
      maxResults: (response["maxResults"] as number) || 50,
    };
  }

  /**
   * Extract plain text from Atlassian Document Format (ADF)
   */
  private extractTextFromAdf(adf: unknown): string | undefined {
    if (!adf || typeof adf !== "object") return undefined;

    const doc = adf as { content?: unknown[] };
    if (!doc.content) return undefined;

    const extractFromNode = (node: unknown): string => {
      if (!node || typeof node !== "object") return "";

      const n = node as { type?: string; text?: string; content?: unknown[] };
      if (n.type === "text" && n.text) {
        return n.text;
      }

      if (Array.isArray(n.content)) {
        return n.content.map(extractFromNode).join("");
      }

      return "";
    };

    return doc.content.map(extractFromNode).join(" ").trim() || undefined;
  }
}

/**
 * Jira Tool wrapper for agent execution
 */
export class JiraTool implements Tool {
  name = "jira";
  description = "Interact with Jira for creating, updating, and querying issues";
  
  inputSchema = {
    type: "object" as const,
    properties: {
      action: {
        type: "string" as const,
        enum: ["search", "get", "create", "update", "addComment", "transition", "getProject", "getIssueTypes"],
        description: "The Jira action to perform",
      },
      projectKey: {
        type: "string",
        description: "Jira project key (e.g., PROJ)",
      },
      issueKey: {
        type: "string",
        description: "Jira issue key (e.g., PROJ-123)",
      },
      jql: {
        type: "string",
        description: "JQL query for search",
      },
      summary: {
        type: "string",
        description: "Issue summary/title",
      },
      description: {
        type: "string",
        description: "Issue description",
      },
      issueType: {
        type: "string",
        description: "Issue type (e.g., Task, Bug, Story)",
      },
      status: {
        type: "string",
        description: "Target status for transition",
      },
      priority: {
        type: "string",
        description: "Issue priority (e.g., High, Medium, Low)",
      },
      labels: {
        type: "array",
        items: { type: "string" },
        description: "Labels to apply",
      },
      comment: {
        type: "string",
        description: "Comment text",
      },
      fields: {
        type: "array",
        items: { type: "string" },
        description: "Fields to return in search",
      },
    },
    required: ["action"],
  };

  constructor(private connector: JiraConnector) {}

  async execute(ctx: unknown, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      const action = args.action as string;
      let result: unknown;

      switch (action) {
        case "search":
          result = await this.connector.searchIssues(args.jql as string, {
            fields: args.fields as string[],
          });
          break;

        case "get":
          result = await this.connector.getIssue(args.issueKey as string);
          break;

        case "create":
          result = await this.connector.createIssue({
            summary: args.summary as string,
            description: args.description as string,
            projectKey: args.projectKey as string,
            issueType: args.issueType as string,
            priority: args.priority as string,
            labels: args.labels as string[],
          });
          break;

        case "update":
          result = await this.connector.updateIssue(args.issueKey as string, {
            summary: args.summary as string,
            description: args.description as string,
            priority: args.priority as string,
            labels: args.labels as string[],
          });
          break;

        case "addComment":
          result = await this.connector.addComment(
            args.issueKey as string,
            args.comment as string
          );
          break;

        case "transition":
          await this.connector.transitionIssue(args.issueKey as string, args.status as string);
          result = { success: true };
          break;

        case "getProject":
          result = await this.connector.getProject(args.projectKey as string);
          break;

        case "getIssueTypes":
          result = await this.connector.getIssueTypes(args.projectKey as string);
          break;

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export default JiraConnector;
