import { z } from "zod";
import { Tool } from "../../internal/skills.interface.js";
import { createBaseSkillMetadata } from "../types.js";

/**
 * Input schema for regulation lookup
 */
const RegulationLookupInputSchema = z.object({
  topic: z.string().min(2).describe("Topic or keyword to search regulations"),
  industry: z.enum([
    "banking",
    "fintech",
    "insurance",
    "it",
    "telecom",
    "ecommerce",
    "healthcare",
    "education",
    "manufacturing",
    "retail",
    "general",
  ]).optional().default("general"),
  jurisdiction: z.enum(["national", "hanoi", "hochiminh", "danang", "all"]).optional().default("national"),
  documentType: z.enum(["law", "decree", "decision", "circular", "resolution", "all"]).optional().default("all"),
  includeExpired: z.boolean().optional().default(false),
  limit: z.number().int().positive().optional().default(10),
});

/**
 * Output schema for regulation lookup
 */
const RegulationLookupOutputSchema = z.object({
  success: z.boolean(),
  regulations: z.array(z.object({
    id: z.string(),
    title: z.string(),
    type: z.string(),
    number: z.string().optional(),
    issuer: z.string().optional(),
    issuedDate: z.string().optional(),
    effectiveDate: z.string().optional(),
    status: z.enum(["active", "expired", "amended"]),
    summary: z.string().optional(),
    keyProvisions: z.array(z.string()).optional(),
    obligations: z.array(z.object({
      entity: z.string().describe("Affected entity type"),
      requirement: z.string().describe("Legal requirement"),
      deadline: z.string().optional(),
      penalty: z.string().optional(),
    })).optional(),
    relatedRegulations: z.array(z.string()).optional(),
    complianceChecklist: z.array(z.string()).optional(),
    url: z.string().optional(),
  })).optional(),
  totalFound: z.number().optional(),
  executionTimeMs: z.number().optional(),
  error: z.string().optional(),
});

type RegulationLookupInput = z.infer<typeof RegulationLookupInputSchema>;
type RegulationLookupOutput = z.infer<typeof RegulationLookupOutputSchema>;

/**
 * Regulation Reference
 */
interface Regulation {
  id: string;
  title: string;
  type: string;
  number?: string;
  issuer: string;
  issuedDate: string;
  effectiveDate: string;
  expirationDate?: string;
  status: "active" | "expired" | "amended";
  industry: string[];
  keywords: string[];
  summary: string;
  keyProvisions: string[];
  obligations: Array<{
    entity: string;
    requirement: string;
    deadline?: string;
    penalty?: string;
  }>;
  relatedRegulations: string[];
}

/**
 * Vietnamese Regulations Database
 */
