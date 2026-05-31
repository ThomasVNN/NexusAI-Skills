import { z } from "zod";
import { Tool } from "../../internal/skills.interface.js";
import { createBaseSkillMetadata } from "../types.js";

/**
 * Input schema for legal search
 */
const LegalSearchInputSchema = z.object({
  query: z.string().min(2).describe("Search query for Vietnamese legal documents"),
  domain: z.enum(["banking", "it", "tax", "labor", "investment", "general"]).optional().default("general"),
  documentTypes: z.array(z.enum(["decree", "decision", "circular", "law", "resolution", "order"])).optional(),
  dateRange: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }).optional(),
  status: z.enum(["active", "expired", "amended", "all"]).optional().default("active"),
  limit: z.number().int().positive().optional().default(20),
  offset: z.number().int().nonnegative().optional().default(0),
});

/**
 * Output schema for legal search results
 */
const LegalSearchOutputSchema = z.object({
  success: z.boolean(),
  results: z.array(z.object({
    id: z.string(),
    title: z.string(),
    type: z.string(),
    code: z.string().optional(),
    number: z.string().optional(),
    issuer: z.string().optional(),
    issuedDate: z.string().optional(),
    effectiveDate: z.string().optional(),
    expirationDate: z.string().optional(),
    status: z.string(),
    relevanceScore: z.number(),
    summary: z.string().optional(),
    url: z.string().optional(),
  })).optional(),
  total: z.number().optional(),
  pagination: z.object({
    limit: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
  }).optional(),
  executionTimeMs: z.number().optional(),
  error: z.string().optional(),
});

type LegalSearchInput = z.infer<typeof LegalSearchInputSchema>;
type LegalSearchOutput = z.infer<typeof LegalSearchOutputSchema>;

/**
 * Legal Document Reference
 */
interface LegalDocument {
  id: string;
  title: string;
  type: string;
  code?: string;
  number?: string;
  issuer: string;
  issuedDate: string;
  effectiveDate: string;
  expirationDate?: string;
  status: "active" | "expired" | "amended";
  keywords: string[];
  content?: string;
  relevanceScore?: number;
}

/**
 * Vietnamese Legal Database Mock
 */
const LEGAL_DATABASE: LegalDocument[] = [
  {
    id: "nd-13-2024-nd-cp",
    title: "Nghị định về quản lý hoạt động ngân hàng",
    type: "decree",
    code: "13",
    number: "13/2024/NĐ-CP",
    issuer: "Chính phủ",
    issuedDate: "2024-03-15",
    effectiveDate: "2024-05-01",
    status: "active",
    keywords: ["ngân hàng", "tín dụng", "thanh toán", " Fintech"],
  },
  {
    id: "tt-50-2024-tt-nhnn",
    title: "Thông tư quy định về hoạt động thanh toán",
    type: "circular",
    code: "50",
    number: "50/2024/TT-NHNN",
    issuer: "Ngân hàng Nhà nước",
    issuedDate: "2024-06-20",
    effectiveDate: "2024-08-01",
    status: "active",
    keywords: ["thanh toán", " ví điện tử", " mobile banking"],
  },
  {
    id: "luat-an-toan-thong-tin-2015",
    title: "Luật An toàn thông tin mạng",
    type: "law",
    number: "86/2015/QH13",
    issuer: "Quốc hội",
    issuedDate: "2015-11-19",
    effectiveDate: "2016-07-01",
    status: "active",
    keywords: ["an toàn thông tin", "网络安全", "bảo mật dữ liệu", "cybersecurity"],
  },
  {
    id: "nd-13-2023-nd-cp",
    title: "Nghị định về bảo vệ dữ liệu cá nhân",
    type: "decree",
    code: "13",
    number: "13/2023/NĐ-CP",
    issuer: "Chính phủ",
    issuedDate: "2023-04-17",
    effectiveDate: "2023-07-01",
    status: "active",
    keywords: ["dữ liệu cá nhân", "bảo vệ", "privacy", "GDPR"],
  },
  {
    id: "qd-222-qd-ttg",
    title: "Quyết định phê duyệt Chiến lược chuyển đổi số",
    type: "decision",
    number: "222/QĐ-TTg",
    issuer: "Thủ tướng Chính phủ",
    issuedDate: "2022-03-31",
    effectiveDate: "2022-03-31",
    status: "active",
    keywords: ["chuyển đổi số", "số hóa", "digital transformation"],
  },
  {
    id: "tt-20-2023-tt-bkhcn",
    title: "Thông tư về hạ tầng thông tin quốc gia",
    type: "circular",
    code: "20",
    number: "20/2023/TT-BKHCN",
    issuer: "Bộ Khoa học và Công nghệ",
    issuedDate: "2023-12-01",
    effectiveDate: "2024-02-01",
    status: "active",
    keywords: ["hạ tầng thông tin", "quốc gia", "data center"],
  },
];

