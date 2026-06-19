/**
 * NexusAI Skills - Database Client
 * 
 * Simple database abstraction layer.
 * Can be extended with Prisma for production use.
 */

// In-memory storage fallback when database is not available
interface InMemoryRecord {
  id: string;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

class InMemoryStorage {
  private records: Map<string, InMemoryRecord[]> = new Map();

  async create(collection: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const record: InMemoryRecord = {
      id,
      data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!this.records.has(collection)) {
      this.records.set(collection, []);
    }
    this.records.get(collection)!.push(record);

    return { id, ...data };
  }

  async findMany(collection: string, filter?: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    const records = this.records.get(collection) || [];
    if (!filter) return records.map(r => ({ id: r.id, ...r.data }));

    return records
      .filter(r => Object.entries(filter).every(([k, v]) => r.data[k] === v))
      .map(r => ({ id: r.id, ...r.data }));
  }

  async findUnique(collection: string, id: string): Promise<Record<string, unknown> | null> {
    const records = this.records.get(collection) || [];
    const record = records.find(r => r.id === id);
    return record ? { id: record.id, ...record.data } : null;
  }

  async update(collection: string, id: string, data: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const records = this.records.get(collection) || [];
    const index = records.findIndex(r => r.id === id);
    if (index === -1) return null;

    records[index] = {
      ...records[index],
      data: { ...records[index].data, ...data },
      updatedAt: new Date(),
    };

    return { id, ...records[index].data };
  }

  async delete(collection: string, id: string): Promise<boolean> {
    const records = this.records.get(collection) || [];
    const index = records.findIndex(r => r.id === id);
    if (index === -1) return false;

    records.splice(index, 1);
    return true;
  }

  async count(collection: string): Promise<number> {
    return (this.records.get(collection) || []).length;
  }
}

// Singleton instance
let storage: InMemoryStorage | null = null;

export function getStorage(): InMemoryStorage {
  if (!storage) {
    storage = new InMemoryStorage();
  }
  return storage;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  // Always return true - in-memory storage is always available
  return true;
}
