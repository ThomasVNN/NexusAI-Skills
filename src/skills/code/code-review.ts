import { z } from "zod";
import { Tool } from "../../internal/skills.interface.js";
import { createBaseSkillMetadata } from "../types.js";

/**
 * Input schema for code review
 */
const CodeReviewInputSchema = z.object({
  code: z.string().min(10).describe("Source code to review"),
  language: z.enum(["typescript", "javascript", "python", "go", "rust", "java", "csharp"]).default("typescript"),
  reviewType: z.enum(["full", "security", "performance", "style", "bugs"]).optional().default("full"),
  context: z.string().optional().describe("Additional context about the code purpose"),
});

/**
 * Output schema for code review results
 */
const CodeReviewOutputSchema = z.object({
  success: z.boolean(),
  reviewDate: z.string().optional(),
  language: z.string().optional(),
  summary: z.object({
    totalIssues: z.number(),
    criticalIssues: z.number(),
    warnings: z.number(),
    suggestions: z.number(),
    score: z.number().min(0).max(100),
    grade: z.enum(["A", "B", "C", "D", "F"]),
  }).optional(),
  issues: z.array(z.object({
    severity: z.enum(["critical", "major", "minor", "info"]),
    category: z.enum(["security", "performance", "bug", "style", "maintainability", "best-practice"]),
    line: z.number().optional(),
    message: z.string(),
    suggestion: z.string().optional(),
    rule: z.string().optional(),
  })).optional(),
  strengths: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional(),
  securityScan: z.object({
    vulnerabilities: z.array(z.object({
      type: z.string(),
      severity: z.enum(["critical", "high", "medium", "low"]),
      description: z.string(),
      cwe: z.string().optional(),
      remediation: z.string().optional(),
    })).optional(),
    overallRisk: z.enum(["low", "medium", "high", "critical"]).optional(),
  }).optional(),
  executionTimeMs: z.number().optional(),
  error: z.string().optional(),
});

type CodeReviewInput = z.infer<typeof CodeReviewInputSchema>;
type CodeReviewOutput = z.infer<typeof CodeReviewOutputSchema>;

/**
 * Issue Pattern for static analysis
 */
interface IssuePattern {
  pattern: RegExp;
  severity: "critical" | "major" | "minor" | "info";
  category: "security" | "performance" | "bug" | "style" | "maintainability" | "best-practice";
  message: string;
  suggestion: string;
  rule?: string;
}

/**
 * Code Review Skill
 * Reviews code for bugs, security issues, style, and best practices
 */
export class CodeReviewSkill implements Tool {
  name = "code_review";
  description = "Review code for bugs, security vulnerabilities, performance issues, and style improvements";
  inputSchema = CodeReviewInputSchema;

  private readonly metadata = createBaseSkillMetadata({
    id: "code-review",
    name: "Code Review Analyzer",
    description: "Review code for bugs, security vulnerabilities, performance issues, and code style improvements",
    category: "code",
    version: "1.0.0",
    author: "NexusAI",
    requiredPermissions: ["read:code"],
    requiredCapabilities: ["code-analyzer", "security-scanner"],
    estimatedDuration: "5-30s",
    trustScore: 88,
    requiresHumanApproval: false,
    rateLimitPerMinute: 20,
    inputSchema: CodeReviewInputSchema,
    outputSchema: CodeReviewOutputSchema,
  });

