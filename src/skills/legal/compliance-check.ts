import { z } from "zod";
import { Tool } from "../../internal/skills.interface.js";
import { createBaseSkillMetadata } from "../types.js";

/**
 * Input schema for compliance check
 */
const ComplianceCheckInputSchema = z.object({
  entityType: z.enum([
    "bank",
    "fintech",
    "insurance",
    "it_company",
    "ecommerce",
    "telecom",
    "healthcare",
    "education",
    "government",
    "general",
  ]).describe("Type of entity to check compliance for"),
  regulations: z.array(z.string()).optional().describe("Specific regulation IDs to check"),
  checkTypes: z.array(z.enum([
    "data_protection",
    "cybersecurity",
    "aml_kyc",
    "consumer_protection",
    "financial",
    "environmental",
    "labor",
    "tax",
  ])).optional(),
  evidence: z.record(z.any()).optional().describe("Evidence/documents to validate against requirements"),
});

/**
 * Output schema for compliance check results
 */
const ComplianceCheckOutputSchema = z.object({
  success: z.boolean(),
  checkDate: z.string().optional(),
  entityType: z.string().optional(),
  overallStatus: z.enum(["compliant", "partial", "non_compliant"]).optional(),
  complianceScore: z.number().min(0).max(100).optional(),
  checks: z.array(z.object({
    category: z.string(),
    regulation: z.string(),
    status: z.enum(["pass", "fail", "warning", "not_applicable"]),
    findings: z.array(z.object({
      requirement: z.string(),
      status: z.enum(["met", "not_met", "partially_met"]),
      evidence: z.string().optional(),
      gap: z.string().optional(),
      recommendation: z.string().optional(),
    })).optional(),
    score: z.number().optional(),
  })).optional(),
  criticalIssues: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional(),
  nextReviewDate: z.string().optional(),
  executionTimeMs: z.number().optional(),
  error: z.string().optional(),
});

type ComplianceCheckInput = z.infer<typeof ComplianceCheckInputSchema>;
type ComplianceCheckOutput = z.infer<typeof ComplianceCheckOutputSchema>;

/**
 * Compliance Requirement
 */
interface ComplianceRequirement {
  category: string;
  regulation: string;
  regulationId: string;
  requirement: string;
  appliesTo: string[];
  evidenceRequired?: string[];
  checkLogic?: (evidence: Record<string, any>) => boolean;
}

/**
 * Compliance Requirements Database
 */
