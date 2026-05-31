import { z } from "zod";
import { Tool } from "../../internal/skills.interface.js";
import { createBaseSkillMetadata } from "../types.js";

/**
 * Input schema for test generation
 */
const TestGeneratorInputSchema = z.object({
  code: z.string().min(20).describe("Source code to generate tests for"),
  language: z.enum(["typescript", "javascript", "python", "go"]).default("typescript"),
  framework: z.enum(["vitest", "jest", "mocha", "pytest", "unittest", "testing", "go"]).default("vitest"),
  testType: z.enum(["unit", "integration", "e2e"]).optional().default("unit"),
  coverage: z.number().min(0).max(100).optional().default(80),
  includeEdgeCases: z.boolean().optional().default(true),
  includeMocking: z.boolean().optional().default(true),
});

/**
 * Output schema for test generation
 */
const TestGeneratorOutputSchema = z.object({
  success: z.boolean(),
  testFile: z.object({
    name: z.string(),
    path: z.string(),
    content: z.string(),
    language: z.string(),
  }).optional(),
  testCases: z.array(z.object({
    name: z.string(),
    type: z.enum(["happy-path", "edge-case", "error-case", "boundary"]),
    description: z.string(),
    input: z.any(),
    expectedOutput: z.any(),
  })).optional(),
  coverageEstimate: z.number().optional(),
  missingCoverage: z.array(z.object({
    function: z.string(),
    reason: z.string(),
  })).optional(),
  executionTimeMs: z.number().optional(),
  error: z.string().optional(),
});

type TestGeneratorInput = z.infer<typeof TestGeneratorInputSchema>;
type TestGeneratorOutput = z.infer<typeof TestGeneratorOutputSchema>;

/**
 * Test Case Definition
 */
interface TestCase {
  name: string;
  type: "happy-path" | "edge-case" | "error-case" | "boundary";
  description: string;
  input: any;
  expectedOutput: any;
}

/**
 * Test Generator Skill
 * Generates unit tests from code
 */
export class TestGeneratorSkill implements Tool {
  name = "test_generator";
  description = "Generate unit tests from source code with edge cases and mocking";
  inputSchema = TestGeneratorInputSchema;

  private readonly metadata = createBaseSkillMetadata({
    id: "test-generator",
    name: "Test Generator",
    description: "Generate comprehensive unit tests from source code including edge cases and mocking",
    category: "code",
    version: "1.0.0",
    author: "NexusAI",
    requiredPermissions: ["read:code", "write:code"],
    requiredCapabilities: ["test-generator", "code-analyzer"],
    estimatedDuration: "5-30s",
    trustScore: 85,
    requiresHumanApproval: false,
    rateLimitPerMinute: 15,
    inputSchema: TestGeneratorInputSchema,
    outputSchema: TestGeneratorOutputSchema,
  });

  getMetadata() {
    return this.metadata;
  }

