import { z } from "zod";
import { Tool } from "../../internal/skills.interface.js";
import { createBaseSkillMetadata } from "../types.js";

/**
 * Input schema for contract analysis
 */
const ContractAnalyzerInputSchema = z.object({
  contractText: z.string().min(100).describe("Full text of the contract to analyze"),
  contractType: z.enum(["service", "employment", "lease", "sales", "partnership", "loan", "nda", "general"]).default("general"),
  language: z.enum(["vi", "en"]).optional().default("vi"),
  checkClauses: z.array(z.enum([
    "liability",
    "termination",
    "confidentiality",
    "payment",
    "intellectual_property",
    "force_majeure",
    "dispute_resolution",
    "governing_law",
    "indemnification",
    "warranties",
    "assignment",
    "notices",
  ])).optional(),
});

/**
 * Output schema for contract analysis results
 */
const ContractAnalyzerOutputSchema = z.object({
  success: z.boolean(),
  contractType: z.string().optional(),
  analysisDate: z.string().optional(),
  clauses: z.array(z.object({
    type: z.string(),
    title: z.string(),
    present: z.boolean(),
    text: z.string().optional(),
    findings: z.array(z.object({
      severity: z.enum(["high", "medium", "low", "info"]),
      issue: z.string(),
      recommendation: z.string().optional(),
    })).optional(),
    complianceScore: z.number().min(0).max(100).optional(),
  })).optional(),
  overallScore: z.number().min(0).max(100).optional(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  summary: z.string().optional(),
  recommendations: z.array(z.string()).optional(),
  executionTimeMs: z.number().optional(),
  error: z.string().optional(),
});

type ContractAnalyzerInput = z.infer<typeof ContractAnalyzerInputSchema>;
type ContractAnalyzerOutput = z.infer<typeof ContractAnalyzerOutputSchema>;

/**
 * Clause Analysis Result
 */
interface ClauseAnalysis {
  type: string;
  title: string;
  present: boolean;
  text?: string;
  findings: Array<{
    severity: "high" | "medium" | "low" | "info";
    issue: string;
    recommendation?: string;
  }>;
  complianceScore?: number;
}

/**
 * Standard Clause Patterns
 */
const CLAUSE_PATTERNS: Record<string, { title: string; patterns: RegExp[]; keywords: string[] }> = {
  liability: {
    title: "Liability / Trách nhiệm",
    patterns: [
      /trách nhiệm\s+(?:bồi thường|giới hạn)/gi,
      /liability\s+(?:limitation|indemnification)/gi,
      /giới hạn\s+trách nhiệm/gi,
      /không\s+(?:chịu trách nhiệm|bồi thường)/gi,
    ],
    keywords: ["bồi thường", "trách nhiệm", "liability", "indemnify", "damages"],
  },
  termination: {
    title: "Termination / Chấm dứt hợp đồng",
    patterns: [
      /chấm dứt\s+(?:hợp đồng|thỏa thuận)/gi,
      /termination\s+(?:clause|right)/gi,
      /đơn phương\s+(?:chấm dứt|hủy bỏ)/gi,
      /thời hạn\s+(?:chấm dứt|tự động gia hạn)/gi,
    ],
    keywords: ["chấm dứt", "hủy bỏ", "termination", "terminate", "cancel"],
  },
  confidentiality: {
    title: "Confidentiality / Bảo mật",
    patterns: [
      /bảo\s+mật\s+(?:thông tin|tài liệu)/gi,
      /confidential(?:ity| information)/gi,
      /không\s+(?:tiết lộ|chia sẻ)\s+(?:thông tin|tài liệu)/gi,
      /thời hạn\s+bảo\s+mật/gi,
    ],
    keywords: ["bảo mật", "confidential", " bí mật", "private", "non-disclosure"],
  },
  payment: {
    title: "Payment Terms / Thanh toán",
    patterns: [
      /thanh\s+toán\s+(?:bằng|theo|cọc)/gi,
      /payment\s+(?:terms|method|schedule)/gi,
      /phương\s+thức\s+thanh\s+toán/gi,
      /số\s+(?:tiền|tài khoản|ngân hàng)/gi,
    ],
    keywords: ["thanh toán", "payment", "tiền", "chi phí", "fee"],
  },
  intellectual_property: {
    title: "Intellectual Property / Sở hữu trí tuệ",
    patterns: [
      /sở\s+hữu\s+(?:trí tuệ|brain não)/gi,
      /intellectual\s+property(?:\s+rights)?/gi,
      /quyền\s+(?:sở hữu|tác giả|bản quyền)/gi,
      /license(?:\s+grant)?/gi,
    ],
    keywords: ["sở hữu trí tuệ", "IP", "patent", "copyright", "license"],
  },
  force_majeure: {
    title: "Force Majeure / Bất khả kháng",
    patterns: [
      /bất\s+khả\s+kháng/gi,
      /force\s+majeure/gi,
      /trường\s+hợp\s+(?:bất khả kháng|đặc biệt)/gi,
      /thiên\s+tai\s+(?:động đất|bão lũ)/gi,
    ],
    keywords: ["bất khả kháng", "force majeure", " Acts of God"],
  },
  dispute_resolution: {
    title: "Dispute Resolution / Giải quyết tranh chấp",
    patterns: [
      /giải\s+quyết\s+(?:tranh chấp|khúc mắc)/gi,
      /dispute\s+resolution(?:\s+clause)?/gi,
      /trọng tài\s+(?:thương mại|kinh tế)/gi,
      /tòa\s+(?:án|dân sự|kinh doanh)/gi,
    ],
    keywords: ["tranh chấp", "dispute", " arbitration", "tòa án", "mediation"],
  },
  governing_law: {
    title: "Governing Law / Luật áp dụng",
    patterns: [
      /luật\s+(?:áp dụng|quốc gia|nhà nước)/gi,
      /governing\s+law/gi,
      /pháp\s+luật\s+(?:Việt Nam|TP\.?\s+HCM|Hà Nội)/gi,
      /thẩm\s+quyền\s+(?:giải quyết|xét xử)/gi,
    ],
    keywords: ["luật áp dụng", "governing law", " jurisdiction", "pháp luật"],
  },
  indemnification: {
    title: "Indemnification / Bồi thường",
    patterns: [
      /bồi\s+thường\s+(?:thiệt hại|hao phí)/gi,
      /indemnif(?:y|ication)/gi,
      /đền\s+bù\s+(?:thiệt hại|hao phí)/gi,
      /compensat(?:e|ion)/gi,
    ],
    keywords: ["bồi thường", "indemnify", "đền bù", "compensate"],
  },
  warranties: {
    title: "Warranties / Bảo hành",
    patterns: [
      /bảo\s+hành(?:\s+thời gian|sản phẩm)?/gi,
      /warrant(?:y|ies)/gi,
      /đảm\s+bảo\s+(?:chất lượng|tính năng)/gi,
      /cam\s+kết\s+(?:chất lượng|hàng hóa)/gi,
    ],
    keywords: ["bảo hành", "warranty", "đảm bảo", "guarantee"],
  },
  assignment: {
    title: "Assignment / Chuyển nhượng",
    patterns: [
      /chuyển\s+nhượng(?:\s+quyền|hợp đồng)?/gi,
      /assignment(?:\s+clause| rights)?/gi,
      /ủy\s+quyền(?:\s+đại diện)?/gi,
      /ủy\s+thác(?:\s+quyền)?/gi,
    ],
    keywords: ["chuyển nhượng", "assignment", "ủy quyền", "delegate"],
  },
  notices: {
    title: "Notices / Thông báo",
    patterns: [
      /thông\s+báo(?:\s+bằng văn bản|trước)?/gi,
      /notic(?:e|es)(?:\s+period| requirement)?/gi,
      /bằng\s+văn\s+bản(?:\s+gửi)?/gi,
      /gửi\s+(?:thư|email|tới)\s+(?:địa chỉ)?/gi,
    ],
    keywords: ["thông báo", "notice", "văn bản", "written"],
  },
};

/**
 * Contract Analyzer Skill
 * Analyzes contract clauses against legal standards
 */
export class ContractAnalyzerSkill implements Tool {
  name = "contract_analyzer";
  description = "Analyze Vietnamese contracts for clause completeness, risks, and compliance";
  inputSchema = ContractAnalyzerInputSchema;

  private readonly metadata = createBaseSkillMetadata({
    id: "contract-analyzer",
    name: "Contract Clause Analyzer",
    description: "Analyze contract clauses against Vietnamese legal standards for completeness and risk assessment",
    category: "legal",
    version: "1.0.0",
    author: "NexusAI",
    requiredPermissions: ["read:documents", "analyze:contracts"],
    requiredCapabilities: ["legal-text-parser", "risk-assessor"],
    estimatedDuration: "10-30s",
    trustScore: 92,
    requiresHumanApproval: false,
    rateLimitPerMinute: 20,
    inputSchema: ContractAnalyzerInputSchema,
    outputSchema: ContractAnalyzerOutputSchema,
  });

  getMetadata() {
    return this.metadata;
  }

  async execute(ctx: any, args: Record<string, any>): Promise<Record<string, any>> {
    const startTime = Date.now();
    const params = ContractAnalyzerInputSchema.parse(args);

    try {
      const clauses: ClauseAnalysis[] = [];
      const clauseTypes = params.checkClauses || Object.keys(CLAUSE_PATTERNS);

      for (const clauseType of clauseTypes) {
        const pattern = CLAUSE_PATTERNS[clauseType];
        if (!pattern) continue;

        const analysis = this.analyzeClause(params.contractText, clauseType, pattern);
        clauses.push(analysis);
      }

      // Calculate overall score
      const presentClauses = clauses.filter(c => c.present);
      const avgCompliance = presentClauses.reduce((sum, c) => sum + (c.complianceScore || 0), 0);
      const overallScore = presentClauses.length > 0 ? Math.round(avgCompliance / presentClauses.length) : 0;

      // Determine risk level
      const highSeverity = clauses.reduce((count, c) => 
        count + c.findings.filter(f => f.severity === "high").length, 0
      );
      const mediumSeverity = clauses.reduce((count, c) => 
        count + c.findings.filter(f => f.severity === "medium").length, 0
      );

      let riskLevel: "low" | "medium" | "high" | "critical" = "low";
      if (highSeverity >= 3 || overallScore < 40) riskLevel = "critical";
      else if (highSeverity >= 1 || mediumSeverity >= 3) riskLevel = "high";
      else if (mediumSeverity >= 1 || overallScore < 70) riskLevel = "medium";

      // Generate recommendations
      const recommendations = this.generateRecommendations(clauses, params.contractType);

      return {
        success: true,
        contractType: params.contractType,
        analysisDate: new Date().toISOString(),
        clauses,
        overallScore,
        riskLevel,
        summary: this.generateSummary(overallScore, riskLevel, clauses.length),
        recommendations,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Contract analysis failed",
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  private analyzeClause(
    text: string,
    type: string,
    pattern: { title: string; patterns: RegExp[]; keywords: string[] }
  ): ClauseAnalysis {
    const analysis: ClauseAnalysis = {
      type,
      title: pattern.title,
      present: false,
      findings: [],
      complianceScore: 0,
    };

    // Search for clause
    let matchedText: string | undefined;
    for (const regex of pattern.patterns) {
      const match = text.match(regex);
      if (match) {
        analysis.present = true;
        matchedText = match[0];
        break;
      }
    }

    if (matchedText) {
      analysis.text = matchedText;

      // Check for specific issues
      analysis.findings = this.checkClauseIssues(text, type, pattern.keywords);
      
      // Calculate compliance score
      analysis.complianceScore = this.calculateClauseCompliance(analysis.findings);
    } else {
      // Clause not found - add finding
      analysis.findings.push({
        severity: type === "confidentiality" || type === "liability" ? "high" : "medium",
        issue: `Clause "${pattern.title}" not found in contract`,
        recommendation: `Consider adding a ${pattern.title} clause to protect contractual interests`,
      });
      analysis.complianceScore = 0;
    }

    return analysis;
  }

  private checkClauseIssues(
    text: string,
    type: string,
    keywords: string[]
  ): ClauseAnalysis["findings"] {
    const findings: ClauseAnalysis["findings"] = [];

    // Check for vague language
    if (/tùy\s+(?:ý|bạn|đối tác)/i.test(text)) {
      findings.push({
        severity: "medium",
        issue: "Vague language detected that may cause interpretation disputes",
        recommendation: "Replace ambiguous terms with specific, measurable criteria",
      });
    }

    // Check for one-sided terms
    if (/(?:chỉ|đơn phương)\s+(?:có|thực hiện)/i.test(text)) {
      findings.push({
        severity: "medium",
        issue: "Potential one-sided clause detected",
        recommendation: "Ensure clauses are balanced between parties",
      });
    }

    // Type-specific checks
    switch (type) {
      case "liability":
        if (/không\s+(?:chịu trách nhiệm|bồi thường)/i.test(text)) {
          findings.push({
            severity: "high",
            issue: "Exemption of liability clause found",
            recommendation: "Review for compliance with Vietnamese law on unfair contract terms",
          });
        }
        break;
      case "termination":
        if (/không\s+cần\s+thông\s+báo/i.test(text)) {
          findings.push({
            severity: "medium",
            issue: "Immediate termination without notice",
            recommendation: "Add reasonable notice period for fair termination",
          });
        }
        break;
      case "confidentiality":
        if (!/thời\s+gian\s+(?:bảo mật|hạn)/i.test(text)) {
          findings.push({
            severity: "low",
            issue: "No time limit specified for confidentiality obligations",
            recommendation: "Consider adding duration for confidentiality obligations",
          });
        }
        break;
    }

    return findings;
  }

  private calculateClauseCompliance(findings: ClauseAnalysis["findings"]): number {
    if (findings.length === 0) return 100;

    const weights = { high: 30, medium: 15, low: 5, info: 0 };
    const deduction = findings.reduce((sum, f) => sum + weights[f.severity], 0);

    return Math.max(0, 100 - deduction);
  }

  private generateRecommendations(clauses: ClauseAnalysis[], contractType: string): string[] {
    const recommendations: string[] = [];

    // Missing critical clauses
    const missingCritical = clauses.filter(c => !c.present);
    for (const clause of missingCritical) {
      if (["liability", "confidentiality", "termination"].includes(clause.type)) {
        recommendations.push(`Add missing ${clause.title} clause to protect all parties`);
      }
    }

    // High severity findings
    const highFindings = clauses.flatMap(c => c.findings.filter(f => f.severity === "high"));
    if (highFindings.length > 0) {
      recommendations.push("Review and address high-severity issues before signing");
    }

    // Low compliance scores
    const lowCompliance = clauses.filter(c => c.complianceScore !== undefined && c.complianceScore < 70);
    for (const clause of lowCompliance) {
      recommendations.push(`Improve ${clause.title} clause compliance (currently ${clause.complianceScore}%)`);
    }

    return recommendations;
  }

  private generateSummary(score: number, riskLevel: string, clauseCount: number): string {
    const riskText: Record<string, string> = {
      low: "low risk",
      medium: "moderate risk",
      high: "high risk",
      critical: "critical risk requiring immediate attention",
    };

    if (score >= 80) {
      return `Contract shows good legal compliance (${score}%). Overall ${riskText[riskLevel]}.`;
    } else if (score >= 60) {
      return `Contract has moderate compliance (${score}%). Some improvements recommended.`;
    } else {
      return `Contract requires significant improvements (${score}% compliance). High-severity issues found.`;
    }
  }
}
