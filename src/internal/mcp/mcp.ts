import { Tool } from "../skills.interface.js";

export interface IMcpServer {
  registerTool(tool: Tool): void;
  listTools(): Tool[];
  handleCallTool(name: string, args: Record<string, any>): Promise<Record<string, any>>;
}

export class McpServer implements IMcpServer {
  private tools: Map<string, Tool> = new Map();

  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  listTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  async handleCallTool(name: string, args: Record<string, any>): Promise<Record<string, any>> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`MCP Tool ${name} not found`);
    }
    return tool.execute({}, args);
  }
}