  async execute(ctx: any, args: Record<string, any>): Promise<Record<string, any>> {
    const startTime = Date.now();
    const params = TestGeneratorInputSchema.parse(args);

    try {
      // Parse code to extract functions/methods
      const functions = this.extractFunctions(params.code, params.language);
      
      // Generate test cases
      const testCases = this.generateTestCases(functions, params.includeEdgeCases);
      
      // Generate test file content
      const testContent = this.generateTestFile(functions, testCases, params);
      
      // Estimate coverage
      const coverageEstimate = this.estimateCoverage(functions, testCases);
      
      // Identify missing coverage
      const missingCoverage = this.identifyMissingCoverage(functions, testCases);

      return {
        success: true,
        testFile: {
          name: `test_${this.getTestFileName(params.language)}`,
          path: this.getTestPath(params.language),
          content: testContent,
          language: params.language,
        },
        testCases,
        coverageEstimate,
        missingCoverage,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Test generation failed",
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  private extractFunctions(code: string, language: string): Array<{
    name: string;
    params: string[];
    returnType?: string;
    isAsync: boolean;
  }> {
    const functions: Array<{ name: string; params: string[]; returnType?: string; isAsync: boolean }> = [];

    const patterns: Record<string, RegExp> = {
      typescript: /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*(\w+))?\s*{/g,
      javascript: /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*{/g,
      python: /def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*(\w+))?:/gm,
      go: /func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(([^)]*)\)\s*(?:\([^)]*\)\s*)?(?:(\w+))?\s*{/g,
    };

    const pattern = patterns[language] || patterns.typescript;
    let match;

    while ((match = pattern.exec(code)) !== null) {
      const name = match[1];
      const params = match[2]
        .split(",")
        .map((p: string) => p.trim().split(/[:\s]/)[0])
        .filter((p: string) => p.length > 0);

      functions.push({
        name,
        params,
        returnType: match[3],
        isAsync: code.substring(0, match.index).includes("async"),
      });
    }

    // Also extract arrow functions for TS/JS
    if (language === "typescript" || language === "javascript") {
      const arrowPattern = /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*\w+)?\s*=>|(\w+)\s*:\s*(?:async\s*)?\([^)]*\)\s*(?::\s*\w+)?\s*=>/g;
      while ((match = arrowPattern.exec(code)) !== null) {
        const name = match[1] || match[2];
        if (name && !functions.find(f => f.name === name)) {
          functions.push({
            name,
            params: [],
            isAsync: false,
          });
        }
      }
    }

    return functions;
  }

  private generateTestCases(
    functions: Array<{ name: string; params: string[]; returnType?: string; isAsync: boolean }>,
    includeEdgeCases: boolean
  ): TestCase[] {
    const testCases: TestCase[] = [];

    for (const func of functions) {
      // Happy path test
      testCases.push({
        name: `${func.name} should return expected result`,
        type: "happy-path",
        description: `Tests basic functionality of ${func.name}`,
        input: this.generateMockInput(func.params),
        expectedOutput: this.generateMockOutput(func.returnType),
      });

      // Edge cases
      if (includeEdgeCases && func.params.length > 0) {
        testCases.push({
          name: `${func.name} should handle empty/null inputs`,
          type: "edge-case",
          description: `Tests edge case with empty values for ${func.name}`,
          input: func.params.map(() => null),
          expectedOutput: undefined,
        });

        testCases.push({
          name: `${func.name} should handle undefined inputs`,
          type: "edge-case",
          description: `Tests edge case with undefined values for ${func.name}`,
          input: func.params.map(() => undefined),
          expectedOutput: undefined,
        });
      }

      // Error case
      if (includeEdgeCases) {
        testCases.push({
          name: `${func.name} should throw on invalid input`,
          type: "error-case",
          description: `Tests error handling for invalid input to ${func.name}`,
          input: this.generateInvalidInput(func.params),
          expectedOutput: { shouldThrow: true },
        });
      }

      // Boundary cases
      if (includeEdgeCases) {
        testCases.push({
          name: `${func.name} should handle boundary values`,
          type: "boundary",
          description: `Tests boundary conditions for ${func.name}`,
          input: this.generateBoundaryInput(func.params),
          expectedOutput: undefined,
        });
      }
    }

    return testCases;
  }

  private generateMockInput(params: string[]): Record<string, any> {
    const input: Record<string, any> = {};
    for (const param of params) {
      // Generate sensible mock values based on parameter name
      if (/id|uuid|key/i.test(param)) {
        input[param] = "test-123";
      } else if (/name|title|label/i.test(param)) {
        input[param] = "Test Name";
      } else if (/count|num|length|size/i.test(param)) {
        input[param] = 1;
      } else if (/price|amount|total/i.test(param)) {
        input[param] = 99.99;
      } else if (/date|time/i.test(param)) {
        input[param] = new Date().toISOString();
      } else if (/enabled|active|visible/i.test(param)) {
        input[param] = true;
      } else {
        input[param] = "test-value";
      }
    }
    return input;
  }

