import { z } from "zod";
import { Tool } from "../../internal/skills.interface.js";
import { createBaseSkillMetadata } from "../types.js";

/**
 * Input schema for code explanation
 */
const CodeExplainerInputSchema = z.object({
  code: z.string().min(10).describe("Source code to explain"),
  language: z.enum(["typescript", "javascript", "python", "go", "rust", "java", "csharp", "sql"]).default("typescript"),
  detailLevel: z.enum(["summary", "detailed", "comprehensive"]).optional().default("detailed"),
  focusAreas: z.array(z.enum(["logic", "data-flow", "control-flow", "patterns", "performance", "security"])).optional(),
});

/**
 * Output schema for code explanation
 */
const CodeExplainerOutputSchema = z.object({
  success: z.boolean(),
  overview: z.string().optional(),
  components: z.array(z.object({
    name: z.string(),
    type: z.enum(["function", "class", "module", "variable", "constant", "interface", "type"]),
    description: z.string(),
    purpose: z.string(),
    parameters: z.array(z.object({
      name: z.string(),
      type: z.string().optional(),
      description: z.string().optional(),
    })).optional(),
    returns: z.object({
      type: z.string().optional(),
      description: z.string().optional(),
    }).optional(),
  })).optional(),
  logic: z.string().optional(),
  dataFlow: z.string().optional(),
  controlFlow: z.string().optional(),
  patterns: z.array(z.object({
    name: z.string(),
    description: z.string(),
    location: z.string().optional(),
  })).optional(),
  complexity: z.object({
    cyclomatic: z.number().optional(),
    cognitive: z.enum(["low", "medium", "high"]),
    lines: z.number(),
  }).optional(),
  dependencies: z.array(z.object({
    name: z.string(),
    type: z.enum(["import", "external", "internal"]),
    usage: z.string().optional(),
  })).optional(),
  technicalDebt: z.array(z.string()).optional(),
  suggestions: z.array(z.string()).optional(),
  executionTimeMs: z.number().optional(),
  error: z.string().optional(),
});

type CodeExplainerInput = z.infer<typeof CodeExplainerInputSchema>;
type CodeExplainerOutput = z.infer<typeof CodeExplainerOutputSchema>;

/**
 * Code Explainer Skill
 * Explains complex code in natural language
 */
export class CodeExplainerSkill implements Tool {
  name = "code_explainer";
  description = "Explain complex code in natural language with detailed analysis";
  inputSchema = CodeExplainerInputSchema;

  private readonly metadata = createBaseSkillMetadata({
    id: "code-explainer",
    name: "Code Explainer",
    description: "Explain complex code in natural language with detailed analysis of logic, data flow, and patterns",
    category: "code",
    version: "1.0.0",
    author: "NexusAI",
    requiredPermissions: ["read:code"],
    requiredCapabilities: ["code-analyzer"],
    estimatedDuration: "5-20s",
    trustScore: 92,
    requiresHumanApproval: false,
    rateLimitPerMinute: 30,
    inputSchema: CodeExplainerInputSchema,
    outputSchema: CodeExplainerOutputSchema,
  });

  // Common pattern definitions
  private readonly patterns: Record<string, { name: string; description: string }> = {
    "async\\s*\\(\\s*\\)": { name: "Async Pattern", description: "Uses asynchronous programming with Promises" },
    "await\\s+": { name: "Await Pattern", description: "Awaits async operations for cleaner async code" },
    "try\\s*{[^}]*catch": { name: "Try-Catch Pattern", description: "Implements error handling with try-catch blocks" },
    "\\.map\\s*\\(": { name: "Map Pattern", description: "Transforms array elements using map function" },
    "\\.filter\\s*\\(": { name: "Filter Pattern", description: "Filters array elements based on condition" },
    "\\.reduce\\s*\\(": { name: "Reduce Pattern", description: "Aggregates array values into single value" },
    "interface\\s+\\w+": { name: "Interface Pattern", description: "Defines contract for type checking" },
    "class\\s+\\w+": { name: "Class Pattern", description: "Uses object-oriented programming with classes" },
    "extends\\s+\\w+": { name: "Inheritance Pattern", description: "Implements inheritance from parent class" },
    "implements\\s+\\w+": { name: "Implementation Pattern", description: "Implements interface(s)" },
    "\\w+\\?\\.\\w+": { name: "Optional Chaining", description: "Safely accesses nested properties with optional chaining" },
    "\\w+\\?\\s*:\\s*\\w+": { name: "Ternary Operator", description: "Uses conditional expression" },
    "\\.then\\s*\\(": { name: "Promise Chain", description: "Chains Promise operations" },
  };

