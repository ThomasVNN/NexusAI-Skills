import { z } from "zod";
import { Tool } from "../../internal/skills.interface.js";
import { createBaseSkillMetadata } from "../types.js";

/**
 * Input schema for legal citation extraction
 */
const LegalCitationInputSchema = z.object({
  text: z.string().min(1).describe("Text content containing legal citations"),
  domain: z.enum(["banking", "it", "tax", "labor", "investment", "general"]).optional().default("general"),
  includeContext: z.boolean().optional().default(true).describe("Include surrounding context for each citation"),
  strict: z.boolean().optional().default(false).describe("Use strict validation for Vietnamese legal format"),
});

/**
 * Output schema for citation extraction
 */
const LegalCitationOutputSchema = z.object({
  success: z.boolean(),
  citations: z.array(z.object({
    text: z.string(),
    type: z.enum(["decree", "decision", "circular", "law", "resolution", "order", "unknown"]),
    code: z.string().optional(),
    number: z.string().optional(),
    year: z.string().optional(),
    issuer: z.string().optional(),
    effectiveDate: z.string().optional(),
    section: z.string().optional(),
    confidence: z.number().min(0).max(1),
  })).optional(),
  totalFound: z.number().optional(),
  executionTimeMs: z.number().optional(),
  error: z.string().optional(),
});

type LegalCitationInput = z.infer<typeof LegalCitationInputSchema>;
type LegalCitationOutput = z.infer<typeof LegalCitationOutputSchema>;

/**
 * Vietnamese Legal Citation Pattern
 */
interface LegalCitation {
  text: string;
  type: "decree" | "decision" | "circular" | "law" | "resolution" | "order" | "unknown";
  code?: string;
  number?: string;
  year?: string;
  issuer?: string;
  effectiveDate?: string;
  section?: string;
  confidence: number;
}

/**
 * Legal Citation Skill
 * Extracts and validates Vietnamese legal citations from text
 */
export class LegalCitationSkill implements Tool {
  name = "legal_citation";
  description = "Extract and validate Vietnamese legal citations with hierarchical relationship resolution";
  inputSchema = LegalCitationInputSchema;

  private readonly metadata = createBaseSkillMetadata({
    id: "legal-citation",
    name: "Vietnam Legal Citation Matcher",
    description: "Extracts and visualizes legal citation paths for Vietnamese banking, IT, tax, labor, and investment domains",
    category: "legal",
    version: "1.0.0",
    author: "NexusAI",
    requiredPermissions: ["read:knowledge", "write:citations"],
    requiredCapabilities: ["legal-text-parser", "citation-resolver"],
    estimatedDuration: "3-15s",
    trustScore: 98,
    requiresHumanApproval: false,
    rateLimitPerMinute: 50,
    inputSchema: LegalCitationInputSchema,
    outputSchema: LegalCitationOutputSchema,
  });

  // Vietnamese legal document patterns
  private readonly patterns = {
    // Nghị định (Decree): Nghị định số X/Y/ZNĐ-CP
    decree: /Nghị\s+định\s+(?:số\s+)?(\d+)\/(\d+)\/NĐ-CP/gi,
    
    // Quyết định (Decision): Quyết định số X/Y/ZQĐ-TTg
    decision: /Quyết\s+định\s+(?:số\s+)?(\d+)\/(\d+)\/QĐ-TTg/gi,
    
    // Thông tư (Circular): Thông tư số X/Y/ZTT-BKHCN
    circular: /Thông\s+tư\s+(?:số\s+)?(\d+)\/(\d+)\/TT-[A-Z]+/gi,
    
    // Luật (Law): Luật số X/Y
    law: /Luật\s+(?:số\s+)?(\d+)\/(\d{4})\/QH(\d{2})/gi,
    
    // Nghị quyết (Resolution): Nghị quyết số X/Y/ZNQ-CP
    resolution: /Nghị\s+quyết\s+(?:số\s+)?(\d+)\/(\d+)\/NQ-CP/gi,
    
    // QĐ (Order): QĐ số X/Y/Z
    order: /QĐ\s+(?:số\s+)?(\d+)\/(\d+)\/QD-([A-Z]+)/gi,
  };

  // Domain-specific keyword mappings
  private readonly domainKeywords: Record<string, string[]> = {
    banking: ["ngân hàng", "tín dụng", "thanh toán", "bảo hiểm", "tài chính"],
    it: ["công nghệ", "thông tin", "an toàn", "cybersecurity", "dữ liệu", "internet"],
    tax: ["thuế", "kê khai", "hoàn thuế", "hải quan"],
    labor: ["lao động", "việc làm", "bảo hiểm xã hội", "tiền lương"],
    investment: ["đầu tư", "doanh nghiệp", "chứng khoán", "vốn"],
  };

  getMetadata() {
    return this.metadata;
  }

