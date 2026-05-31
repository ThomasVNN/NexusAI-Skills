/**
 * ServiceNow Enterprise Connector
 * Phase 2 - Item 2.4 Enterprise Connector: ServiceNow
 * Enables AI agents to interact with ServiceNow ITSM: create tickets, query SLAs, trigger workflows
 */

import { Connector, Tool } from "./skills.interface.js";

/**
 * ServiceNow API Configuration
 */
export interface ServiceNowConfig {
  instanceUrl: string;
  username: string;
  password: string;
  defaultTable?: string;
}

/**
 * ServiceNow Record representation
 */
export interface ServiceNowRecord {
  sys_id: string;
  number: string;
  tableName: string;
  fields: Record<string, unknown>;
  createdOn: string;
  updatedOn: string;
}

/**
 * ServiceNow Query Result
 */
export interface ServiceNowQueryResult {
  count: number;
  records: ServiceNowRecord[];
  offset?: number;
  limit?: number;
}

/**
 * ServiceNow Record Input
 */
export interface ServiceNowRecordInput {
  tableName: string;
  fields: Record<string, unknown>;
}

/**
 * ServiceNow Connector implementation
 */
export class ServiceNowConnector implements Connector {
  id: string;
  type = "servicenow" as const;

  private config: ServiceNowConfig | null = null;
  private connected = false;
  private baseAuth: string | null = null;

  constructor(id: string) {
    this.id = id;
  }

