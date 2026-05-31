import { z } from "zod";
import { Tool } from "../../internal/skills.interface.js";
import { createBaseSkillMetadata } from "../types.js";

/**
 * Input schema for data validation
 */
const DataValidationInputSchema = z.object({
  data: z.union([z.string(), z.array(z.any()), z.record(z.any())]).describe("Data to validate"),
  rules: z.array(z.object({
    field: z.string().describe("Field path to validate (dot notation supported)"),
    type: z.enum(["required", "string", "number", "boolean", "email", "url", "date", "pattern", "range", "enum"]),
    value: z.any().optional(),
    message: z.string().optional().describe("Custom error message"),
  })).describe("Validation rules to apply"),
  strict: z.boolean().optional().default(false).describe("Fail on first error if true"),
});

/**
 * Output schema for validation results
 */
const DataValidationOutputSchema = z.object({
  success: z.boolean(),
  isValid: z.boolean(),
  errors: z.array(z.object({
    field: z.string(),
    message: z.string(),
    value: z.any().optional(),
  })).optional(),
  validatedAt: z.string().optional(),
  executionTimeMs: z.number().optional(),
});

type DataValidationInput = z.infer<typeof DataValidationInputSchema>;
type DataValidationOutput = z.infer<typeof DataValidationOutputSchema>;

/**
 * Data Validation Skill
 * Validates data quality against configurable rules
 */
export class DataValidationSkill implements Tool {
  name = "data_validation";
  description = "Validate data quality against configurable rules for type, format, and constraints";
  inputSchema = DataValidationInputSchema;

  private readonly metadata = createBaseSkillMetadata({
    id: "data-validation",
    name: "Data Validator",
    description: "Validate data quality against configurable rules for type, format, range, and constraints",
    category: "data",
    version: "1.0.0",
    author: "NexusAI",
    requiredPermissions: ["read:data"],
    requiredCapabilities: ["data-processor", "validator"],
    estimatedDuration: "1-5s",
    trustScore: 92,
    requiresHumanApproval: false,
    rateLimitPerMinute: 120,
    inputSchema: DataValidationInputSchema,
    outputSchema: DataValidationOutputSchema,
  });

  getMetadata() {
    return this.metadata;
  }

  async execute(ctx: any, args: Record<string, any>): Promise<Record<string, any>> {
    const startTime = Date.now();
    const params = DataValidationInputSchema.parse(args);

    try {
      const records = Array.isArray(params.data) ? params.data : [params.data];
      const allErrors: Array<{ field: string; message: string; value?: any }> = [];
      let isValid = true;

      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        
        for (const rule of params.rules) {
          if (!rule.field) continue;
          const value = this.getFieldValue(record, rule.field);
          const errors = this.validateField(rule as { field: string; type: string; value?: any; message?: string }, value);
          
          if (errors.length > 0) {
            isValid = false;
            allErrors.push(...errors.map((e: any) => ({
              ...e,
              field: `${Array.isArray(params.data) ? `[${i}]` : ""}${rule.field}`,
            })));
            
            if (params.strict) {
              return {
                success: true,
                isValid: false,
                errors: allErrors,
                validatedAt: new Date().toISOString(),
                executionTimeMs: Date.now() - startTime,
              };
            }
          }
        }
      }

      return {
        success: true,
        isValid,
        errors: allErrors.length > 0 ? allErrors : undefined,
        validatedAt: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        isValid: false,
        errors: [{ field: "_system", message: error.message }],
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  private getFieldValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }

  private validateField(
    rule: { field: string; type: string; value?: any; message?: string },
    value: any
  ): Array<{ field: string; message: string; value?: any }> {
    const errors: Array<{ field: string; message: string; value?: any }> = [];
    const message = rule.message || `Validation failed for field ${rule.field}`;

    switch (rule.type) {
      case "required":
        if (value === null || value === undefined || value === "") {
          errors.push({ field: rule.field, message: `${rule.field} is required`, value });
        }
        break;

      case "string":
        if (value !== undefined && typeof value !== "string") {
          errors.push({ field: rule.field, message: `${rule.field} must be a string`, value });
        }
        break;

      case "number":
        if (value !== undefined && typeof value !== "number") {
          errors.push({ field: rule.field, message: `${rule.field} must be a number`, value });
        }
        break;

      case "boolean":
        if (value !== undefined && typeof value !== "boolean") {
          errors.push({ field: rule.field, message: `${rule.field} must be a boolean`, value });
        }
        break;

      case "email":
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors.push({ field: rule.field, message: `${rule.field} must be a valid email`, value });
        }
        break;

      case "url":
        if (value) {
          try {
            new URL(value);
          } catch {
            errors.push({ field: rule.field, message: `${rule.field} must be a valid URL`, value });
          }
        }
        break;

      case "date":
        if (value && isNaN(Date.parse(value))) {
          errors.push({ field: rule.field, message: `${rule.field} must be a valid date`, value });
        }
        break;

      case "pattern":
        if (value && rule.value && !new RegExp(rule.value).test(String(value))) {
          errors.push({ field: rule.field, message: message || `${rule.field} does not match pattern`, value });
        }
        break;

      case "range":
        if (value !== undefined && typeof value === "number") {
          const [min, max] = Array.isArray(rule.value) ? rule.value : [rule.value, rule.value];
          if (value < min || value > max) {
            errors.push({ field: rule.field, message: `${rule.field} must be between ${min} and ${max}`, value });
          }
        }
        break;

      case "enum":
        if (value !== undefined && rule.value && !rule.value.includes(value)) {
          errors.push({ field: rule.field, message: `${rule.field} must be one of: ${rule.value.join(", ")}`, value });
        }
        break;
    }

    return errors;
  }
}

/**
 * Common validation rules presets
 */
export const ValidationPresets = {
  email: { type: "email" as const },
  url: { type: "url" as const },
  phone: { type: "pattern" as const, value: "^[+]?[(]?[0-9]{1,4}[)]?[-\\s./0-9]*$" },
  uuid: { type: "pattern" as const, value: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" },
  vietnamPhone: { type: "pattern" as const, value: "^(0[0-9]{9,10})$" },
  vietnamId: { type: "pattern" as const, value: "^[0-9]{9}$|^[0-9]{12}$" },
};