const COMPLIANCE_REQUIREMENTS: ComplianceRequirement[] = [
  // Data Protection
  {
    category: "data_protection",
    regulation: "Nghị định 13/2023/NĐ-CP về Bảo vệ Dữ liệu Cá nhân",
    regulationId: "nd-13-2023-nd-cp",
    requirement: "Thu thập dữ liệu cá nhân với sự đồng ý của chủ thể",
    appliesTo: ["fintech", "it_company", "ecommerce", "bank", "telecom"],
    evidenceRequired: ["consent_forms", "privacy_policy"],
  },
  {
    category: "data_protection",
    regulation: "Nghị định 13/2023/NĐ-CP về Bảo vệ Dữ liệu Cá nhân",
    regulationId: "nd-13-2023-nd-cp",
    requirement: "Cung cấp thông báo về mục đích xử lý dữ liệu",
    appliesTo: ["fintech", "it_company", "ecommerce", "bank", "telecom"],
    evidenceRequired: ["privacy_notice", "data_processing_purpose"],
  },
  {
    category: "data_protection",
    regulation: "Nghị định 13/2023/NĐ-CP về Bảo vệ Dữ liệu Cá nhân",
    regulationId: "nd-13-2023-nd-cp",
    requirement: "Cho phép chủ thể dữ liệu thực hiện quyền truy cập, sửa đổi, xóa",
    appliesTo: ["fintech", "it_company", "ecommerce", "bank", "telecom"],
    evidenceRequired: ["data_access_mechanism", "deletion_procedure"],
  },
  {
    category: "data_protection",
    regulation: "Nghị định 13/2023/NĐ-CP về Bảo vệ Dữ liệu Cá nhân",
    regulationId: "nd-13-2023-nd-cp",
    requirement: "Bổ nhiệm DPO cho tổ chức xử lý dữ liệu quy mô lớn",
    appliesTo: ["bank", "fintech", "telecom"],
    evidenceRequired: ["dpo_appointment", "dpo_contact_info"],
  },

  // Cybersecurity
  {
    category: "cybersecurity",
    regulation: "Luật An toàn thông tin mạng 2015",
    regulationId: "luat-an-toan-thong-tin-2015",
    requirement: "Thực hiện biện pháp bảo mật hệ thống thông tin",
    appliesTo: ["it_company", "bank", "fintech", "government", "telecom"],
    evidenceRequired: ["security_policy", "access_controls", "encryption_measures"],
  },
  {
    category: "cybersecurity",
    regulation: "Thông tư 12/2018/TT-BCA về ATTT",
    regulationId: "tt-cybersecurity-2018",
    requirement: "Báo cáo sự cố an ninh mạng trong vòng 24 giờ",
    appliesTo: ["government", "bank", "it_company", "telecom"],
    evidenceRequired: ["incident_response_plan", "reporting_procedure"],
  },
  {
    category: "cybersecurity",
    regulation: "Thông tư 12/2018/TT-BCA về ATTT",
    regulationId: "tt-cybersecurity-2018",
    requirement: "Đào tạo nhân sự về an toàn thông tin",
    appliesTo: ["it_company", "bank", "fintech", "government", "telecom"],
    evidenceRequired: ["training_records", "security_awareness_program"],
  },

  // AML/KYC
  {
    category: "aml_kyc",
    regulation: "Luật Phòng chống rửa tiền 2022",
    regulationId: "luat-pctp-rua-tien-2022",
    requirement: "Thực hiện KYC khi mở tài khoản khách hàng",
    appliesTo: ["bank", "fintech", "insurance"],
    evidenceRequired: ["kyc_procedure", "customer_identification", "beneficial_ownership"],
  },
  {
    category: "aml_kyc",
    regulation: "Luật Phòng chống rửa tiền 2022",
    regulationId: "luat-pctp-rua-tien-2022",
    requirement: "Báo cáo giao dịch đáng ngờ",
    appliesTo: ["bank", "fintech", "insurance"],
    evidenceRequired: ["str_procedure", "suspicious_transaction_monitoring"],
  },

  // Consumer Protection
  {
    category: "consumer_protection",
    regulation: "Luật Bảo vệ quyền lợi người tiêu dùng",
    regulationId: "luat-bvql-nguoi-tieu-dung",
    requirement: "Cung cấp thông tin rõ ràng về sản phẩm/dịch vụ",
    appliesTo: ["ecommerce", "fintech", "telecom", "bank"],
    evidenceRequired: ["product_disclosure", "fee_schedule"],
  },
  {
    category: "consumer_protection",
    regulation: "Luật Bảo vệ quyền lợi người tiêu dùng",
    regulationId: "luat-bvql-nguoi-tieu-dung",
    requirement: "Có cơ chế xử lý khiếu nại khách hàng",
    appliesTo: ["ecommerce", "fintech", "telecom", "bank", "healthcare", "education"],
    evidenceRequired: ["complaint_procedure", "customer_support_contact"],
  },

  // Financial
  {
    category: "financial",
    regulation: "Nghị định 13/2024/NĐ-CP về Quản lý ngân hàng",
    regulationId: "nd-13-2024-nd-cp",
    requirement: "Tuân thủ quy định về thanh toán điện tử",
    appliesTo: ["bank", "fintech"],
    evidenceRequired: ["payment_compliance", "settlement_procedure"],
  },
  {
    category: "financial",
    regulation: "Thông tư 50/2024/TT-NHNN về Thanh toán",
    regulationId: "tt-50-2024-tt-nhnn",
    requirement: "Đăng ký hoạt động ví điện tử với NHNN",
    appliesTo: ["fintech"],
    evidenceRequired: ["ewallet_registration", "escrow_account"],
  },

  // Tax
  {
    category: "tax",
    regulation: "Luật Thuế thu nhập doanh nghiệp",
    regulationId: "luat-thue-tndn",
    requirement: "Kê khai và nộp thuế đúng hạn",
    appliesTo: ["bank", "fintech", "insurance", "it_company", "ecommerce", "telecom", "healthcare", "education", "general"],
    evidenceRequired: ["tax_registration", "filing_records"],
  },

  // Labor
  {
    category: "labor",
    regulation: "Bộ luật Lao động 2019",
    regulationId: "bo-luat-lao-dong-2019",
    requirement: "Ký hợp đồng lao động với nhân viên",
    appliesTo: ["bank", "fintech", "insurance", "it_company", "ecommerce", "telecom", "healthcare", "education", "general", "government"],
    evidenceRequired: ["employment_contracts", "labor_contracts"],
  },
  {
    category: "labor",
    regulation: "Bộ luật Lao động 2019",
    regulationId: "bo-luat-lao-dong-2019",
    requirement: "Đóng bảo hiểm xã hội cho nhân viên",
    appliesTo: ["bank", "fintech", "insurance", "it_company", "ecommerce", "telecom", "healthcare", "education", "general", "government"],
    evidenceRequired: ["social_insurance_records", "hi_premium_payments"],
  },
];