/**
 * Legal Search Skill
 * Searches Vietnamese law databases for relevant legal documents
 */
export class LegalSearchSkill implements Tool {
  name = "legal_search";
  description = "Search Vietnamese legal databases by topic, domain, and document type";
  inputSchema = LegalSearchInputSchema;

  private readonly metadata = createBaseSkillMetadata({
    id: "legal-search",
    name: "Vietnam Legal Search Engine",
    description: "Search Vietnamese law databases for banking, IT, tax, labor, and investment regulations",
    category: "legal",
    version: "1.0.0",
    author: "NexusAI",
    requiredPermissions: ["read:knowledge", "read:legal-db"],
    requiredCapabilities: ["legal-search-engine", "document-retriever"],
    estimatedDuration: "5-20s",
    trustScore: 95,
    requiresHumanApproval: false,
    rateLimitPerMinute: 40,
    inputSchema: LegalSearchInputSchema,
    outputSchema: LegalSearchOutputSchema,
  });

  getMetadata() {
    return this.metadata;
  }

  async execute(ctx: any, args: Record<string, any>): Promise<Record<string, any>> {
    const startTime = Date.now();
    const params = LegalSearchInputSchema.parse(args);

    try {
      // Filter documents based on criteria
      let results = LEGAL_DATABASE.filter(doc => {
        // Status filter
        if (params.status !== "all" && doc.status !== params.status) {
          return false;
        }

        // Document type filter
        if (params.documentTypes?.length && !params.documentTypes.includes(doc.type as any)) {
          return false;
        }

        // Date range filter
        if (params.dateRange?.from) {
          const fromDate = new Date(params.dateRange.from);
          const issuedDate = new Date(doc.issuedDate);
          if (issuedDate < fromDate) return false;
        }
        if (params.dateRange?.to) {
          const toDate = new Date(params.dateRange.to);
          const issuedDate = new Date(doc.issuedDate);
          if (issuedDate > toDate) return false;
        }

        // Text search
        const queryLower = params.query.toLowerCase();
        const searchFields = [
          doc.title.toLowerCase(),
          doc.keywords.join(" ").toLowerCase(),
          doc.type.toLowerCase(),
          doc.number?.toLowerCase() || "",
        ];
        
        const matchesQuery = searchFields.some(field => field.includes(queryLower));
        if (!matchesQuery) return false;

        return true;
      });

      // Calculate relevance scores
      results = results.map(doc => ({
        ...doc,
        relevanceScore: this.calculateRelevance(doc, params.query),
      }));

      // Sort by relevance
      results.sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Apply pagination
      const total = results.length;
      const paginatedResults = results.slice(params.offset, params.offset + params.limit);

      return {
        success: true,
        results: paginatedResults.map(doc => ({
          id: doc.id,
          title: doc.title,
          type: doc.type,
          code: doc.code,
          number: doc.number,
          issuer: doc.issuer,
          issuedDate: doc.issuedDate,
          effectiveDate: doc.effectiveDate,
          expirationDate: doc.expirationDate,
          status: doc.status,
          relevanceScore: doc.relevanceScore,
          summary: this.generateSummary(doc),
          url: `https://vbpl.vn/${doc.type}s/${doc.id}`,
        })),
        total,
        pagination: {
          limit: params.limit,
          offset: params.offset,
          hasMore: params.offset + params.limit < total,
        },
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Legal search failed",
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  private calculateRelevance(doc: LegalDocument, query: string): number {
    let score = 0;
    const queryLower = query.toLowerCase();

    // Title match (highest weight)
    if (doc.title.toLowerCase().includes(queryLower)) {
      score += 0.5;
      if (doc.title.toLowerCase().startsWith(queryLower)) {
        score += 0.2;
      }
    }

    // Keyword match
    const keywordMatches = doc.keywords.filter(k => k.toLowerCase().includes(queryLower)).length;
    score += keywordMatches * 0.1;

    // Number match
    if (doc.number?.toLowerCase().includes(queryLower)) {
      score += 0.3;
    }

    // Normalize to 0-1 range
    return Math.min(1, score);
  }

  private generateSummary(doc: LegalDocument): string {
    return `${doc.type.charAt(0).toUpperCase() + doc.type.slice(1)} ${doc.number || ""} (${doc.issuedDate}) - ${doc.issuer}. Status: ${doc.status}`;
  }
}

/**
 * Find related documents
 */
export function findRelatedDocuments(docId: string): LegalDocument[] {
  const doc = LEGAL_DATABASE.find(d => d.id === docId);
  if (!doc) return [];

  return LEGAL_DATABASE.filter(d => 
    d.id !== docId &&
    (d.type === doc.type || d.keywords.some(k => doc.keywords.includes(k)))
  );
}