const REGULATIONS_DB: Regulation[] = [
  {
    id: "luat-an-toan-thong-tin-2015",
    title: "Luật An toàn thông tin mạng",
    type: "law",
    number: "86/2015/QH13",
    issuer: "Quốc hội",
    issuedDate: "2015-11-19",
    effectiveDate: "2016-07-01",
    status: "active",
    industry: ["it", "banking", "fintech", "ecommerce"],
    keywords: ["an toàn thông tin", "cybersecurity", "bảo mật", "dữ liệu", "mạng"],
    summary: "Luật quy định về an toàn thông tin mạng, bảo vệ hệ thống thông tin và dữ liệu cá nhân",
    keyProvisions: [
      "Bảo vệ thông tin cá nhân trên không gian mạng",
      "An toàn hệ thống thông tin quan trọng",
      "Phòng chống tấn công mạng",
      "Xử lý vi phạm an toàn thông tin",
    ],
    obligations: [
      {
        entity: "Doanh nghiệp CNTT",
        requirement: "Thực hiện bảo mật thông tin theo quy định",
        penalty: "Phạt tiền từ 20-100 triệu đồng",
      },
      {
        entity: "Ngân hàng, tổ chức tài chính",
        requirement: "Bảo vệ dữ liệu khách hàng theo tiêu chuẩn",
        deadline: "01/07/2016",
      },
    ],
    relatedRegulations: ["nd-13-2023-nd-cp", "tt-cybersecurity-2018"],
  },
  {
    id: "nd-13-2023-nd-cp",
    title: "Nghị định về bảo vệ dữ liệu cá nhân",
    type: "decree",
    number: "13/2023/NĐ-CP",
    issuer: "Chính phủ",
    issuedDate: "2023-04-17",
    effectiveDate: "2023-07-01",
    status: "active",
    industry: ["it", "fintech", "ecommerce", "banking", "telecom"],
    keywords: ["dữ liệu cá nhân", "bảo vệ", "privacy", "GDPR-like", "DPO"],
    summary: "Nghị định quy định về bảo vệ dữ liệu cá nhân, tương tự GDPR của Việt Nam",
    keyProvisions: [
      "Định nghĩa và phân loại dữ liệu cá nhân",
      "Quyền của chủ thể dữ liệu",
      "Nghĩa vụ của tổ chức xử lý dữ liệu",
      "Yêu cầu về consent và thông báo",
      "Bổ nhiệm DPO (Data Protection Officer)",
    ],
    obligations: [
      {
        entity: "Tất cả tổ chức xử lý DLCN",
        requirement: "Thu thập dữ liệu với sự đồng ý của chủ thể",
        deadline: "01/07/2023",
        penalty: "Phạt tiền đến 5% doanh thu hoặc 100 triệu VNĐ",
      },
      {
        entity: "Doanh nghiệp lớn",
        requirement: "Bổ nhiệm DPO hoặc bộ phận bảo vệ dữ liệu",
        deadline: "01/07/2024",
      },
    ],
    relatedRegulations: ["luat-an-toan-thong-tin-2015", "tt-data-protection-2023"],
  },
  {
    id: "nd-13-2024-nd-cp",
    title: "Nghị định về quản lý hoạt động ngân hàng",
    type: "decree",
    number: "13/2024/NĐ-CP",
    issuer: "Chính phủ",
    issuedDate: "2024-03-15",
    effectiveDate: "2024-05-01",
    status: "active",
    industry: ["banking", "fintech"],
    keywords: ["ngân hàng", "tín dụng", "Fintech", "thanh toán", "số"],
    summary: "Nghị định quy định về quản lý hoạt động ngân hàng và hỗ trợ Fintech",
    keyProvisions: [
      "Quản lý hoạt động ngân hàng số",
      "Hỗ trợ đổi mới sáng tạo trong lĩnh vực ngân hàng",
      "Thanh toán điện tử và ví điện tử",
      "Tiêu chuẩn AML/KYC cho Fintech",
    ],
    obligations: [
      {
        entity: "Ngân hàng thương mại",
        requirement: "Tuân thủ quy định về thanh toán điện tử",
        deadline: "01/05/2024",
      },
      {
        entity: "Công ty Fintech",
        requirement: "Đăng ký với Ngân hàng Nhà nước",
        deadline: "01/01/2025",
        penalty: "Xử phạt hoạt động không phép",
      },
    ],
    relatedRegulations: ["tt-50-2024-tt-nhnn", "qd-fintech-sandbox"],
  },
  {
    id: "tt-cybersecurity-2018",
    title: "Thông tư về bảo đảm an toàn thông tin cho hệ thống thông tin",
    type: "circular",
    number: "Công an số 12/2018/TT-BCA",
    issuer: "Bộ Công an",
    issuedDate: "2018-05-15",
    effectiveDate: "2018-08-01",
    status: "active",
    industry: ["it", "banking", "government"],
    keywords: ["an ninh mạng", "bảo mật", "hệ thống thông tin", "ATTT"],
    summary: "Quy định về bảo đảm an toàn thông tin cho hệ thống thông tin",
    keyProvisions: [
      "Yêu cầu bảo mật hệ thống",
      "Báo cáo sự cố an ninh mạng",
      "Đào tạo nhân sự ATTT",
    ],
    obligations: [
      {
        entity: "Cơ quan nhà nước",
        requirement: "Thực hiện kiểm tra an ninh định kỳ",
        deadline: "Hàng năm",
      },
    ],
    relatedRegulations: ["luat-an-toan-thong-tin-2015"],
  },
  {
    id: "luat-ky-so-2015",
    title: "Luật Giao dịch điện tử",
    type: "law",
    number: "51/2005/QH11",
    issuer: "Quốc hội",
    issuedDate: "2005-11-29",
    effectiveDate: "2006-03-01",
    status: "active",
    industry: ["it", "banking", "ecommerce", "general"],
    keywords: ["giao dịch điện tử", "chữ ký số", "hợp đồng điện tử", "e-commerce"],
    summary: "Luật quy định về giao dịch điện tử và chữ ký số",
    keyProvisions: [
      "Hiệu lực pháp lý của giao dịch điện tử",
      "Chữ ký số và chứng thực điện tử",
      "Hợp đồng điện tử",
    ],
    obligations: [
      {
        entity: "Doanh nghiệp sử dụng HĐĐT",
        requirement: "Đảm bảo an toàn chữ ký số",
      },
    ],
    relatedRegulations: ["nd-130-2021-nd-cp"],
  },
];

/**
 * Regulation Lookup Skill
 * Look up Vietnamese regulations by topic and industry
 */
export class RegulationLookupSkill implements Tool {
  name = "regulation_lookup";
  description = "Look up Vietnamese regulations by topic, industry, and jurisdiction";
  inputSchema = RegulationLookupInputSchema;