  // Security vulnerability patterns
  private readonly securityPatterns: IssuePattern[] = [
    {
      pattern: /eval\s*\(/,
      severity: "critical",
      category: "security",
      message: "Use of eval() is a serious security risk - arbitrary code execution possible",
      suggestion: "Avoid eval() or sanitize input thoroughly if absolutely necessary",
      rule: "no-eval",
    },
    {
      pattern: /innerHTML\s*=/,
      severity: "major",
      category: "security",
      message: "Direct innerHTML assignment can lead to XSS vulnerabilities",
      suggestion: "Use textContent or sanitize HTML before insertion",
      rule: "no-inner-html",
    },
    {
      pattern: /document\.write\s*\(/,
      severity: "major",
      category: "security",
      message: "document.write() can be exploited for XSS attacks",
      suggestion: "Use safer DOM manipulation methods",
      rule: "no-document-write",
    },
    {
      pattern: /password\s*=\s*["'][^"']+["']/i,
      severity: "critical",
      category: "security",
      message: "Hardcoded password detected - credentials should never be hardcoded",
      suggestion: "Use environment variables or a secrets manager",
      rule: "no-hardcoded-creds",
    },
    {
      pattern: /api[_-]?key\s*=\s*["'][^"']+["']/i,
      severity: "critical",
      category: "security",
      message: "Hardcoded API key detected - keys should never be hardcoded",
      suggestion: "Use environment variables or a secrets manager",
      rule: "no-hardcoded-secrets",
    },
    {
      pattern: /crypto\.(createCipher|createDecipher)\s*\(/,
      severity: "major",
      category: "security",
      message: "Deprecated crypto methods - use crypto.createCipheriv instead",
      suggestion: "Use crypto.createCipheriv() with explicit IV",
      rule: "no-deprecated-crypto",
    },
    {
      pattern: /\.querySelector\s*\(\s*['"`][^'"`]*\$/,
      severity: "major",
      category: "security",
      message: "Potential SQL/NoSQL injection via query selector",
      suggestion: "Sanitize input before using in queries",
      rule: "potential-injection",
    },
  ];

  // Bug patterns
  private readonly bugPatterns: IssuePattern[] = [
    {
      pattern: /==(?!=)/,
      severity: "minor",
      category: "bug",
      message: "Use === instead of == for strict equality comparison",
      suggestion: "Use === for comparisons to avoid type coercion bugs",
      rule: "eqeqeq",
    },
    {
      pattern: /!=(?!=)/,
      severity: "minor",
      category: "bug",
      message: "Use !== instead of != for strict inequality comparison",
      suggestion: "Use !== for comparisons to avoid type coercion bugs",
      rule: "eqeqeq",
    },
    {
      pattern: /for\s*\(\s*let\s+\w+\s+in\s+/,
      severity: "minor",
      category: "bug",
      message: "Using 'for...in' for arrays - consider 'for...of' or index-based loop",
      suggestion: "'for...in' iterates over object keys, not array values",
      rule: "no-for-in",
    },
    {
      pattern: /new\s+Array\s*\(/,
      severity: "info",
      category: "style",
      message: "Prefer array literal [] over new Array()",
      suggestion: "Use [] for consistency and to avoid confusing behavior",
      rule: "no-array-constructor",
    },
    {
      pattern: /console\.(log|debug)\s*\(/,
      severity: "info",
      category: "style",
      message: "Console statement left in code",
      suggestion: "Remove console statements or use proper logging",
      rule: "no-console",
    },
  ];

  // Performance patterns
  private readonly performancePatterns: IssuePattern[] = [
    {
      pattern: /\.forEach\s*\(/,
      severity: "info",
      category: "performance",
      message: "Consider using for loop instead of forEach for better performance in hot paths",
      suggestion: "forEach has overhead - use for loop for performance-critical code",
      rule: "prefer-for",
    },
    {
      pattern: /\+\s*["'][^"']*["']\s*\+/,
      severity: "minor",
      category: "performance",
      message: "String concatenation in loop - use template literals or join",
      suggestion: "String concatenation creates new strings - use template literals",
      rule: "prefer-template",
    },
    {
      pattern: /JSON\.parse\s*\(/,
      severity: "info",
      category: "performance",
      message: "Consider validating JSON structure before parsing",
      suggestion: "Use try-catch or validate input before parsing",
      rule: "no-unsafe-json-parse",
    },
  ];

  // Style patterns
  private readonly stylePatterns: IssuePattern[] = [
    {
      pattern: /var\s+\w+/,
      severity: "minor",
      category: "style",
      message: "Use 'const' or 'let' instead of 'var'",
      suggestion: "'var' has function scope - use 'const' or 'let' with block scope",
      rule: "no-var",
    },
    {
      pattern: /;\s*$/,
      severity: "info",
      category: "style",
      message: "Unnecessary semicolon - modern JS doesn't require semicolons",
      suggestion: "Remove unnecessary semicolons for cleaner code",
      rule: "semi",
    },
    {
      pattern: /catch\s*\(\s*\w*\s*\)\s*{\s*}/,
      severity: "minor",
      category: "bug",
      message: "Empty catch block - errors are silently ignored",
      suggestion: "Handle the error or log it for debugging",
      rule: "no-empty-catch",
    },
  ];

  getMetadata() {
    return this.metadata;
  }

  async execute(ctx: any, args: Record<string, any>): Promise<Record<string, any>> {
    const startTime = Date.now();
    const params = CodeReviewInputSchema.parse(args);

    try {
      const issues: CodeReviewOutput["issues"] = [];
      const lines = params.code.split("\n");

      // Select patterns based on review type
      let patterns: IssuePattern[] = [];
      switch (params.reviewType) {
        case "security":
          patterns = this.securityPatterns;
          break;
        case "performance":
          patterns = this.performancePatterns;
          break;
        case "style":
          patterns = this.stylePatterns;
          break;
        case "bugs":
          patterns = this.bugPatterns;
          break;
        default:
          patterns = [...this.securityPatterns, ...this.bugPatterns, ...this.performancePatterns, ...this.stylePatterns];
      }

      // Scan code for issues
      for (const pattern of patterns) {
        const matches = params.code.matchAll(new RegExp(pattern.pattern, "g"));
        for (const match of matches) {
          const lineIndex = params.code.substring(0, match.index!).split("\n").length - 1;
          issues.push({
            severity: pattern.severity,
            category: pattern.category,
            line: lineIndex + 1,
            message: pattern.message,
            suggestion: pattern.suggestion,
            rule: pattern.rule,
          });
        }
      }

      // Remove duplicates
      const uniqueIssues = this.deduplicateIssues(issues);

      // Calculate summary
      const summary = this.calculateSummary(uniqueIssues);

      // Perform security scan
      const securityScan = this.performSecurityScan(params.code, params.language);

      // Identify strengths
      const strengths = this.identifyStrengths(params.code, uniqueIssues);

      // Generate recommendations
      const recommendations = this.generateRecommendations(uniqueIssues, summary);

      return {
        success: true,
        reviewDate: new Date().toISOString(),
        language: params.language,
        summary,
        issues: uniqueIssues,
        strengths,
        recommendations,
        securityScan,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Code review failed",
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  private deduplicateIssues(issues: NonNullable<CodeReviewOutput["issues"]>): NonNullable<CodeReviewOutput["issues"]> {
    const seen = new Set<string>();
    return issues.filter((issue) => {
      const key = `${issue.line}:${issue.message}:${issue.rule}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private calculateSummary(issues: NonNullable<CodeReviewOutput["issues"]>): CodeReviewOutput["summary"] {
    const critical = issues.filter(i => i.severity === "critical").length;
    const major = issues.filter(i => i.severity === "major").length;
    const minor = issues.filter(i => i.severity === "minor").length;
    const info = issues.filter(i => i.severity === "info").length;
    const total = issues.length;

    // Calculate score (100 - deductions)
    const deductions = critical * 20 + major * 10 + minor * 3 + info * 1;
    const score = Math.max(0, 100 - deductions);

    let grade: "A" | "B" | "C" | "D" | "F";
    if (score >= 90) grade = "A";
    else if (score >= 75) grade = "B";
    else if (score >= 60) grade = "C";
    else if (score >= 40) grade = "D";
    else grade = "F";

    return {
      totalIssues: total,
      criticalIssues: critical,
      warnings: major + minor,
      suggestions: info,
      score,
      grade,
    };
  }

  private performSecurityScan(code: string, language: string): CodeReviewOutput["securityScan"] {
    const vulnerabilities: CodeReviewOutput["securityScan"]["vulnerabilities"] = [];
    let overallRisk: "low" | "medium" | "high" | "critical" = "low";

    // Check for SQL injection patterns
    if (/\$\{.*\}|%\(.*\)s|"\s*\+\s*\w+\s*\+\s*"/.test(code)) {
      vulnerabilities.push({
        type: "Injection",
        severity: "high",
        description: "Potential injection vulnerability detected - user input may be concatenated into queries",
        cwe: "CWE-89",
        remediation: "Use parameterized queries or ORM methods",
      });
      overallRisk = "high";
    }

    // Check for hardcoded secrets
    if (/password\s*=\s*["'][^"']+["']|api[_-]?key\s*=\s*["'][^"']+["']|secret\s*=\s*["'][^"']+["']/i.test(code)) {
      vulnerabilities.push({
        type: "Hardcoded Credentials",
        severity: "critical",
        description: "Hardcoded secrets found in source code",
        cwe: "CWE-798",
        remediation: "Move secrets to environment variables or secrets manager",
      });
      overallRisk = "critical";
    }

    // Check for XSS patterns
    if (/innerHTML\s*=|dangerouslySetInnerHTML/.test(code)) {
      vulnerabilities.push({
        type: "Cross-Site Scripting (XSS)",
        severity: "medium",
        description: "Potential XSS vulnerability - HTML injection possible",
        cwe: "CWE-79",
        remediation: "Sanitize HTML or use textContent instead",
      });
      if (overallRisk !== "critical") overallRisk = "medium";
    }

    // Check for weak cryptography
    if (/md5\s*\(|sha1\s*\(|DES\.encrypt|RC4/.test(code)) {
      vulnerabilities.push({
        type: "Weak Cryptography",
        severity: "medium",
        description: "Weak cryptographic algorithm detected",
        cwe: "CWE-327",
        remediation: "Use AES-256 or modern hashing algorithms (Argon2, bcrypt)",
      });
      if (overallRisk === "low") overallRisk = "medium";
    }

    return {
      vulnerabilities,
      overallRisk,
    };
  }

  private identifyStrengths(code: string, issues: CodeReviewOutput["issues"]): string[] {
    const strengths: string[] = [];

    // Check for good patterns
    if (/use\s+strict/.test(code) || /"strict":\s*true/.test(code)) {
      strengths.push("Uses strict mode for better error checking");
    }

    if (/try\s*{\s*[\s\S]*}\s*catch/.test(code)) {
      strengths.push("Proper error handling with try-catch blocks");
    }

    if (/interface\s+\w+|type\s+\w+\s*=/.test(code)) {
      strengths.push("Uses type definitions for better code safety");
    }

    if (/\bawait\b/.test(code) && /\basync\b/.test(code)) {
      strengths.push("Proper async/await pattern for asynchronous operations");
    }

    if (issues.filter(i => i.category === "security").length === 0) {
      strengths.push("No obvious security issues detected");
    }

    if (issues.filter(i => i.severity === "critical").length === 0 && issues.filter(i => i.severity === "major").length === 0) {
      strengths.push("No critical or major issues found - code looks solid");
    }

    return strengths;
  }

  private generateRecommendations(
    issues: CodeReviewOutput["issues"],
    summary: CodeReviewOutput["summary"]
  ): string[] {
    const recommendations: string[] = [];

    if (summary.criticalIssues > 0) {
      recommendations.push(`Fix ${summary.criticalIssues} critical issue(s) immediately - these pose serious security or stability risks`);
    }

    const securityIssues = issues.filter(i => i.category === "security");
    if (securityIssues.length > 0) {
      recommendations.push("Review and address all security findings before deployment");
    }

    if (summary.score < 75) {
      recommendations.push("Consider refactoring to address code quality issues");
    }

    const emptyCatch = issues.filter(i => i.rule === "no-empty-catch");
    if (emptyCatch.length > 0) {
      recommendations.push("Add error handling or logging to empty catch blocks");
    }

    const hardcodedSecrets = issues.filter(i => i.rule === "no-hardcoded-creds" || i.rule === "no-hardcoded-secrets");
    if (hardcodedSecrets.length > 0) {
      recommendations.push("Move all secrets to environment variables or a secrets manager");
    }

    return recommendations;
  }
}
