import { z } from "zod";
import { Tool } from "../../internal/skills.interface.js";
import { createBaseSkillMetadata } from "../types.js";

/**
 * Input schema for refactoring suggestions
 */
const RefactorSuggesterInputSchema = z.object({
  code: z.string().min(20).describe("Source code to analyze for refactoring opportunities"),
  language: z.enum(["typescript", "javascript", "python", "go"]).default("typescript"),
  focusAreas: z.array(z.enum(["readability", "performance", "maintainability", "testability", "all"])).optional().default(["all"]),
});

/**
 * Output schema for refactoring suggestions
 */
const RefactorSuggesterOutputSchema = z.object({
  success: z.boolean(),
  analysisDate: z.string().optional(),
  summary: z.object({
    overallScore: z.number().min(0).max(100),
    grade: z.enum(["A", "B", "C", "D", "F"]),
    issuesFound: z.number(),
    priorityFixes: z.number(),
  }).optional(),
  suggestions: z.array(z.object({
    id: z.string(),
    priority: z.enum(["critical", "high", "medium", "low"]),
    category: z.enum(["structure", "naming", "duplication", "complexity", "coupling", "cohesion", "performance", "maintainability"]),
    title: z.string(),
    description: z.string(),
    location: z.object({
      startLine: z.number(),
      endLine: z.number(),
      code: z.string(),
    }),
    refactoring: z.object({
      technique: z.string(),
      before: z.string(),
      after: z.string(),
      explanation: z.string(),
    }),
    effort: z.enum(["low", "medium", "high"]),
    impact: z.enum(["low", "medium", "high"]),
  })).optional(),
  codeSmells: z.array(z.object({
    type: z.string(),
    severity: z.enum(["critical", "major", "minor"]),
    location: z.string(),
    description: z.string(),
  })).optional(),
  estimatedImprovement: z.object({
    complexityReduction: z.string().optional(),
    maintainabilityGain: z.string().optional(),
    testabilityGain: z.string().optional(),
  }).optional(),
  executionTimeMs: z.number().optional(),
  error: z.string().optional(),
});

type RefactorSuggesterInput = z.infer<typeof RefactorSuggesterInputSchema>;
type RefactorSuggesterOutput = z.infer<typeof RefactorSuggesterOutputSchema>;

/**
 * Code Smell Pattern
 */
interface CodeSmell {
  type: string;
  severity: "critical" | "major" | "minor" | "medium";
  pattern: RegExp;
  description: string;
  technique: string;
  before: string;
  after: string;
}

/**
 * Refactor Suggester Skill
 * Suggests code refactoring improvements
 */
export class RefactorSuggesterSkill implements Tool {
  name = "refactor_suggester";
  description = "Suggest code refactoring improvements for readability, performance, and maintainability";
  inputSchema = RefactorSuggesterInputSchema;

  private readonly metadata = createBaseSkillMetadata({
    id: "refactor-suggester",
    name: "Refactoring Suggestion Engine",
    description: "Analyze code and suggest refactoring improvements for better readability, performance, and maintainability",
    category: "code",
    version: "1.0.0",
    author: "NexusAI",
    requiredPermissions: ["read:code"],
    requiredCapabilities: ["code-analyzer", "refactoring-expert"],
    estimatedDuration: "5-20s",
    trustScore: 90,
    requiresHumanApproval: false,
    rateLimitPerMinute: 25,
    inputSchema: RefactorSuggesterInputSchema,
    outputSchema: RefactorSuggesterOutputSchema,
  });