  private generateMockOutput(returnType?: string): any {
    if (!returnType) return undefined;
    
    if (/string|text|title|name/i.test(returnType)) return "expected-result";
    if (/number|int|float|double/i.test(returnType)) return 42;
    if (/bool|boolean/i.test(returnType)) return true;
    if (/array|object|dict|map/i.test(returnType)) return { result: true };
    if (/promise|async/i.test(returnType)) return Promise.resolve({ result: true });
    
    return undefined;
  }

  private generateInvalidInput(params: string[]): Record<string, any> {
    const input: Record<string, any> = {};
    for (const param of params) {
      if (/num|count|length|size/i.test(param)) {
        input[param] = -1;
      } else if (/enabled|active/i.test(param)) {
        input[param] = null;
      } else {
        input[param] = "{invalid}";
      }
    }
    return input;
  }

  private generateBoundaryInput(params: string[]): Record<string, any> {
    const input: Record<string, any> = {};
    for (const param of params) {
      if (/num|count|length|size|limit|offset/i.test(param)) {
        input[param] = 0;
      } else if (/string|text|name/i.test(param)) {
        input[param] = "";
      } else if (/array|list/i.test(param)) {
        input[param] = [];
      } else {
        input[param] = null;
      }
    }
    return input;
  }

  private generateTestFile(
    functions: Array<{ name: string; params: string[]; returnType?: string; isAsync: boolean }>,
    testCases: TestCase[],
    params: z.infer<typeof TestGeneratorInputSchema>
  ): string {
    switch (params.framework) {
      case "vitest":
      case "jest":
        return this.generateVitestTests(functions, testCases, params);
      case "pytest":
        return this.generatePytestTests(functions, testCases);
      case "go":
        return this.generateGoTests(functions, testCases);
      default:
        return this.generateVitestTests(functions, testCases, params);
    }
  }

