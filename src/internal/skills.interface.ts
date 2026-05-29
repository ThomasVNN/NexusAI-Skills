export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  permissions: string[];
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  execute(ctx: any, args: Record<string, any>): Promise<Record<string, any>>;
}

export interface Executor {
  execute(skill: Skill, toolName: string, args: Record<string, any>): Promise<Record<string, any>>;
}

export interface Connector {
  id: string;
  type: string;
  connect(credentials: Record<string, any>): Promise<boolean>;
  disconnect(): Promise<void>;
}