  // Code smell patterns with refactoring suggestions
  private readonly smellPatterns: CodeSmell[] = [
    // Naming issues
    {
      type: "generic-names",
      severity: "minor",
      pattern: /\b(temp|tmp|data|info|obj|item|val|x|y|z)\w*\b/gi,
      description: "Generic variable name that doesn't convey intent",
      technique: "Use descriptive names",
      before: "temp = calculate()",
      after: "intermediateResult = calculate()",
    },
    {
      type: "inconsistent-naming",
      severity: "minor",
      pattern: /\b(getUser|get_user|GetUser)\b/g,
      description: "Inconsistent naming convention within same codebase",
      technique: "Standardize naming convention",
      before: "getUser(), get_user_info(), fetchUserData()",
      after: "getUser(), getUserInfo(), getUserData()",
    },
    {
      type: "boolean-naming",
      severity: "minor",
      pattern: /\b(is|has|can|should|need)\w*\b/gi,
      description: "Non-boolean variable with boolean-like name",
      technique: "Use clear boolean naming",
      before: "let active = getUsers(); // returns array",
      after: "let activeUsers = getUsers(); // returns array",
    },

    // Structure issues
    {
      type: "long-function",
      severity: "major",
      pattern: /function\s+\w+\s*\([^)]*\)\s*{[\s\S]{200,}}/,
      description: "Function exceeds recommended length (likely >50 lines)",
      technique: "Extract smaller functions",
      before: "function processOrder(order) { /* 100+ lines */ }",
      after: "function processOrder(order) { validate(order); calculate(order); save(order); }",
    },
    {
      type: "deep-nesting",
      severity: "major",
      pattern: /{[^{}]*if\s*\([^{}]*{[^{}]*if\s*\([^{}]*{/,
      description: "Deeply nested conditional logic (>3 levels)",
      technique: "Use early returns or extract conditions",
      before: "if (a) { if (b) { if (c) { doSomething(); } } }",
      after: "if (!a || !b || !c) return; doSomething();",
    },
    {
      type: "switch-statements",
      severity: "minor",
      pattern: /switch\s*\([^)]*\)\s*{[\s\S]*case[\s\S]*case/g,
      description: "Long switch statement without polymorphism consideration",
      technique: "Consider polymorphism or strategy pattern",
      before: "switch (type) { case 'a': return 1; case 'b': return 2; ... }",
      after: "const handlers = { a: () => 1, b: () => 2 }; return handlers[type]?.() || defaultHandler();",
    },

    // Duplication
    {
      type: "code-duplication",
      severity: "major",
      pattern: /([\s\S]{50,})\1{2,}/,
      description: "Potential code duplication detected",
      technique: "Extract to shared function",
      before: "if (user) { log.info(user.id); save(user); } ... if (admin) { log.info(admin.id); save(admin); }",
      after: "function processAccount(account) { log.info(account.id); save(account); }",
    },
    {
      type: "magic-numbers",
      severity: "minor",
      pattern: /\b\d{3,}\b(?!.*[A-Za-z])/,
      description: "Magic number without named constant",
      technique: "Extract to named constant",
      before: "for (let i = 0; i < 86400; i++) { ... }",
      after: "const SECONDS_PER_DAY = 86400; for (let i = 0; i < SECONDS_PER_DAY; i++) { ... }",
    },

    // Performance
    {
      type: "repeated-calculation",
      severity: "medium",
      pattern: /\b\w+\.(length|size)\b[\s\S]{0,50}\b\w+\.(length|size)\b/g,
      description: "Repeated property access in loops",
      technique: "Cache property access",
      before: "for (let i = 0; i < arr.length; i++) { ... arr.length ... }",
      after: "const len = arr.length; for (let i = 0; i < len; i++) { ... }",
    },
    {
      type: "string-concatenation",
      severity: "minor",
      pattern: /\+[^+\n]*["'][^"']*["'][^+]*\+/g,
      description: "String concatenation instead of template literal",
      technique: "Use template literals",
      before: "const msg = 'Hello ' + name + '! You have ' + count + ' messages.';",
      after: "const msg = `Hello ${name}! You have ${count} messages.`;",
    },

    // Maintainability
    {
      type: "commented-code",
      severity: "minor",
      pattern: /\/\*[\s\S]*\*\/\s*[\s\n]*\/\/|^\s*\/\/[^{}]/gm,
      description: "Commented out code found",
      technique: "Remove dead code or use version control",
      before: "// old implementation\n// doSomethingOld();\ndoSomethingNew();",
      after: "doSomethingNew();",
    },
    {
      type: "long-parameter-list",
      severity: "minor",
      pattern: /\([^)]{60,}\)/,
      description: "Function has many parameters (>5)",
      technique: "Consider parameter object",
      before: "function createUser(name, email, age, city, country, phone, role) { ... }",
      after: "function createUser({ name, email, age, city, country, phone, role }) { ... }",
    },
    {
      type: "feature-envy",
      severity: "minor",
      pattern: /\w+\.\w+\.\w+\.\w+\./g,
      description: "Chain of method calls suggesting feature envy",
      technique: "Move method to the class being accessed most",
      before: "user.getAddress().getCity().getName()",
      after: "user.getCityName()",
    },
  ];

  getMetadata() {
    return this.metadata;
  }

  async execute(ctx: any, args: Record<string, any>): Promise<Record<string, any>> {
    const startTime = Date.now();
    const params = RefactorSuggesterInputSchema.parse(args);

    try {
      const suggestions: RefactorSuggesterOutput["suggestions"] = [];
      const codeSmells: RefactorSuggesterOutput["codeSmells"] = [];
      const lines = params.code.split("\n");
      let suggestionId = 1;

      // Analyze for each smell pattern
      for (const smell of this.smellPatterns) {
        // Filter by focus areas if specified
        if (!this.matchesFocusAreas(smell.type, params.focusAreas)) {
          continue;
        }

        const matches = params.code.matchAll(new RegExp(smell.pattern, "g"));
        for (const match of matches) {
          const matchIndex = match.index || 0;
          const lineNum = params.code.substring(0, matchIndex).split("\n").length;
          
          // Get context (surrounding lines)
          const startLine = Math.max(0, lineNum - 2);
          const endLine = Math.min(lines.length, lineNum + 2);
          const context = lines.slice(startLine, endLine).join("\n");

          suggestions.push({
            id: `REF-${String(suggestionId++).padStart(3, "0")}`,
            priority: smell.severity === "critical" ? "critical" 
              : smell.severity === "major" ? "high" 
              : smell.severity === "minor" ? "medium" : "low",
            category: this.categorizeSmell(smell.type),
            title: this.formatTitle(smell.type),
            description: smell.description,
            location: {
              startLine: lineNum,
              endLine: lineNum + 1,
              code: context,
            },
            refactoring: {
              technique: smell.technique,
              before: match[0].substring(0, 100),
              after: smell.after,
              explanation: this.generateExplanation(smell.type, smell.technique),
            },
            effort: this.estimateEffort(smell.type),
            impact: this.estimateImpact(smell.type),
          });

          codeSmells.push({
            type: smell.type,
            severity: smell.severity as "critical" | "major" | "minor",
            location: `Line ${lineNum}`,
            description: smell.description,
          });
        }
      }

      // Remove duplicate suggestions based on location
      const uniqueSuggestions = this.deduplicateSuggestions(suggestions);

      // Calculate summary
      const summary = this.calculateSummary(uniqueSuggestions);

      // Estimate improvements
      const estimatedImprovement = this.estimateImprovements(uniqueSuggestions);

      return {
        success: true,
        analysisDate: new Date().toISOString(),
        summary,
        suggestions: uniqueSuggestions,
        codeSmells,
        estimatedImprovement,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Refactoring analysis failed",
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  private matchesFocusAreas(type: string, focusAreas: string[]): boolean {
    if (focusAreas.includes("all")) return true;

    const categoryMap: Record<string, string[]> = {
      readability: ["generic-names", "inconsistent-naming", "boolean-naming", "commented-code"],
      performance: ["repeated-calculation", "string-concatenation"],
      maintainability: ["long-function", "deep-nesting", "switch-statements", "long-parameter-list"],
      testability: ["feature-envy", "code-duplication"],
    };

    const typeCategory = Object.entries(categoryMap).find(([_, types]) => types.includes(type));
    if (!typeCategory) return true;

    return focusAreas.includes(typeCategory[0]);
  }

  private categorizeSmell(type: string): RefactorSuggesterOutput["suggestions"][0]["category"] {
    const categoryMap: Record<string, RefactorSuggesterOutput["suggestions"][0]["category"]> = {
      "generic-names": "naming",
      "inconsistent-naming": "naming",
      "boolean-naming": "naming",
      "long-function": "complexity",
      "deep-nesting": "complexity",
      "switch-statements": "structure",
      "code-duplication": "duplication",
      "magic-numbers": "maintainability",
      "repeated-calculation": "performance",
      "string-concatenation": "performance",
      "commented-code": "maintainability",
      "long-parameter-list": "complexity",
      "feature-envy": "coupling",
    };

    return categoryMap[type] || "maintainability";
  }

  private formatTitle(type: string): string {
    return type
      .split("-")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  private generateExplanation(type: string, technique: string): string {
    const explanations: Record<string, string> = {
      "generic-names": `Using descriptive names makes code self-documenting and easier to understand. "${technique}" helps convey the purpose of the variable.`,
      "long-function": `Functions that are too long are hard to test, understand, and maintain. ${technique} breaks it into focused, reusable pieces.`,
      "deep-nesting": `Deep nesting makes code hard to follow. ${technique} improves readability and reduces cognitive load.`,
      "code-duplication": `Duplicated code requires multiple updates and is a common source of bugs. ${technique} centralizes the logic.`,
      "magic-numbers": `Magic numbers make code cryptic and hard to modify. ${technique} makes the intent clear.`,
      "repeated-calculation": `Repeated property access in loops wastes computation. ${technique} caches the value once.`,
      "string-concatenation": `String concatenation is error-prone and hard to read. ${technique} is cleaner and more maintainable.`,
    };

    return explanations[type] || `Consider applying "${technique}" to improve this code.`;
  }

  private estimateEffort(type: string): "low" | "medium" | "high" {
    const effortMap: Record<string, "low" | "medium" | "high"> = {
      "generic-names": "low",
      "inconsistent-naming": "medium",
      "boolean-naming": "low",
      "long-function": "high",
      "deep-nesting": "medium",
      "switch-statements": "high",
      "code-duplication": "medium",
      "magic-numbers": "low",
      "repeated-calculation": "low",
      "string-concatenation": "low",
      "commented-code": "low",
      "long-parameter-list": "medium",
      "feature-envy": "high",
    };

    return effortMap[type] || "medium";
  }

  private estimateImpact(type: string): "low" | "medium" | "high" {
    const impactMap: Record<string, "low" | "medium" | "high"> = {
      "generic-names": "medium",
      "inconsistent-naming": "medium",
      "boolean-naming": "low",
      "long-function": "high",
      "deep-nesting": "high",
      "switch-statements": "medium",
      "code-duplication": "high",
      "magic-numbers": "low",
      "repeated-calculation": "medium",
      "string-concatenation": "low",
      "commented-code": "low",
      "long-parameter-list": "medium",
      "feature-envy": "medium",
    };

    return impactMap[type] || "medium";
  }

  private deduplicateSuggestions(suggestions: RefactorSuggesterOutput["suggestions"]): RefactorSuggesterOutput["suggestions"] {
    const seen = new Set<string>();
    return suggestions.filter(s => {
      const key = `${s.category}:${s.location.startLine}:${s.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private calculateSummary(suggestions: RefactorSuggesterOutput["suggestions"]): RefactorSuggesterOutput["summary"] {
    const critical = suggestions.filter(s => s.priority === "critical").length;
    const high = suggestions.filter(s => s.priority === "high").length;
    const medium = suggestions.filter(s => s.priority === "medium").length;
    const low = suggestions.filter(s => s.priority === "low").length;
    const total = suggestions.length;

    // Calculate score
    const deductions = critical * 20 + high * 10 + medium * 5 + low * 2;
    const overallScore = Math.max(0, 100 - deductions);

    let grade: "A" | "B" | "C" | "D" | "F";
    if (overallScore >= 90) grade = "A";
    else if (overallScore >= 75) grade = "B";
    else if (overallScore >= 60) grade = "C";
    else if (overallScore >= 40) grade = "D";
    else grade = "F";

    return {
      overallScore,
      grade,
      issuesFound: total,
      priorityFixes: critical + high,
    };
  }

  private estimateImprovements(suggestions: RefactorSuggesterOutput["suggestions"]): RefactorSuggesterOutput["estimatedImprovement"] {
    const critical = suggestions.filter(s => s.priority === "critical").length;
    const high = suggestions.filter(s => s.priority === "high").length;
    const complexityIssues = suggestions.filter(s => s.category === "complexity").length;

    return {
      complexityReduction: critical + high > 0 
        ? `~${Math.min(100, (critical * 30 + high * 15))}% reduction in critical issues`
        : undefined,
      maintainabilityGain: complexityIssues > 0
        ? `~${Math.min(50, complexityIssues * 10)}% improvement in maintainability`
        : undefined,
      testabilityGain: suggestions.filter(s => s.category === "duplication").length > 0
        ? "~20% improvement in testability through reduced duplication"
        : undefined,
    };
  }
}