  private generateVitestTests(
    functions: Array<{ name: string; params: string[]; returnType?: string; isAsync: boolean }>,
    testCases: TestCase[],
    params: z.infer<typeof TestGeneratorInputSchema>
  ): string {
    const funcName = functions[0]?.name || "Component";
    const isTypeScript = params.language === "typescript";

    return `/**
 * Test file for ${funcName}
 * Generated by NexusAI Test Generator
 * Framework: ${params.framework}
 * Language: ${params.language}
 */

${isTypeScript ? `import { describe, it, expect, vi ${params.includeMocking ? ", beforeEach, afterEach" : ""} } from '${params.framework}';
import { ${functions.map(f => f.name).join(", ")} } from './source';
` : `// Tests for ${funcName}
// Generated by NexusAI Test Generator
`}

${params.includeMocking ? `
// Mock dependencies
${isTypeScript ? "vi.mock('../api');" : "// vi.mock('../api');"}
` : ''}

describe('${funcName}', () => {
  ${params.includeMocking ? `
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
  ` : ''}

  ${testCases.map(tc => `
  describe('${tc.name}', () => {
    it('${tc.type.replace("-", " ")}', ${tc.input && Object.keys(tc.input).length > 0 ? `async () => {
      ${tc.expectedOutput && "shouldThrow" in tc.expectedOutput ? `await expect(${functions[0]?.name || "fn"}(${this.formatTestInput(tc.input, isTypeScript)})).rejects.toThrow();` : 
        functions[0]?.isAsync ? `const result = await ${functions[0]?.name}(${this.formatTestInput(tc.input, isTypeScript)});
        expect(result).toBeDefined();` : 
        `const result = ${functions[0]?.name}(${this.formatTestInput(tc.input, isTypeScript)});
        expect(result).toBeDefined();`}
    };` : ""}
    });
  `).join("")}
});
`;
  }

  private formatTestInput(input: any, isTypeScript: boolean): string {
    if (!input) return "";
    
    if (Array.isArray(input)) {
      return input.map(v => JSON.stringify(v)).join(", ");
    }
    
    const entries = Object.entries(input);
    if (entries.length === 0) return "";
    
    return entries.map(([k, v]) => {
      if (v === null) return "null";
      if (v === undefined) return "undefined";
      if (typeof v === "string") return isTypeScript ? `"${v}"` : `'${v}'`;
      if (typeof v === "object") return JSON.stringify(v);
      return String(v);
    }).join(", ");
  }

  private generatePytestTests(
    functions: Array<{ name: string; params: string[]; returnType?: string; isAsync: boolean }>,
    testCases: TestCase[]
  ): string {
    const funcName = functions[0]?.name || "function";

    return `"""
Test file for ${funcName}
Generated by NexusAI Test Generator
"""

import pytest
from source import ${functions.map(f => f.name).join(", ")}


class Test${funcName.replace(/^\w/, (c) => c.toUpperCase())}:
    """Test cases for ${funcName}"""

    ${testCases.map(tc => `
    def test_${tc.name.replace(/\s+/g, "_").toLowerCase()}(self):
        """${tc.description}"""
        # Test type: ${tc.type}
        ${tc.input && Object.keys(tc.input).length > 0 ? `result = ${funcName}(${this.formatPythonInput(tc.input)})
        assert result is not None` : "pass"}
    `).join("")}
`;
  }

  private formatPythonInput(input: any): string {
    if (!input) return "";
    
    if (Array.isArray(input)) {
      return input.map(v => JSON.stringify(v)).join(", ");
    }
    
    const entries = Object.entries(input);
    if (entries.length === 0) return "";
    
    return entries.map(([k, v]) => {
      if (v === null) return "None";
      if (v === undefined) return "None";
      if (typeof v === "string") return `"${v}"`;
      if (typeof v === "object") return JSON.stringify(v);
      return String(v);
    }).join(", ");
  }

  private generateGoTests(
    functions: Array<{ name: string; params: string[]; returnType?: string; isAsync: boolean }>,
    testCases: TestCase[]
  ): string {
    const funcName = functions[0]?.name || "Function";

    return `// Tests for ${funcName}
// Generated by NexusAI Test Generator

package main

import (
	"testing"
)

func Test${funcName}(t *testing.T) {
	// Test cases generated for ${funcName}
	tests := []struct {
		name    string
		want    interface{}
	}{
		${testCases.slice(0, 3).map(tc => `{name: "${tc.name}", want: nil},`).join("\n\t\t")}
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// TODO: Implement test logic
		})
	}
}
`;
  }

  private estimateCoverage(
    functions: Array<{ name: string; params: string[] }>,
    testCases: TestCase[]
  ): number {
    // Simple coverage estimation based on functions covered
    const coveredFunctions = new Set(
      testCases.map(tc => tc.name.split(" ")[0])
    );
    
    const coverage = (coveredFunctions.size / Math.max(functions.length, 1)) * 100;
    return Math.min(100, Math.round(coverage));
  }

  private identifyMissingCoverage(
    functions: Array<{ name: string; params: string[] }>,
    testCases: TestCase[]
  ): Array<{ function: string; reason: string }> {
    const missing: Array<{ function: string; reason: string }> = [];
    const testedFunctions = new Set(testCases.map(tc => tc.name.split(" ")[0]));

    for (const func of functions) {
      if (!testedFunctions.has(func.name)) {
        missing.push({
          function: func.name,
          reason: `No test cases generated for ${func.name}`,
        });
      }
    }

    return missing;
  }

  private getTestFileName(language: string): string {
    const names: Record<string, string> = {
      typescript: "generated.test.ts",
      javascript: "generated.test.js",
      python: "test_generated.py",
      go: "generated_test.go",
    };
    return names[language] || "test.generated";
  }

  private getTestPath(language: string): string {
    const paths: Record<string, string> = {
      typescript: "src/__tests__/generated.test.ts",
      javascript: "src/__tests__/generated.test.js",
      python: "tests/test_generated.py",
      go: "generated_test.go",
    };
    return paths[language] || "test.generated";
  }
}