/**
 * Compliance Check Skill
 * Check compliance against applicable Vietnamese regulations
 */
export class ComplianceCheckSkill implements Tool {
  name = "compliance_check";
  description = "Check compliance status against Vietnamese regulations by entity type";
  inputSchema = ComplianceCheckInputSchema;

  private readonly metadata = createBaseSkillMetadata({
    id: "compliance-check",
    name: "Vietnam Compliance Checker",
    description: "Check compliance status against applicable Vietnamese regulations for specific entity types",
    category: "legal",
    version: "1.0.0",
    author: "NexusAI",
    requiredPermissions: ["read:knowledge", "read:legal-db", "analyze:compliance"],
    requiredCapabilities: ["legal-analyzer", "compliance-checker"],
    estimatedDuration: "5-20s",
    trustScore: 94,
    requiresHumanApproval: false,
    rateLimitPerMinute: 30,
    inputSchema: ComplianceCheckInputSchema,
    outputSchema: ComplianceCheckOutputSchema,
  });

  getMetadata() {
    return this.metadata;
  }

  async execute(ctx: any, args: Record<string, any>): Promise<Record<string, any>> {
    const startTime = Date.now();
    const params = ComplianceCheckInputSchema.parse(args);

    try {
      // Get applicable requirements
      let requirements = COMPLIANCE_REQUIREMENTS.filter(req => 
        req.appliesTo.includes(params.entityType)
      );

      // Filter by check types
      if (params.checkTypes?.length) {
        requirements = requirements.filter(req => 
          params.checkTypes!.includes(req.category as any)
        );
      }

      // Filter by specific regulations
      if (params.regulations?.length) {
        requirements = requirements.filter(req => 
          params.regulations!.includes(req.regulationId)
        );
      }

      // Group by category and regulation
      const checks = this.performChecks(requirements, params.evidence || {});

      // Calculate overall status
      const totalChecks = checks.reduce((sum, c) => sum + c.findings.length, 0);
      const passedChecks = checks.reduce((sum, c) => 
        sum + c.findings.filter(f => f.status === "met").length, 0
      );
      const complianceScore = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

      let overallStatus: "compliant" | "partial" | "non_compliant";
      if (complianceScore >= 90) overallStatus = "compliant";
      else if (complianceScore >= 60) overallStatus = "partial";
      else overallStatus = "non_compliant";

      // Collect issues and warnings
      const criticalIssues = checks.flatMap(c => 
        c.findings.filter(f => f.status === "not_met").map(f => f.gap || f.requirement)
      );
      const warnings = checks.flatMap(c => 
        c.findings.filter(f => f.status === "partially_met").map(f => f.gap || f.requirement)
      );

      // Generate recommendations
      const recommendations = this.generateRecommendations(checks);

      return {
        success: true,
        checkDate: new Date().toISOString(),
        entityType: params.entityType,
        overallStatus,
        complianceScore,
        checks,
        criticalIssues,
        warnings,
        recommendations,
        nextReviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Compliance check failed",
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  private performChecks(
    requirements: ComplianceRequirement[],
    evidence: Record<string, any>
  ): ComplianceCheckOutput["checks"] {
    // Group by category and regulation
    const grouped = new Map<string, ComplianceRequirement[]>();
    
    for (const req of requirements) {
      const key = `${req.category}|${req.regulationId}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(req);
    }

    const checks: ComplianceCheckOutput["checks"] = [];

    for (const [key, reqs] of grouped) {
      const [category, regulationId] = key.split("|");
      const firstReq = reqs[0];

      const findings = reqs.map(req => {
        const hasEvidence = req.evidenceRequired?.every(e => evidence[e]);
        const status = !hasEvidence ? "not_met" : "partially_met";

        return {
          requirement: req.requirement,
          status: status as "met" | "not_met" | "partially_met",
          evidence: hasEvidence ? "Evidence provided" : undefined,
          gap: !hasEvidence ? `Missing evidence: ${req.evidenceRequired?.join(", ")}` : undefined,
          recommendation: !hasEvidence 
            ? `Provide evidence of ${req.evidenceRequired?.join(", ")}`
            : undefined,
        };
      });

      const passCount = findings.filter(f => f.status === "met").length;
      const score = Math.round((passCount / findings.length) * 100);

      checks.push({
        category,
        regulation: firstReq.regulation,
        status: score === 100 ? "pass" : score >= 50 ? "warning" : "fail",
        findings,
        score,
      });
    }

    return checks;
  }

  private generateRecommendations(checks: ComplianceCheckOutput["checks"]): string[] {
    const recommendations: string[] = [];

    // High priority (fail status)
    const failed = checks.filter(c => c.status === "fail");
    for (const check of failed) {
      recommendations.push(`[CRITICAL] Address ${check.category} compliance gaps for ${check.regulation}`);
      for (const finding of check.findings.filter(f => f.recommendation)) {
        recommendations.push(`  - ${finding.recommendation}`);
      }
    }

    // Medium priority (warning status)
    const warnings = checks.filter(c => c.status === "warning");
    for (const check of warnings) {
      recommendations.push(`[IMPROVE] Strengthen ${check.category} controls for ${check.regulation}`);
    }

    // Add general recommendations
    if (checks.length === 0) {
      recommendations.push("No specific compliance requirements found for this entity type");
    }

    return recommendations;
  }
}

/**
 * Generate compliance summary report
 */
export function generateComplianceReport(
  checks: ComplianceCheckOutput["checks"],
  entityType: string
): string {
  const totalScore = checks.reduce((sum, c) => sum + (c.score || 0), 0);
  const avgScore = checks.length > 0 ? Math.round(totalScore / checks.length) : 0;

  let status = "COMPLIANT";
  if (avgScore < 60) status = "NON-COMPLIANT";
  else if (avgScore < 90) status = "PARTIALLY COMPLIANT";

  const lines = [
    `=== COMPLIANCE CHECK REPORT ===`,
    `Entity Type: ${entityType}`,
    `Date: ${new Date().toISOString()}`,
    `Status: ${status}`,
    `Score: ${avgScore}%`,
    ``,
    `=== CHECK DETAILS ===`,
  ];

  for (const check of checks) {
    lines.push(`${check.category.toUpperCase()} - ${check.status.toUpperCase()} (${check.score}%)`);
    lines.push(`  Regulation: ${check.regulation}`);
    for (const finding of check.findings) {
      const icon = finding.status === "met" ? "✓" : finding.status === "partially_met" ? "~" : "✗";
      lines.push(`  ${icon} ${finding.requirement}`);
    }
  }

  return lines.join("\n");
}