  getMetadata() {
    return this.metadata;
  }

  async execute(ctx: any, args: Record<string, any>): Promise<Record<string, any>> {
    const startTime = Date.now();
    const params = CodeExplainerInputSchema.parse(args);

    try {
      // Parse code structure
      const components = this.extractComponents(params.code, params.language);
      
      // Analyze logic
      const logic = this.analyzeLogic(params.code, params.language, params.detailLevel);
      
      // Analyze data flow
      const dataFlow = this.analyzeDataFlow(params.code, params.language);
      
      // Analyze control flow
      const controlFlow = this.analyzeControlFlow(params.code, params.language);
      
      // Detect patterns
      const patterns = this.detectPatterns(params.code);
      
      // Calculate complexity
      const complexity = this.calculateComplexity(params.code);
      
      // Extract dependencies
      const dependencies = this.extractDependencies(params.code, params.language);
      
      // Identify technical debt
      const technicalDebt = this.identifyTechnicalDebt(params.code);
      
      // Generate overview
      const overview = this.generateOverview(components, complexity, params.detailLevel);
      
      // Generate suggestions
      const suggestions = this.generateSuggestions(components, complexity, technicalDebt);

      return {
        success: true,
        overview,
        components,
        logic,
        dataFlow,
        controlFlow,
        patterns,
        complexity,
        dependencies,
        technicalDebt,
        suggestions,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Code explanation failed",
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  private extractComponents(
    code: string,
    language: string
  ): CodeExplainerOutput["components"] {
    const components: CodeExplainerOutput["components"] = [];
    const lines = code.split("\n");

    // Extract functions/methods
    const functionPatterns: Record<string, RegExp> = {
      typescript: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)|^(?:export\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*{/gm,
      javascript: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)|^(?:export\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)\s*{/gm,
      python: /^def\s+(\w+)\s*\([^)]*\)\s*(?:->\s*\w+)?:/gm,
      go: /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\([^)]*\)\s*(?:\([^)]*\)\s*)?(?:\{|\w+)/gm,
    };

    const funcPattern = functionPatterns[language] || functionPatterns.typescript;
    let match;
    while ((match = funcPattern.exec(code)) !== null) {
      const funcName = match[1] || match[2];
      if (funcName && !["if", "for", "while", "switch"].includes(funcName)) {
        const lineNum = code.substring(0, match.index).split("\n").length;
        components.push({
          name: funcName,
          type: "function",
          description: this.generateFunctionDescription(funcName, match[0]),
          purpose: this.inferFunctionPurpose(funcName),
        });
      }
    }

    // Extract classes
    const classPattern = language === "python" 
      ? /^class\s+(\w+)(?:\([^)]+\))?:/gm
      : /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?/gm;
    
    while ((match = classPattern.exec(code)) !== null) {
      components.push({
        name: match[1],
        type: "class",
        description: `Class ${match[1]} defined at line ${this.lineNumber(match.index)}`,
        purpose: this.inferClassPurpose(match[1]),
      });
    }

    // Extract interfaces (TypeScript)
    if (language === "typescript") {
      const interfacePattern = /(?:export\s+)?interface\s+(\w+)/g;
      while ((match = interfacePattern.exec(code)) !== null) {
        components.push({
          name: match[1],
          type: "interface",
          description: `Interface ${match[1]} defines type contract`,
          purpose: "Defines type structure for type checking",
        });
      }

      // Extract types
      const typePattern = /(?:export\s+)?type\s+(\w+)\s*=/g;
      while ((match = typePattern.exec(code)) !== null) {
        components.push({
          name: match[1],
          type: "type",
          description: `Type alias ${match[1]}`,
          purpose: "Defines type alias or union type",
        });
      }
    }

    // Extract constants
    const constPattern = /(?:export\s+)?const\s+(\w+)\s*=/g;
    while ((match = constPattern.exec(code)) !== null) {
      components.push({
        name: match[1],
        type: "constant",
        description: `Constant ${match[1]} holds immutable value`,
        purpose: this.inferConstantPurpose(match[1]),
      });
    }

    return components;
  }

  private generateFunctionDescription(name: string, signature: string): string {
    return `Function ${name} - ${signature.substring(0, 80)}...`;
  }

  private inferFunctionPurpose(name: string): string {
    const purposePatterns: [RegExp, string][] = [
      [/get|fetch|retrieve|load/i, "Retrieves data from a source"],
      [/create|add|insert|post/i, "Creates or adds new data"],
      [/update|edit|modify|patch/i, "Updates existing data"],
      [/delete|remove|destroy/i, "Deletes data"],
      [/validate|check|verify/i, "Validates input or data"],
      [/transform|convert|parse/i, "Transforms data between formats"],
      [/handle|process/i, "Handles or processes requests"],
      [/init|setup|configure/i, "Initializes or sets up resources"],
      [/calculate|compute|compute/i, "Performs calculations"],
    ];

    for (const [pattern, purpose] of purposePatterns) {
      if (pattern.test(name)) {
        return purpose;
      }
    }

    return "Performs specific functionality";
  }

  private inferClassPurpose(name: string): string {
    if (/Service$/i.test(name)) return "Provides business logic and services";
    if (/Controller$/i.test(name)) return "Handles HTTP requests and responses";
    if (/Repository$/i.test(name)) return "Manages data access and persistence";
    if (/Model$/i.test(name)) return "Represents data structure and business rules";
    if (/Handler$/i.test(name)) return "Handles specific types of events or requests";
    if (/Util$/i.test(name)) return "Provides utility functions";
    if (/Manager$/i.test(name)) return "Manages resources or state";
    return "Encapsulates related functionality";
  }

  private inferConstantPurpose(name: string): string {
    if (/URL|ENDPOINT|API/i.test(name)) return "Stores API endpoint URL";
    if (/KEY|TOKEN|SECRET/i.test(name)) return "Stores authentication credential";
    if (/TIMEOUT|DELAY|INTERVAL/i.test(name)) return "Stores timing configuration";
    if (/MAX|MIN|LIMIT/i.test(name)) return "Stores boundary value";
    if (/REGEX|PATTERN/i.test(name)) return "Stores validation pattern";
    if (/STATUS|STATE/i.test(name)) return "Stores status enumeration";
    return "Stores configuration or fixed value";
  }

  private analyzeLogic(code: string, language: string, detailLevel: string): string {
    const explanations: string[] = [];

    if (detailLevel === "summary") {
      return "This code implements the core functionality described by its name and structure.";
    }

    // Detect main operations
    if (/async\s+function|await\s+/.test(code)) {
      explanations.push("Uses asynchronous programming for non-blocking operations");
    }

    if (/try\s*{[\s\S]*}\s*catch/.test(code)) {
      explanations.push("Implements error handling with try-catch blocks");
    }

    if (/map\s*\(|filter\s*\(|reduce\s*\(/.test(code)) {
      explanations.push("Uses functional programming patterns for data transformation");
    }

    if (/if\s*\([^)]*&&|\|\|/.test(code)) {
      explanations.push("Contains complex conditional logic with multiple conditions");
    }

    if (/for\s*\(|while\s*\(/.test(code)) {
      explanations.push("Implements iterative loops for processing collections");
    }

    // Count operations
    const ops = {
      conditionals: (code.match(/if\s*\(/g) || []).length,
      loops: (code.match(/for\s*\(|while\s*\(/g) || []).length,
      functions: (code.match(/function\s+|\w+\s*\([^)]*\)\s*{/g) || []).length,
    };

    explanations.push(`Contains approximately ${ops.functions} function(s), ${ops.loops} loop(s), and ${ops.conditionals} conditional(s)`);

    return explanations.join(". ") + ".";
  }

  private analyzeDataFlow(code: string, language: string): string {
    const flows: string[] = [];

    // Check for input sources
    if (/fetch\s*\(|axios\.|http\.|request\./.test(code)) {
      flows.push("Data is fetched from external HTTP sources");
    }

    if (/readFile|open\(|read\(/ .test(code)) {
      flows.push("Data is read from files or storage");
    }

    if (/process\.env|\.env|\.json/.test(code)) {
      flows.push("Configuration is loaded from environment or config files");
    }

    // Check for data outputs
    if (/return\s+/.test(code)) {
      flows.push("Results are returned to callers");
    }

    if (/writeFile|save|create\(|insert\(/ .test(code)) {
      flows.push("Data is written to storage or databases");
    }

    // Check for data transformations
    if (/\.map\(|\.filter\(|\.reduce\(/.test(code)) {
      flows.push("Data undergoes transformation through functional operations");
    }

    if (/JSON\.parse|JSON\.stringify/.test(code)) {
      flows.push("Data is serialized/deserialized to/from JSON format");
    }

    return flows.length > 0 ? flows.join(". ") + "." : "Standard data flow with input processing and output.";
  }

  private analyzeControlFlow(code: string, language: string): string {
    const flows: string[] = [];

    // Detect control structures
    if (/if\s*\([^)]*\)\s*{[\s\S]*}\s*else/.test(code)) {
      flows.push("Implements if-else branching logic");
    }

    if (/switch\s*\(|case\s+/.test(code)) {
      flows.push("Uses switch-case for multi-way branching");
    }

    if (/for\s*\([^)]*of/.test(code)) {
      flows.push("Iterates over collections using for-of loop");
    }

    if (/for\s*\([^)]*in/.test(code)) {
      flows.push("Iterates over object keys using for-in loop");
    }

    if (/while\s*\(/.test(code)) {
      flows.push("Uses while loop with condition checking");
    }

    if (/try\s*{[\s\S]*}\s*finally/.test(code)) {
      flows.push("Implements try-finally for guaranteed cleanup");
    }

    // Check for recursion
    const funcNames = code.match(/(?:function\s+)?(\w+)\s*\([^)]*\)/g) || [];
    const selfCalls = funcNames.filter(name => {
      const funcName = name.replace(/function\s+/, "").replace(/\s*\([^)]*\)/, "");
      return new RegExp(`${funcName}\\s*\\(`).test(code);
    });

    if (selfCalls.length > 0) {
      flows.push("Contains recursive function call(s)");
    }

    return flows.length > 0 ? flows.join(". ") + "." : "Linear execution with standard control flow.";
  }

  private detectPatterns(code: string): CodeExplainerOutput["patterns"] {
    const detected: CodeExplainerOutput["patterns"] = [];

    for (const [pattern, info] of Object.entries(this.patterns)) {
      if (new RegExp(pattern).test(code)) {
        detected.push(info);
      }
    }

    return detected;
  }

  private calculateComplexity(code: string): CodeExplainerOutput["complexity"] {
    const lines = code.split("\n").filter(l => l.trim().length > 0).length;
    
    // Cyclomatic complexity approximation
    let cyclomatic = 1;
    cyclomatic += (code.match(/if\s*\(/g) || []).length;
    cyclomatic += (code.match(/\&\&|\|\|/g) || []).length;
    cyclomatic += (code.match(/case\s+/g) || []).length;
    cyclomatic += (code.match(/\?[^:]/g) || []).length;

    // Cognitive complexity approximation
    let cognitive = "low";
    if (cyclomatic > 15 || lines > 200) cognitive = "high";
    else if (cyclomatic > 8 || lines > 100) cognitive = "medium";

    return {
      cyclomatic,
      cognitive: cognitive as "low" | "medium" | "high",
      lines,
    };
  }

  private extractDependencies(
    code: string,
    language: string
  ): CodeExplainerOutput["dependencies"] {
    const deps: CodeExplainerOutput["dependencies"] = [];

    // Import/require patterns
    const importPatterns: Record<string, RegExp> = {
      typescript: /import\s+(?:{[^}]+}|\w+)\s+from\s+["']([^"']+)["']/g,
      javascript: /import\s+(?:{[^}]+}|\w+)\s+from\s+["']([^"']+)["']|require\s*\(\s*["']([^"']+)["']\s*\)/g,
      python: /^(?:from\s+(\w+)\s+import|import\s+(\w+))/gm,
      go: /^import\s+(?:\(\s*)?["'](\w+)["']/gm,
    };

    const pattern = importPatterns[language] || importPatterns.typescript;
    let match;

    while ((match = pattern.exec(code)) !== null) {
      const name = match[1] || match[2];
      if (name && !["react", "vue", "angular"].includes(name.toLowerCase())) {
        deps.push({
          name,
          type: name.startsWith(".") ? "internal" : "external",
          usage: "Used for module imports",
        });
      }
    }

    return deps.slice(0, 10); // Limit to 10 dependencies
  }

  private identifyTechnicalDebt(code: string): string[] {
    const debt: string[] = [];

    // Magic numbers
    const magicNumbers = code.match(/\b\d{3,}\b/g) || [];
    if (magicNumbers.length > 3) {
      debt.push("Multiple magic numbers found - consider using named constants");
    }

    // Long functions
    const funcBodies = code.split(/function\s+\w+\s*\(|=>\s*{/);
    const longFunctions = funcBodies.filter(f => f.split("\n").length > 50);
    if (longFunctions.length > 0) {
      debt.push("Some functions are quite long - consider breaking them into smaller units");
    }

    // Nested callbacks
    if (/\.then\([^)]*\.then\(|\.then\([^)]*=>\s*{\s*[^}]*\.then\(/.test(code)) {
      debt.push("Deep promise chaining detected - consider using async/await for better readability");
    }

    // TODO comments
    const todos = code.match(/\/\/\s*TODO|\/\/\s*FIXME|\/\/\s*HACK/g);
    if (todos && todos.length > 0) {
      debt.push(`${todos.length} TODO/FIXME comment(s) found - address these before production`);
    }

    return debt;
  }

  private generateOverview(
    components: NonNullable<CodeExplainerOutput["components"]>,
    complexity: NonNullable<CodeExplainerOutput["complexity"]>,
    detailLevel: string
  ): string {
    const classCount = components.filter(c => c.type === "class").length;
    const funcCount = components.filter(c => c.type === "function").length;
    const otherCount = components.length - classCount - funcCount;

    let overview = `This code module contains `;
    const parts: string[] = [];
    
    if (classCount > 0) parts.push(`${classCount} class(es)`);
    if (funcCount > 0) parts.push(`${funcCount} function(s)`);
    if (otherCount > 0) parts.push(`${otherCount} other definition(s)`);
    
    overview += parts.join(", ") + ".";
    overview += ` The code spans approximately ${complexity.lines} lines with a ${complexity.cognitive} cognitive complexity.`;

    return overview;
  }

  private generateSuggestions(
    components: NonNullable<CodeExplainerOutput["components"]>,
    complexity: NonNullable<CodeExplainerOutput["complexity"]>,
    technicalDebt: string[]
  ): string[] {
    const suggestions: string[] = [];

    if (complexity.cognitive === "high") {
      suggestions.push("Consider refactoring to reduce cognitive complexity");
    }

    if (complexity.cyclomatic && complexity.cyclomatic > 15) {
      suggestions.push("High cyclomatic complexity - break down complex conditional logic");
    }

    if (technicalDebt.some(d => d.includes("TODO"))) {
      suggestions.push("Address all TODO items before deployment");
    }

    if (technicalDebt.some(d => d.includes("magic number"))) {
      suggestions.push("Replace magic numbers with named constants for better readability");
    }

    if (components.filter(c => c.type === "function").length > 10) {
      suggestions.push("Consider organizing functions into separate modules by concern");
    }

    return suggestions;
  }

  private lineNumber(index: number): number {
    return 1;
  }
}
