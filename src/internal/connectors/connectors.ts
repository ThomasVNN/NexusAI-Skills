import { Connector } from "../skills.interface.js";

export class DatabaseConnector implements Connector {
  id: string;
  type = "postgres";
  private connected = false;

  constructor(id: string) {
    this.id = id;
  }

  async connect(credentials: Record<string, any>): Promise<boolean> {
    // Mimic connection handshake
    this.connected = credentials.username && credentials.host ? true : false;
    return this.connected;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }
}