  async execute(ctx: any, args: Record<string, any>): Promise<Record<string, any>> {
    const startTime = Date.now();
    const params = LegalCitationInputSchema.parse(args);

    try {
      const citations: LegalCitation[] = [];

      // Extract citations using all patterns
      for (const [type, pattern] of Object.entries(this.patterns)) {
        let match;
        while ((match = pattern.exec(params.text)) !== null) {
          const citation = this.parseCitation(match, type, params.strict);
          
          // Filter by domain if specified
          if (params.domain !== "general") {
            const domainTerms = this.domainKeywords[params.domain] || [];
            const textLower = params.text.toLowerCase();
            const hasDomainContext = domainTerms.some(term => textLower.includes(term));
            
            if (!hasDomainContext) {
              citation.confidence *= 0.7; // Reduce confidence if no domain context
            }
          }
          
          citations.push(citation);
        }
      }

      // Extract section references (Articles, Clauses)
      const sectionRefs = this.extractSectionReferences(params.text);
      citations.push(...sectionRefs);

      // Remove duplicates based on text
      const uniqueCitations = this.deduplicateCitations(citations);

      return {
        success: true,
        citations: params.includeContext
          ? uniqueCitations.map(c => ({
              ...c,
              context: this.getContextAroundCitation(params.text, c.text),
            }))
          : uniqueCitations,
        totalFound: uniqueCitations.length,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Citation extraction failed",
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  private parseCitation(match: RegExpExecArray, type: string, strict: boolean): LegalCitation {
    const fullText = match[0];
    const citation: LegalCitation = {
      text: fullText,
      type: type as LegalCitation["type"],
      confidence: 0.9,
    };

    // Parse components based on type
    if (match.length > 1) {
      citation.number = match[1];
    }
    if (match.length > 2) {
      citation.code = match[2];
    }

    // Extract year
    const yearMatch = fullText.match(/20\d{2}/);
    if (yearMatch) {
      citation.year = yearMatch[0];
    }

    // Determine issuer based on type
    const issuers: Record<string, string> = {
      decree: "Chính phủ",
      decision: "Thủ tướng Chính phủ",
      circular: "Bộ ngành",
      law: "Quốc hội",
      resolution: "Chính phủ",
      order: "Cơ quan nhà nước",
    };
    citation.issuer = issuers[type] || "Nhà nước Việt Nam";

    // Adjust confidence based on strict mode
    if (strict && !this.validateCitationFormat(fullText, type)) {
      citation.confidence *= 0.5;
    }

    return citation;
  }

  private extractSectionReferences(text: string): LegalCitation[] {
    const sections: LegalCitation[] = [];
    
    // Article patterns: Điều X, Article X, Clause X
    const articlePattern = /(?:Điều|Article|Clause|Điều\s*\d+\s*[.,]\s*[\dA-Za-z]+)/gi;
    let match;
    
    while ((match = articlePattern.exec(text)) !== null) {
      sections.push({
        text: match[0],
        type: "unknown",
        section: match[0],
        confidence: 0.8,
      });
    }
    
    return sections;
  }

  private validateCitationFormat(text: string, type: string): boolean {
    // Strict validation for Vietnamese legal documents
    const validations: Record<string, RegExp> = {
      decree: /Nghị\s+định\s+\d+\/\d+\/NĐ-CP/,
      decision: /Quyết\s+định\s+\d+\/\d+\/QĐ-TTg/,
      circular: /Thông\s+tư\s+\d+\/\d+\/TT-[A-Z]+/,
      law: /Luật\s+\d+\/\d{4}\/QH\d{2}/,
    };
    
    const pattern = validations[type];
    return pattern ? pattern.test(text) : true;
  }

  private getContextAroundCitation(text: string, citation: string, radius: number = 50): string {
    const index = text.indexOf(citation);
    if (index === -1) return "";
    
    const start = Math.max(0, index - radius);
    const end = Math.min(text.length, index + citation.length + radius);
    
    let context = text.substring(start, end);
    if (start > 0) context = "..." + context;
    if (end < text.length) context = context + "...";
    
    return context.trim();
  }

  private deduplicateCitations(citations: LegalCitation[]): LegalCitation[] {
    const seen = new Map<string, LegalCitation>();
    
    for (const citation of citations) {
      const key = citation.text.toLowerCase().trim();
      const existing = seen.get(key);
      
      if (!existing || citation.confidence > existing.confidence) {
        seen.set(key, citation);
      }
    }
    
    return Array.from(seen.values()).sort((a, b) => b.confidence - a.confidence);
  }
}

/**
 * Resolve citation hierarchy (which law/decree is referenced by another)
 */
export function resolveCitationHierarchy(citations: LegalCitation[]): Map<string, string[]> {
  const hierarchy = new Map<string, string[]>();
  
  // Build parent-child relationships
  for (const citation of citations) {
    if (citation.type === "law") {
      hierarchy.set(citation.text, []);
    } else if (citation.type === "decree") {
      // Decrees typically implement Laws
      const parent = citations.find(c => 
        c.type === "law" && c.year === citation.year
      );
      if (parent) {
        const children = hierarchy.get(parent.text) || [];
        children.push(citation.text);
        hierarchy.set(parent.text, children);
      }
    }
  }
  
  return hierarchy;
}
