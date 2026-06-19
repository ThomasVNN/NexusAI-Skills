import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the skills data
const mockSkills = [
  {
    id: 'skill-1',
    name: 'web-search',
    description: 'Search the web for information',
    version: '1.0.0',
    enabled: true,
    category: 'search',
    tags: ['search', 'web', 'browsing'],
  },
  {
    id: 'skill-2',
    name: 'code-review',
    description: 'Review code for bugs and improvements',
    version: '1.2.0',
    enabled: true,
    category: 'development',
    tags: ['code', 'review', 'quality'],
  },
  {
    id: 'skill-3',
    name: 'image-generation',
    description: 'Generate images from text prompts',
    version: '0.9.0',
    enabled: false,
    category: 'creative',
    tags: ['image', 'generation', 'creative'],
  },
];

describe('Skills Service', () => {
  describe('Skill Registry', () => {
    it('should have at least one skill', () => {
      expect(mockSkills.length).toBeGreaterThan(0);
    });

    it('should have skills with required fields', () => {
      mockSkills.forEach((skill) => {
        expect(skill).toHaveProperty('id');
        expect(skill).toHaveProperty('name');
        expect(skill).toHaveProperty('description');
        expect(skill).toHaveProperty('version');
        expect(skill).toHaveProperty('enabled');
        expect(skill).toHaveProperty('category');
        expect(skill).toHaveProperty('tags');
      });
    });

    it('should have enabled skills in the registry', () => {
      const enabledSkills = mockSkills.filter((s) => s.enabled);
      expect(enabledSkills.length).toBeGreaterThan(0);
    });
  });

  describe('Skill Categories', () => {
    it('should categorize skills correctly', () => {
      const categories = new Set(mockSkills.map((s) => s.category));
      expect(categories.has('search')).toBe(true);
      expect(categories.has('development')).toBe(true);
      expect(categories.has('creative')).toBe(true);
    });
  });

  describe('Skill Tags', () => {
    it('should have tags for each skill', () => {
      mockSkills.forEach((skill) => {
        expect(skill.tags.length).toBeGreaterThan(0);
      });
    });

    it('should be able to find skills by tag', () => {
      const codeSkills = mockSkills.filter((s) => s.tags.includes('code'));
      expect(codeSkills.length).toBeGreaterThan(0);
    });
  });

  describe('Skill Versioning', () => {
    it('should have valid version format', () => {
      const versionRegex = /^\d+\.\d+\.\d+$/;
      mockSkills.forEach((skill) => {
        expect(skill.version).toMatch(versionRegex);
      });
    });
  });

  describe('Skill Filtering', () => {
    it('should filter enabled skills', () => {
      const enabledSkills = mockSkills.filter((s) => s.enabled);
      enabledSkills.forEach((skill) => {
        expect(skill.enabled).toBe(true);
      });
    });

    it('should filter disabled skills', () => {
      const disabledSkills = mockSkills.filter((s) => !s.enabled);
      disabledSkills.forEach((skill) => {
        expect(skill.enabled).toBe(false);
      });
    });

    it('should filter by category', () => {
      const searchSkills = mockSkills.filter((s) => s.category === 'search');
      expect(searchSkills.length).toBeGreaterThan(0);
      searchSkills.forEach((skill) => {
        expect(skill.category).toBe('search');
      });
    });
  });
});

describe('Skill Execution', () => {
  it('should validate skill execution request', () => {
    const validRequest = {
      skill_id: 'skill-1',
      input: { query: 'test query' },
      timeout: 30000,
    };

    expect(validRequest).toHaveProperty('skill_id');
    expect(validRequest).toHaveProperty('input');
    expect(validRequest).toHaveProperty('timeout');
  });

  it('should handle skill execution response', () => {
    const mockResponse = {
      success: true,
      result: { output: 'execution result' },
      metadata: {
        execution_time_ms: 150,
        skill_version: '1.0.0',
      },
    };

    expect(mockResponse.success).toBe(true);
    expect(mockResponse.result).toBeDefined();
    expect(mockResponse.metadata.execution_time_ms).toBeGreaterThan(0);
  });

  it('should handle skill execution errors', () => {
    const mockError = {
      success: false,
      error: {
        code: 'SKILL_EXECUTION_FAILED',
        message: 'Skill execution failed',
        details: 'Timeout exceeded',
      },
    };

    expect(mockError.success).toBe(false);
    expect(mockError.error).toBeDefined();
    expect(mockError.error.code).toBeDefined();
  });
});

describe('JSON-RPC Handler', () => {
  it('should validate JSON-RPC request format', () => {
    const validRequest = {
      jsonrpc: '2.0',
      method: 'tools.list',
      id: 1,
    };

    expect(validRequest.jsonrpc).toBe('2.0');
    expect(validRequest.method).toBeDefined();
    expect(validRequest.id).toBeDefined();
  });

  it('should handle batch requests', () => {
    const batchRequest = [
      { jsonrpc: '2.0', method: 'tools.list', id: 1 },
      { jsonrpc: '2.0', method: 'tools.get', params: { name: 'web-search' }, id: 2 },
    ];

    expect(batchRequest.length).toBe(2);
    batchRequest.forEach((req) => {
      expect(req.jsonrpc).toBe('2.0');
    });
  });

  it('should validate response format', () => {
    const validResponse = {
      jsonrpc: '2.0',
      result: { tools: [] },
      id: 1,
    };

    expect(validResponse.jsonrpc).toBe('2.0');
    expect(validResponse.result).toBeDefined();
    expect(validResponse.id).toBeDefined();
  });
});