  async connect(credentials: Record<string, unknown>): Promise<boolean> {
    try {
      const config = credentials as unknown as ServiceNowConfig;

      if (!config.instanceUrl || !config.username || !config.password) {
        throw new Error(
          "Missing required ServiceNow credentials: instanceUrl, username, password"
        );
      }

      // Validate instanceUrl format
      try {
        new URL(config.instanceUrl);
      } catch {
        throw new Error(`Invalid ServiceNow instanceUrl: ${config.instanceUrl}`);
      }

      this.config = config;
      this.baseAuth = Buffer.from(`${config.username}:${config.password}`).toString("base64");

      // Test connection by getting current user info
      await this.request("/api/now/ui/meta/table");

      this.connected = true;
      return true;
    } catch (error) {
      this.connected = false;
      this.baseAuth = null;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.config = null;
    this.connected = false;
    this.baseAuth = null;
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<Record<string, unknown>> {
    if (!this.connected) {
      throw new Error(
        "ServiceNow connector not connected. Call connect() first."
      );
    }

    return this.request("/api/now/table/sys_user?sysparm_limit=1");
  }

  /**
   * Query records from a table
   */
  async queryRecords(
    tableName: string,
    options?: {
      sysparmQuery?: string;
      sysparmFields?: string;
      sysparmLimit?: number;
      sysparmOffset?: number;
    }
  ): Promise<ServiceNowQueryResult> {
    if (!this.connected) {
      throw new Error(
        "ServiceNow connector not connected. Call connect() first."
      );
    }

    const params = new URLSearchParams();
    if (options?.sysparmQuery) params.append("sysparm_query", options.sysparmQuery);
    if (options?.sysparmFields) params.append("sysparm_fields", options.sysparmFields);
    if (options?.sysparmLimit) params.append("sysparm_limit", String(options.sysparmLimit));
    if (options?.sysparmOffset) params.append("sysparm_offset", String(options.sysparmOffset));

    const queryString = params.toString();
    const path = `/api/now/table/${tableName}${queryString ? `?${queryString}` : ""}`;

    const response = await this.request(path);

    const result = response.result as Record<string, unknown>[] | undefined;
    const records = (result || []).map((r) => this.mapRecord(tableName, r));

    return {
      count: (response.headers as Record<string, string>)["x-total-count"]
        ? parseInt((response.headers as Record<string, string>)["x-total-count"])
        : records.length,
      records,
      offset: options?.sysparmOffset,
      limit: options?.sysparmLimit,
    };
  }

  /**
   * Get single record by sys_id
   */
  async getRecord(
    tableName: string,
    sysId: string,
    options?: { sysparmFields?: string }
  ): Promise<ServiceNowRecord> {
    if (!this.connected) {
      throw new Error(
        "ServiceNow connector not connected. Call connect() first."
      );
    }

    const path = `/api/now/table/${tableName}/${sysId}${
      options?.sysparmFields ? `?sysparm_fields=${options.sysparmFields}` : ""
    }`;

    const response = await this.request(path);
    const result = response.result as Record<string, unknown>;

    return this.mapRecord(tableName, result);
  }

  /**
   * Get record by number (e.g., INC0012345)
   */
  async getRecordByNumber(
    tableName: string,
    number: string
  ): Promise<ServiceNowRecord> {
    if (!this.connected) {
      throw new Error(
        "ServiceNow connector not connected. Call connect() first."
      );
    }

    const queryEncoded = encodeURIComponent(`number=${number}`);
    const path = `/api/now/table/${tableName}?sysparm_query=${queryEncoded}&sysparm_limit=1`;

    const response = await this.request(path);
    const result = response.result as Record<string, unknown>[] | undefined;

    if (!result || result.length === 0) {
      throw new Error(`Record with number '${number}' not found in table '${tableName}'`);
    }

    return this.mapRecord(tableName, result[0]);
  }

  /**
   * Create a new record
   */
  async createRecord(input: ServiceNowRecordInput): Promise<ServiceNowRecord> {
    if (!this.connected) {
      throw new Error(
        "ServiceNow connector not connected. Call connect() first."
      );
    }

    const path = `/api/now/table/${input.tableName}`;
    const response = await this.request(path, {
      method: "POST",
      body: JSON.stringify(input.fields),
    });

    return this.mapRecord(input.tableName, response.result as Record<string, unknown>);
  }

  /**
   * Update an existing record
   */
  async updateRecord(
    tableName: string,
    sysId: string,
    fields: Record<string, unknown>
  ): Promise<ServiceNowRecord> {
    if (!this.connected) {
      throw new Error(
        "ServiceNow connector not connected. Call connect() first."
      );
    }

    const path = `/api/now/table/${tableName}/${sysId}`;
    await this.request(path, {
      method: "PUT",
      body: JSON.stringify(fields),
    });

    return this.getRecord(tableName, sysId);
  }

  /**
   * Delete a record
   */
  async deleteRecord(tableName: string, sysId: string): Promise<void> {
    if (!this.connected) {
      throw new Error(
        "ServiceNow connector not connected. Call connect() first."
      );
    }

    const path = `/api/now/table/${tableName}/${sysId}`;
    await this.request(path, { method: "DELETE" });
  }

  /**
   * Get SLA status for an incident
   */
  async getSLAStatus(incidentSysId: string): Promise<Record<string, unknown>> {
    if (!this.connected) {
      throw new Error(
        "ServiceNow connector not connected. Call connect() first."
      );
    }

    // Query SLA records linked to this incident
    const queryEncoded = encodeURIComponent(`element.document_id=${incidentSysId}^stageNOT INCancelled,Breached`);
    const path = `/api/now/table/sla/${incidentSysId}?sysparm_query=${queryEncoded}`;

    const response = await this.request(path);
    return response.result as Record<string, unknown>;
  }

  /**
   * Trigger a Flow Designer workflow
   */
  async triggerFlow(
    flowName: string,
    inputs: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (!this.connected) {
      throw new Error(
        "ServiceNow connector not connected. Call connect() first."
      );
    }

    const path = "/api/sn_fd_v1/flows";
    const payload = {
      flow_name: flowName,
      inputs,
    };

    const response = await this.request(path, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return response as Record<string, unknown>;
  }

  /**
   * Get available tables metadata
   */
  async getTableMetadata(tableName: string): Promise<Record<string, unknown>> {
    if (!this.connected) {
      throw new Error(
        "ServiceNow connector not connected. Call connect() first."
      );
    }

    const path = `/api/now/ui/meta/table/${tableName}`;
    return this.request(path);
  }

  /**
   * Make authenticated request to ServiceNow API
   */
  private async request(
    path: string,
    options?: {
      method?: string;
      body?: string;
    }
  ): Promise<Record<string, unknown>> {
    if (!this.config || !this.baseAuth) {
      throw new Error(
        "ServiceNow connector not connected. Call connect() first."
      );
    }

    const url = `${this.config.instanceUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Basic ${this.baseAuth}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const response = await fetch(url, {
      method: options?.method ?? "GET",
      headers,
      body: options?.body,
    });

    if (!response.ok) {
      let errorBody = "";
      try {
        const errorJson = await response.json() as { error?: { message?: string }; message?: string };
        errorBody = errorJson.error?.message || errorJson.message || "";
      } catch {
        errorBody = await response.text();
      }

      throw new Error(
        `ServiceNow API error: ${response.status} ${response.statusText}. ${errorBody}`
      );
    }

    // Extract total count header for pagination
    const totalCount = response.headers.get("x-total-count");

    const text = await response.text();
    if (!text) {
      return { headers: { "x-total-count": totalCount || "0" } };
    }

    const json = JSON.parse(text);
    return {
      ...json,
      headers: { "x-total-count": totalCount || "0" },
    };
  }

  /**
   * Map ServiceNow API response to ServiceNowRecord
   */
  private mapRecord(
    tableName: string,
    response: Record<string, unknown>
  ): ServiceNowRecord {
    // Extract sys_id and number first
    const sysId = response.sys_id as string;
    const number = response.number as string;

    // Build fields excluding metadata fields
    const fields: Record<string, unknown> = {};
    const excludedKeys = [
      "sys_id",
      "sys_is_masked",
      "sys_moved_to",
      "sys_policy",
      "sys_tags",
      "sys_class_name",
      "sys_created_by",
      "sys_created_on",
      "sys_domain",
      "sys_domain_path",
      "sys_mod_count",
      "sys_package",
      "sys_patch",
      "sys_record_created",
      "sys_tags",
      "sys_updated_by",
      "sys_updated_on",
      "updatable",
      "validates",
    ];

    for (const [key, value] of Object.entries(response)) {
      if (!excludedKeys.includes(key)) {
        fields[key] = value;
      }
    }

    return {
      sys_id: sysId || "",
      number: number || "",
      tableName,
      fields,
      createdOn: (response.sys_created_on as string) || "",
      updatedOn: (response.sys_updated_on as string) || "",
    };
  }
}

/**
 * ServiceNow Tool wrapper for agent execution
 */
export class ServiceNowTool implements Tool {
  name = "servicenow";
  description = "Interact with ServiceNow ITSM: create tickets, query records, check SLAs, trigger workflows";

  inputSchema = {
    type: "object" as const,
    properties: {
      action: {
        type: "string" as const,
        enum: [
          "query",
          "get",
          "getByNumber",
          "create",
          "update",
          "delete",
          "getSLA",
          "triggerFlow",
          "getTableMeta",
        ],
        description: "The ServiceNow action to perform",
      },
      tableName: {
        type: "string",
        description: "ServiceNow table name (e.g., incident, problem, sc_request)",
      },
      sysId: {
        type: "string",
        description: "Record sys_id",
      },
      number: {
        type: "string",
        description: "Record number (e.g., INC0012345)",
      },
      query: {
        type: "string",
        description: "Encoded query string (e.g., 'state=1^priority>2')",
      },
      fields: {
        type: "object",
        description: "Record fields for create/update",
      },
      flowName: {
        type: "string",
        description: "Flow Designer flow name to trigger",
      },
      flowInputs: {
        type: "object",
        description: "Inputs for the flow",
      },
      limit: {
        type: "number",
        description: "Maximum records to return",
      },
      offset: {
        type: "number",
        description: "Offset for pagination",
      },
    },
    required: ["action"],
  };

  constructor(private connector: ServiceNowConnector) {}

  async execute(
    ctx: unknown,
    args: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    try {
      const action = args.action as string;
      let result: unknown;

      switch (action) {
        case "query":
          result = await this.connector.queryRecords(args.tableName as string, {
            sysparmQuery: args.query as string,
            sysparmLimit: args.limit as number,
            sysparmOffset: args.offset as number,
          });
          break;

        case "get":
          result = await this.connector.getRecord(
            args.tableName as string,
            args.sysId as string
          );
          break;

        case "getByNumber":
          result = await this.connector.getRecordByNumber(
            args.tableName as string,
            args.number as string
          );
          break;

        case "create":
          result = await this.connector.createRecord({
            tableName: args.tableName as string,
            fields: args.fields as Record<string, unknown>,
          });
          break;

        case "update":
          result = await this.connector.updateRecord(
            args.tableName as string,
            args.sysId as string,
            args.fields as Record<string, unknown>
          );
          break;

        case "delete":
          await this.connector.deleteRecord(
            args.tableName as string,
            args.sysId as string
          );
          result = { success: true };
          break;

        case "getSLA":
          result = await this.connector.getSLAStatus(args.sysId as string);
          break;

        case "triggerFlow":
          result = await this.connector.triggerFlow(
            args.flowName as string,
            args.flowInputs as Record<string, unknown>
          );
          break;

        case "getTableMeta":
          result = await this.connector.getTableMetadata(args.tableName as string);
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

export default ServiceNowConnector;
