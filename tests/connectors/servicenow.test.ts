/**
 * ServiceNow Connector Tests
 * Phase 2 - Item 2.4 Enterprise Connector: ServiceNow
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ServiceNowConnector,
  ServiceNowTool,
} from "../../src/internal/connectors/servicenow.js";

describe("ServiceNowConnector", () => {
  let connector: ServiceNowConnector;

  const validConfig = {
    instanceUrl: "https://test-instance.service-now.com",
    username: "admin",
    password: "test-password",
  };

  beforeEach(() => {
    connector = new ServiceNowConnector("test-servicenow-connector");
  });

  describe("constructor and properties", () => {
    it("should initialize with correct id and type", () => {
      expect(connector.id).toBe("test-servicenow-connector");
      expect(connector.type).toBe("servicenow");
    });

    it("should not be connected initially", () => {
      expect(connector.isConnected()).toBe(false);
    });
  });

  describe("connect validation", () => {
    it("should throw error when missing instanceUrl", async () => {
      await expect(
        connector.connect({
          instanceUrl: "",
          username: "admin",
          password: "pass",
        } as unknown as Record<string, unknown>)
      ).rejects.toThrow("Missing required ServiceNow credentials");
    });

    it("should throw error when missing username", async () => {
      await expect(
        connector.connect({
          instanceUrl: "https://test.service-now.com",
          username: "",
          password: "pass",
        } as unknown as Record<string, unknown>)
      ).rejects.toThrow("Missing required ServiceNow credentials");
    });

    it("should throw error when missing password", async () => {
      await expect(
        connector.connect({
          instanceUrl: "https://test.service-now.com",
          username: "admin",
          password: "",
        } as unknown as Record<string, unknown>)
      ).rejects.toThrow("Missing required ServiceNow credentials");
    });

    it("should throw error for invalid instanceUrl format", async () => {
      await expect(
        connector.connect({
          instanceUrl: "not-a-valid-url",
          username: "admin",
          password: "pass",
        } as unknown as Record<string, unknown>)
      ).rejects.toThrow("Invalid ServiceNow instanceUrl");
    });
  });

  describe("disconnect", () => {
    it("should remain disconnected after disconnect is called", async () => {
      await connector.disconnect();
      expect(connector.isConnected()).toBe(false);
    });
  });

  describe("API methods without connection", () => {
    it("should throw error for getCurrentUser when not connected", async () => {
      await expect(connector.getCurrentUser()).rejects.toThrow("not connected");
    });

    it("should throw error for queryRecords when not connected", async () => {
      await expect(connector.queryRecords("incident")).rejects.toThrow("not connected");
    });

    it("should throw error for getRecord when not connected", async () => {
      await expect(connector.getRecord("incident", "sys-id-123")).rejects.toThrow(
        "not connected"
      );
    });

    it("should throw error for getRecordByNumber when not connected", async () => {
      await expect(connector.getRecordByNumber("incident", "INC0012345")).rejects.toThrow(
        "not connected"
      );
    });

    it("should throw error for createRecord when not connected", async () => {
      await expect(
        connector.createRecord({
          tableName: "incident",
          fields: { short_description: "Test" },
        })
      ).rejects.toThrow("not connected");
    });

    it("should throw error for updateRecord when not connected", async () => {
      await expect(
        connector.updateRecord("incident", "sys-id-123", { state: 2 })
      ).rejects.toThrow("not connected");
    });

    it("should throw error for deleteRecord when not connected", async () => {
      await expect(connector.deleteRecord("incident", "sys-id-123")).rejects.toThrow(
        "not connected"
      );
    });

    it("should throw error for getSLAStatus when not connected", async () => {
      await expect(connector.getSLAStatus("sys-id-123")).rejects.toThrow("not connected");
    });

    it("should throw error for triggerFlow when not connected", async () => {
      await expect(
        connector.triggerFlow("test-flow", { param: "value" })
      ).rejects.toThrow("not connected");
    });

    it("should throw error for getTableMetadata when not connected", async () => {
      await expect(connector.getTableMetadata("incident")).rejects.toThrow("not connected");
    });
  });
});

describe("ServiceNowTool", () => {
  let tool: ServiceNowTool;
  let mockConnector: {
    queryRecords: ReturnType<typeof vi.fn>;
    getRecord: ReturnType<typeof vi.fn>;
    getRecordByNumber: ReturnType<typeof vi.fn>;
    createRecord: ReturnType<typeof vi.fn>;
    updateRecord: ReturnType<typeof vi.fn>;
    deleteRecord: ReturnType<typeof vi.fn>;
    getSLAStatus: ReturnType<typeof vi.fn>;
    triggerFlow: ReturnType<typeof vi.fn>;
    getTableMetadata: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockConnector = {
      queryRecords: vi.fn(),
      getRecord: vi.fn(),
      getRecordByNumber: vi.fn(),
      createRecord: vi.fn(),
      updateRecord: vi.fn(),
      deleteRecord: vi.fn(),
      getSLAStatus: vi.fn(),
      triggerFlow: vi.fn(),
      getTableMetadata: vi.fn(),
    };

    tool = new ServiceNowTool(mockConnector as unknown as ServiceNowConnector);
  });

  describe("tool properties", () => {
    it("should have correct name", () => {
      expect(tool.name).toBe("servicenow");
    });

    it("should have description", () => {
      expect(tool.description).toBeDefined();
      expect(typeof tool.description).toBe("string");
    });

    it("should have inputSchema with correct structure", () => {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.properties).toBeDefined();
      expect(tool.inputSchema.properties.action).toBeDefined();
    });

    it("should require action in inputSchema", () => {
      expect(tool.inputSchema.required).toContain("action");
    });
  });

  describe("execute", () => {
    it("should execute query action successfully", async () => {
      const mockResult = {
        count: 2,
        records: [
          { sys_id: "1", number: "INC001", tableName: "incident" },
          { sys_id: "2", number: "INC002", tableName: "incident" },
        ],
      };
      mockConnector.queryRecords.mockResolvedValueOnce(mockResult);

      const result = await tool.execute({}, { action: "query", tableName: "incident" });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
      expect(mockConnector.queryRecords).toHaveBeenCalledWith("incident", {
        sysparmQuery: undefined,
        sysparmLimit: undefined,
        sysparmOffset: undefined,
      });
    });

    it("should execute query with options", async () => {
      mockConnector.queryRecords.mockResolvedValueOnce({
        count: 0,
        records: [],
      });

      await tool.execute(
        {},
        {
          action: "query",
          tableName: "incident",
          query: "state=1",
          limit: 10,
          offset: 20,
        }
      );

      expect(mockConnector.queryRecords).toHaveBeenCalledWith("incident", {
        sysparmQuery: "state=1",
        sysparmLimit: 10,
        sysparmOffset: 20,
      });
    });

    it("should execute get action successfully", async () => {
      const mockRecord = { sys_id: "sys-123", number: "INC0012345", tableName: "incident" };
      mockConnector.getRecord.mockResolvedValueOnce(mockRecord);

      const result = await tool.execute(
        {},
        { action: "get", tableName: "incident", sysId: "sys-123" }
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockRecord);
      expect(mockConnector.getRecord).toHaveBeenCalledWith("incident", "sys-123");
    });

    it("should execute getByNumber action successfully", async () => {
      const mockRecord = { sys_id: "sys-123", number: "INC0012345", tableName: "incident" };
      mockConnector.getRecordByNumber.mockResolvedValueOnce(mockRecord);

      const result = await tool.execute(
        {},
        { action: "getByNumber", tableName: "incident", number: "INC0012345" }
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockRecord);
      expect(mockConnector.getRecordByNumber).toHaveBeenCalledWith(
        "incident",
        "INC0012345"
      );
    });

    it("should execute create action successfully", async () => {
      const newRecord = {
        sys_id: "sys-new",
        number: "INC001",
        tableName: "incident",
        fields: { short_description: "Test incident" },
      };
      mockConnector.createRecord.mockResolvedValueOnce(newRecord);

      const result = await tool.execute(
        {},
        {
          action: "create",
          tableName: "incident",
          fields: { short_description: "Test incident" },
        }
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(newRecord);
      expect(mockConnector.createRecord).toHaveBeenCalledWith({
        tableName: "incident",
        fields: { short_description: "Test incident" },
      });
    });

    it("should execute update action successfully", async () => {
      const updatedRecord = {
        sys_id: "sys-123",
        number: "INC001",
        tableName: "incident",
        fields: { state: 2 },
      };
      mockConnector.updateRecord.mockResolvedValueOnce(updatedRecord);

      const result = await tool.execute(
        {},
        {
          action: "update",
          tableName: "incident",
          sysId: "sys-123",
          fields: { state: 2 },
        }
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedRecord);
      expect(mockConnector.updateRecord).toHaveBeenCalledWith(
        "incident",
        "sys-123",
        { state: 2 }
      );
    });

    it("should execute delete action successfully", async () => {
      mockConnector.deleteRecord.mockResolvedValueOnce(undefined);

      const result = await tool.execute(
        {},
        { action: "delete", tableName: "incident", sysId: "sys-123" }
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ success: true });
      expect(mockConnector.deleteRecord).toHaveBeenCalledWith("incident", "sys-123");
    });

    it("should execute getSLA action successfully", async () => {
      const slaData = { stage: "In Progress", remaining_time: 3600 };
      mockConnector.getSLAStatus.mockResolvedValueOnce(slaData);

      const result = await tool.execute({}, { action: "getSLA", sysId: "sys-123" });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(slaData);
      expect(mockConnector.getSLAStatus).toHaveBeenCalledWith("sys-123");
    });

    it("should execute triggerFlow action successfully", async () => {
      const flowResult = { flow_id: "flow-123", status: "started" };
      mockConnector.triggerFlow.mockResolvedValueOnce(flowResult);

      const result = await tool.execute(
        {},
        { action: "triggerFlow", flowName: "approve-request", flowInputs: { request_id: "123" } }
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(flowResult);
      expect(mockConnector.triggerFlow).toHaveBeenCalledWith("approve-request", {
        request_id: "123",
      });
    });

    it("should execute getTableMeta action successfully", async () => {
      const metaData = { columns: ["number", "state", "priority"] };
      mockConnector.getTableMetadata.mockResolvedValueOnce(metaData);

      const result = await tool.execute(
        {},
        { action: "getTableMeta", tableName: "incident" }
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(metaData);
      expect(mockConnector.getTableMetadata).toHaveBeenCalledWith("incident");
    });

    it("should return error for unknown action", async () => {
      const result = await tool.execute({}, { action: "unknown_action" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown action");
    });

    it("should return error when connector throws", async () => {
      mockConnector.queryRecords.mockRejectedValueOnce(new Error("Connection timeout"));

      const result = await tool.execute({}, { action: "query", tableName: "incident" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection timeout");
    });

    it("should return error for non-Error exceptions", async () => {
      mockConnector.getRecord.mockRejectedValueOnce("String error");

      const result = await tool.execute(
        {},
        { action: "get", tableName: "incident", sysId: "sys-123" }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("String error");
    });
  });

  describe("inputSchema actions", () => {
    it("should include all expected actions", () => {
      const expectedActions = [
        "query",
        "get",
        "getByNumber",
        "create",
        "update",
        "delete",
        "getSLA",
        "triggerFlow",
        "getTableMeta",
      ];
      const actionEnum = tool.inputSchema.properties.action.enum;
      expect(actionEnum).toEqual(expectedActions);
    });

    it("should include query action in schema", () => {
      const actionEnum = tool.inputSchema.properties.action.enum;
      expect(actionEnum).toContain("query");
    });

    it("should include CRUD actions in schema", () => {
      const actionEnum = tool.inputSchema.properties.action.enum;
      expect(actionEnum).toContain("get");
      expect(actionEnum).toContain("getByNumber");
      expect(actionEnum).toContain("create");
      expect(actionEnum).toContain("update");
      expect(actionEnum).toContain("delete");
    });

    it("should include ITSM-specific actions in schema", () => {
      const actionEnum = tool.inputSchema.properties.action.enum;
      expect(actionEnum).toContain("getSLA");
      expect(actionEnum).toContain("triggerFlow");
      expect(actionEnum).toContain("getTableMeta");
    });
  });
});
