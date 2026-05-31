import { z } from "zod";
import { Tool } from "../../internal/skills.interface.js";
import { createBaseSkillMetadata } from "../types.js";

/**
 * Input schema for data transformation
 */
const DataTransformInputSchema = z.object({
  operation: z.enum(["csv-to-json", "json-to-csv", "excel-to-json", "json-to-excel", "filter", "map", "reduce", "merge", "split"]),
  data: z.union([z.string(), z.array(z.any()), z.record(z.any())]).describe("Input data to transform"),
  options: z.object({
    delimiter: z.string().optional().default(",").describe("CSV delimiter"),
    headers: z.array(z.string()).optional().describe("Custom headers for CSV"),
    encoding: z.string().optional().default("utf-8"),
    sheetName: z.string().optional().describe("Excel sheet name"),
    filterField: z.string().optional().describe("Field to filter on"),
    filterValue: z.any().optional().describe("Value to filter by"),
    mapFields: z.record(z.string()).optional().describe("Field mapping for transformation"),
    splitOn: z.string().optional().describe("Field to split array data on"),
  }).optional().default({}),
});

/**
 * Output schema for data transformation results
 */
const DataTransformOutputSchema = z.object({
  success: z.boolean(),
  result: z.any().optional(),
  resultType: z.enum(["json", "csv", "array", "object"]).optional(),
  recordCount: z.number().optional(),
  executionTimeMs: z.number().optional(),
  error: z.string().optional(),
});

type DataTransformInput = z.infer<typeof DataTransformInputSchema>;
type DataTransformOutput = z.infer<typeof DataTransformOutputSchema>;

/**
 * Data Transformation Skill
 * Handles CSV, JSON, Excel processing and data transformations
 */
export class DataTransformSkill implements Tool {
  name = "data_transform";
  description = "Transform data between formats (CSV, JSON, Excel) and perform data operations";
  inputSchema = DataTransformInputSchema;

  private readonly metadata = createBaseSkillMetadata({
    id: "data-transform",
    name: "Data Transformer",
    description: "Transform data between formats (CSV, JSON, Excel) and perform filtering, mapping, and aggregation",
    category: "data",
    version: "1.0.0",
    author: "NexusAI",
    requiredPermissions: ["read:data", "write:data"],
    requiredCapabilities: ["data-processor"],
    estimatedDuration: "3-15s",
    trustScore: 90,
    requiresHumanApproval: false,
    rateLimitPerMinute: 60,
    inputSchema: DataTransformInputSchema,
    outputSchema: DataTransformOutputSchema,
  });

  getMetadata() {
    return this.metadata;
  }

  async execute(ctx: any, args: Record<string, any>): Promise<Record<string, any>> {
    const startTime = Date.now();
    const params = DataTransformInputSchema.parse(args);

    try {
      let result: any;
      let resultType: "json" | "csv" | "array" | "object" = "json";

      switch (params.operation) {
        case "csv-to-json":
          result = await this.csvToJson(params.data as string, params.options);
          resultType = "json";
          break;
        case "json-to-csv":
          result = await this.jsonToCsv(params.data, params.options);
          resultType = "csv";
          break;
        case "excel-to-json":
          result = await this.excelToJson(params.data as string, params.options);
          resultType = "json";
          break;
        case "filter":
          result = await this.filterData(params.data, params.options);
          resultType = Array.isArray(result) ? "array" : "object";
          break;
        case "map":
          result = await this.mapData(params.data, params.options);
          resultType = Array.isArray(result) ? "array" : "object";
          break;
        case "merge":
          result = await this.mergeData(params.data, params.options);
          resultType = "array";
          break;
        case "split":
          result = await this.splitData(params.data, params.options);
          resultType = "array";
          break;
        default:
          throw new Error(`Unsupported operation: ${params.operation}`);
      }

      const recordCount = Array.isArray(result) ? result.length : (typeof result === "object" ? 1 : 0);

      return {
        success: true,
        result,
        resultType,
        recordCount,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Transformation failed",
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  private async csvToJson(csv: string, options: any): Promise<any[]> {
    const delimiter = options.delimiter || ",";
    const lines = csv.trim().split("\n");
    
    if (lines.length === 0) return [];
    
    const headers = options.headers || lines[0].split(delimiter).map((h: string) => h.trim());
    const rows: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map((v: string) => v.trim());
      const row: any = {};
      headers.forEach((header: string, idx: number) => {
        row[header] = values[idx] || "";
      });
      rows.push(row);
    }
    
    return rows;
  }

  private async jsonToCsv(data: any, options: any): Promise<string> {
    const delimiter = options.delimiter || ",";
    const records = Array.isArray(data) ? data : [data];
    
    if (records.length === 0) return "";
    
    const headers = options.headers || Object.keys(records[0]);
    const lines: string[] = [headers.join(delimiter)];
    
    for (const record of records) {
      const values = headers.map((h: string) => {
        const val = record[h];
        const str = val === null || val === undefined ? "" : String(val);
        return str.includes(delimiter) || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      });
      lines.push(values.join(delimiter));
    }
    
    return lines.join("\n");
  }

  private async excelToJson(excelData: string, options: any): Promise<any[]> {
    // Mock Excel parsing - in production use xlsx library
    const sheetName = options.sheetName || "Sheet1";
    return [
      { sheet: sheetName, data: "Parsed Excel content", rowCount: 0 }
    ];
  }

  private async filterData(data: any, options: any): Promise<any[]> {
    const records = Array.isArray(data) ? data : [data];
    const { filterField, filterValue } = options;
    
    if (!filterField) return records;
    
    return records.filter((record: any) => {
      const fieldValue = record[filterField];
      if (Array.isArray(filterValue)) {
        return filterValue.includes(fieldValue);
      }
      return fieldValue === filterValue;
    });
  }

  private async mapData(data: any, options: any): Promise<any[]> {
    const records = Array.isArray(data) ? data : [data];
    const { mapFields } = options;
    
    if (!mapFields) return records;
    
    return records.map((record: any) => {
      const mapped: any = {};
      for (const [from, to] of Object.entries(mapFields)) {
        mapped[to as string] = record[from as string];
      }
      return mapped;
    });
  }

  private async mergeData(data: any, options: any): Promise<any[]> {
    const arrays = Array.isArray(data) ? data : [data, data];
    return arrays.flat();
  }

  private async splitData(data: any, options: any): Promise<any[]> {
    const records = Array.isArray(data) ? data : [data];
    const { splitOn } = options;
    
    if (!splitOn) return records;
    
    return records.flatMap((record: any) => {
      const value = record[splitOn];
      if (Array.isArray(value)) {
        return value.map((v: any) => ({ ...record, [splitOn]: v }));
      }
      return [record];
    });
  }
}