  private readonly metadata = createBaseSkillMetadata({
    id: "regulation-lookup",
    name: "Vietnam Regulation Lookup",
    description: "Look up Vietnamese regulations by topic, industry, and jurisdiction with compliance guidance",
    category: "legal",
    version: "1.0.0",
    author: "NexusAI",
    requiredPermissions: ["read:knowledge", "read:legal-db"],
    requiredCapabilities: ["legal-search-engine", "regulation-analyzer"],
    estimatedDuration: "3-10s",
    trustScore: 96,
    requiresHumanApproval: false,
    rateLimitPerMinute: 50,
    inputSchema: RegulationLookupInputSchema,
    outputSchema: RegulationLookupOutputSchema,
  });

  getMetadata() {
    return this.metadata;
  }

  async execute(ctx: any, args: Record<string, any>): Promise<Record<string, any>> {
    const startTime = Date.now();
    const params = RegulationLookupInputSchema.parse(args);

    try {
      // Filter regulations
      let results = REGULATIONS_DB.filter(reg => {
        // Status filter
        if (!params.includeExpired && reg.status !== "active") {
          return false;
        }

        // Document type filter
        if (params.documentType !== "all" && reg.type !== params.documentType) {
          return false;
        }

        // Industry filter
        if (params.industry !== "general" && !reg.industry.includes(params.industry)) {
          return false;
        }

        // Text search
        const queryLower = params.topic.toLowerCase();
        const searchFields = [
          reg.title.toLowerCase(),
          reg.keywords.join(" ").toLowerCase(),
          reg.summary.toLowerCase(),
        ];
        
        if (!searchFields.some(field => field.includes(queryLower))) {
          return false;
        }

        return true;
      });

      // Sort by relevance
      results.sort((a, b) => {
        const aScore = this.calculateRelevance(a, params.topic, params.industry);
        const bScore = this.calculateRelevance(b, params.topic, params.industry);
        return bScore - aScore;
      });

      const totalFound = results.length;
      const limitedResults = results.slice(0, params.limit);

      return {
        success: true,
        regulations: limitedResults.map(reg => ({
          id: reg.id,
          title: reg.title,
          type: reg.type,
          number: reg.number,
          issuer: reg.issuer,
          issuedDate: reg.issuedDate,
          effectiveDate: reg.effectiveDate,
          status: reg.status,
          summary: reg.summary,
          keyProvisions: reg.keyProvisions,
          obligations: reg.obligations,
          relatedRegulations: reg.relatedRegulations,
          complianceChecklist: this.generateChecklist(reg),
          url: `https://vbpl.vn/${reg.type}s/${reg.id}`,
        })),
        totalFound,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Regulation lookup failed",
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  private calculateRelevance(reg: Regulation, topic: string, industry: string): number {
    let score = 0;

    // Topic match
    const topicLower = topic.toLowerCase();
    if (reg.title.toLowerCase().includes(topicLower)) score += 0.4;
    if (reg.keywords.some(k => k.toLowerCase().includes(topicLower))) score += 0.3;
    if (reg.summary.toLowerCase().includes(topicLower)) score += 0.2;

    // Industry relevance
    if (industry !== "general" && reg.industry.includes(industry)) {
      score += 0.2;
    }

    // Active bonus
    if (reg.status === "active") score += 0.1;

    return Math.min(1, score);
  }

  private generateChecklist(reg: Regulation): string[] {
    const checklist: string[] = [];

    for (const obligation of reg.obligations) {
      checklist.push(`[${obligation.entity}] ${obligation.requirement}`);
      if (obligation.deadline) {
        checklist.push(`  Deadline: ${obligation.deadline}`);
      }
      if (obligation.penalty) {
        checklist.push(`  Penalty: ${obligation.penalty}`);
      }
    }

    return checklist;
  }
}

/**
 * Check compliance status for a regulation
 */
export function checkComplianceStatus(regulationId: string, entityType: string): {
  compliant: boolean;
  pendingActions: string[];
  overdueActions: string[];
} {
  const reg = REGULATIONS_DB.find(r => r.id === regulationId);
  if (!reg) {
    return { compliant: false, pendingActions: [], overdueActions: [] };
  }

  const now = new Date();
  const pendingActions: string[] = [];
  const overdueActions: string[] = [];

  for (const obligation of reg.obligations) {
    if (obligation.entity !== entityType && obligation.entity !== "Tất cả tổ chức xử lý DLCN") {
      continue;
    }

    if (obligation.deadline) {
      const deadline = new Date(obligation.deadline);
      if (deadline > now) {
        pendingActions.push(`${obligation.requirement} (due: ${obligation.deadline})`);
      } else {
        overdueActions.push(`${obligation.requirement} (was due: ${obligation.deadline})`);
      }
    }
  }

  return {
    compliant: overdueActions.length === 0,
    pendingActions,
    overdueActions,
  };
}
