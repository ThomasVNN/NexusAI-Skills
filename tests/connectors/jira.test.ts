/**
 * Jira Connector Tests
 * Phase 2 - Item 2.3 Enterprise Connector: Jira
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { JiraConnector, JiraTool } from "../../src/internal/connectors/jira.js";

describe("JiraConnector", () => {
  let connector: JiraConnector;

  const validConfig = {
    baseUrl: "https://test.atlassian.net",
    email: "test@example.com",
    apiToken: "test-token",
  };

  beforeEach(() => {
    connector = new JiraConnector("test-jira-connector");
  });

  describe("constructor and properties", () => {
    it("should initialize with correct id and type", () => {
      expect(connector.id).toBe("test-jira-connector");
      expect(connector.type).toBe("jira");
    });

    it("should not be connected initially", () => {
      expect(connector.isConnected()).toBe(false);
    });
  });

  describe("connect validation", () => {
    it("should throw error when missing baseUrl", async () => {
      await expect(
        connector.connect({
          baseUrl: "",
          email: "test@example.com",
          apiToken: "token",
        } as unknown as Record<string, unknown>)
      ).rejects.toThrow("Missing required Jira credentials");
    });

    it("should throw error when missing email", async () => {
      await expect(
        connector.connect({
          baseUrl: "https://test.atlassian.net",
          email: "",
          apiToken: "token",
        } as unknown as Record<string, unknown>)
      ).rejects.toThrow("Missing required Jira credentials");
    });

    it("should throw error when missing apiToken", async () => {
      await expect(
        connector.connect({
          baseUrl: "https://test.atlassian.net",
          email: "test@example.com",
          apiToken: "",
        } as unknown as Record<string, unknown>)
      ).rejects.toThrow("Missing required Jira credentials");
    });

    it("should throw error for invalid baseUrl format", async () => {
      await expect(
        connector.connect({
          baseUrl: "not-a-valid-url",
          email: "test@example.com",
          apiToken: "token",
        } as unknown as Record<string, unknown>)
      ).rejects.toThrow("Invalid Jira baseUrl");
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

    it("should throw error for searchIssues when not connected", async () => {
      await expect(connector.searchIssues("project = TEST")).rejects.toThrow("not connected");
    });

    it("should throw error for getIssue when not connected", async () => {
      await expect(connector.getIssue("TEST-1")).rejects.toThrow("not connected");
    });

    it("should throw error for createIssue when not connected", async () => {
      await expect(
        connector.createIssue({
          summary: "Test",
          projectKey: "TEST",
          issueType: "Task",
        })
      ).rejects.toThrow("not connected");
    });

    it("should throw error for updateIssue when not connected", async () => {
      await expect(
        connector.updateIssue("TEST-1", { summary: "Updated" })
      ).rejects.toThrow("not connected");
    });

    it("should throw error for addComment when not connected", async () => {
      await expect(connector.addComment("TEST-1", "Comment")).rejects.toThrow("not connected");
    });

    it("should throw error for transitionIssue when not connected", async () => {
      await expect(connector.transitionIssue("TEST-1", "Done")).rejects.toThrow("not connected");
    });

    it("should throw error for getProject when not connected", async () => {
      await expect(connector.getProject("TEST")).rejects.toThrow("not connected");
    });

    it("should throw error for getIssueTypes when not connected", async () => {
      await expect(connector.getIssueTypes("TEST")).rejects.toThrow("not connected");
    });
  });
});

describe("JiraTool", () => {
  let tool: JiraTool;
  let mockConnector: {
    searchIssues: ReturnType<typeof vi.fn>;
    getIssue: ReturnType<typeof vi.fn>;
    createIssue: ReturnType<typeof vi.fn>;
    updateIssue: ReturnType<typeof vi.fn>;
    addComment: ReturnType<typeof vi.fn>;
    transitionIssue: ReturnType<typeof vi.fn>;
    getProject: ReturnType<typeof vi.fn>;
    getIssueTypes: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockConnector = {
      searchIssues: vi.fn(),
      getIssue: vi.fn(),
      createIssue: vi.fn(),
      updateIssue: vi.fn(),
      addComment: vi.fn(),
      transitionIssue: vi.fn(),
      getProject: vi.fn(),
      getIssueTypes: vi.fn(),
    };

    tool = new JiraTool(mockConnector as unknown as JiraConnector);
  });

  describe("tool properties", () => {
    it("should have correct name", () => {
      expect(tool.name).toBe("jira");
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
    it("should execute search action successfully", async () => {
      const mockResult = {
        total: 2,
        issues: [
          { id: "1", key: "TEST-1", summary: "Test Issue 1" },
          { id: "2", key: "TEST-2", summary: "Test Issue 2" },
        ],
        startAt: 0,
        maxResults: 50,
      };
      mockConnector.searchIssues.mockResolvedValueOnce(mockResult);

      const result = await tool.execute({}, { action: "search", jql: "project = TEST" });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
      expect(mockConnector.searchIssues).toHaveBeenCalledWith("project = TEST", {
        fields: undefined,
      });
    });

    it("should execute search with custom fields", async () => {
      mockConnector.searchIssues.mockResolvedValueOnce({ total: 0, issues: [], startAt: 0, maxResults: 50 });

      await tool.execute({}, { action: "search", jql: "project = TEST", fields: ["summary", "status"] });

      expect(mockConnector.searchIssues).toHaveBeenCalledWith("project = TEST", {
        fields: ["summary", "status"],
      });
    });

    it("should execute get action successfully", async () => {
      const mockIssue = { id: "1", key: "TEST-1", summary: "Test Issue" };
      mockConnector.getIssue.mockResolvedValueOnce(mockIssue);

      const result = await tool.execute({}, { action: "get", issueKey: "TEST-1" });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockIssue);
      expect(mockConnector.getIssue).toHaveBeenCalledWith("TEST-1");
    });

    it("should execute create action successfully", async () => {
      const newIssue = { id: "100", key: "TEST-100", summary: "New Issue" };
      mockConnector.createIssue.mockResolvedValueOnce(newIssue);

      const result = await tool.execute(
        {},
        {
          action: "create",
          projectKey: "TEST",
          issueType: "Task",
          summary: "New Issue",
          description: "Issue description",
        }
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(newIssue);
      expect(mockConnector.createIssue).toHaveBeenCalledWith({
        summary: "New Issue",
        description: "Issue description",
        projectKey: "TEST",
        issueType: "Task",
        priority: undefined,
        labels: undefined,
      });
    });

    it("should execute create action with optional fields", async () => {
      const newIssue = { id: "101", key: "TEST-101", summary: "Bug Issue" };
      mockConnector.createIssue.mockResolvedValueOnce(newIssue);

      await tool.execute(
        {},
        {
          action: "create",
          projectKey: "TEST",
          issueType: "Bug",
          summary: "Bug Issue",
          priority: "High",
          labels: ["bug", "urgent"],
        }
      );

      expect(mockConnector.createIssue).toHaveBeenCalledWith({
        summary: "Bug Issue",
        description: undefined,
        projectKey: "TEST",
        issueType: "Bug",
        priority: "High",
        labels: ["bug", "urgent"],
      });
    });

    it("should execute update action successfully", async () => {
      const updatedIssue = { id: "1", key: "TEST-1", summary: "Updated Summary" };
      mockConnector.updateIssue.mockResolvedValueOnce(updatedIssue);

      const result = await tool.execute(
        {},
        {
          action: "update",
          issueKey: "TEST-1",
          summary: "Updated Summary",
          description: "New description",
        }
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedIssue);
      expect(mockConnector.updateIssue).toHaveBeenCalledWith("TEST-1", {
        summary: "Updated Summary",
        description: "New description",
        priority: undefined,
        labels: undefined,
      });
    });

    it("should execute addComment action successfully", async () => {
      const commentResult = { id: "comment-1", body: "Test comment" };
      mockConnector.addComment.mockResolvedValueOnce(commentResult);

      const result = await tool.execute({}, { action: "addComment", issueKey: "TEST-1", comment: "Test comment" });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(commentResult);
      expect(mockConnector.addComment).toHaveBeenCalledWith("TEST-1", "Test comment");
    });

    it("should execute transition action successfully", async () => {
      mockConnector.transitionIssue.mockResolvedValueOnce(undefined);

      const result = await tool.execute({}, { action: "transition", issueKey: "TEST-1", status: "In Progress" });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ success: true });
      expect(mockConnector.transitionIssue).toHaveBeenCalledWith("TEST-1", "In Progress");
    });

    it("should execute getProject action successfully", async () => {
      const projectData = { id: "1", key: "TEST", name: "Test Project" };
      mockConnector.getProject.mockResolvedValueOnce(projectData);

      const result = await tool.execute({}, { action: "getProject", projectKey: "TEST" });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(projectData);
      expect(mockConnector.getProject).toHaveBeenCalledWith("TEST");
    });

    it("should execute getIssueTypes action successfully", async () => {
      const issueTypes = [
        { id: "1", name: "Task" },
        { id: "2", name: "Bug" },
        { id: "3", name: "Story" },
      ];
      mockConnector.getIssueTypes.mockResolvedValueOnce(issueTypes);

      const result = await tool.execute({}, { action: "getIssueTypes", projectKey: "TEST" });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(issueTypes);
      expect(mockConnector.getIssueTypes).toHaveBeenCalledWith("TEST");
    });

    it("should return error for unknown action", async () => {
      const result = await tool.execute({}, { action: "unknown_action" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown action");
    });

    it("should return error when connector throws", async () => {
      mockConnector.searchIssues.mockRejectedValueOnce(new Error("Connection timeout"));

      const result = await tool.execute({}, { action: "search", jql: "project = TEST" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection timeout");
    });

    it("should return error for non-Error exceptions", async () => {
      mockConnector.getIssue.mockRejectedValueOnce("String error");

      const result = await tool.execute({}, { action: "get", issueKey: "TEST-1" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("String error");
    });
  });

  describe("inputSchema actions", () => {
    it("should include search action in schema", () => {
      const actionEnum = tool.inputSchema.properties.action.enum;
      expect(actionEnum).toContain("search");
    });

    it("should include get action in schema", () => {
      const actionEnum = tool.inputSchema.properties.action.enum;
      expect(actionEnum).toContain("get");
    });

    it("should include create action in schema", () => {
      const actionEnum = tool.inputSchema.properties.action.enum;
      expect(actionEnum).toContain("create");
    });

    it("should include update action in schema", () => {
      const actionEnum = tool.inputSchema.properties.action.enum;
      expect(actionEnum).toContain("update");
    });

    it("should include transition action in schema", () => {
      const actionEnum = tool.inputSchema.properties.action.enum;
      expect(actionEnum).toContain("transition");
    });

    it("should include all expected actions", () => {
      const expectedActions = [
        "search",
        "get",
        "create",
        "update",
        "addComment",
        "transition",
        "getProject",
        "getIssueTypes",
      ];
      const actionEnum = tool.inputSchema.properties.action.enum;
      expect(actionEnum).toEqual(expectedActions);
    });
  });
});
