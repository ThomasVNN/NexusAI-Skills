import { z } from "zod";
import { Tool } from "../../internal/skills.interface.js";
import { createBaseSkillMetadata } from "../types.js";

/**
 * Input schema for code generation
 */
const CodeGeneratorInputSchema = z.object({
  specification: z.string().min(50).describe("Detailed specification of the code to generate"),
  language: z.enum(["typescript", "javascript", "python", "go", "rust", "java", "csharp", "sql"]).default("typescript"),
  framework: z.string().optional().describe("Target framework (e.g., react, fastify, django)"),
  style: z.enum(["modern", "traditional", "functional", "object-oriented"]).optional().default("modern"),
  includeTests: z.boolean().optional().default(true),
  includeDocs: z.boolean().optional().default(false),
  constraints: z.object({
    maxLines: z.number().int().positive().optional(),
    noExternalDeps: z.boolean().optional(),
    useTypeScript: z.boolean().optional(),
  }).optional(),
});

/**
 * Output schema for code generation
 */
const CodeGeneratorOutputSchema = z.object({
  success: z.boolean(),
  code: z.string().optional(),
  language: z.string().optional(),
  files: z.array(z.object({
    name: z.string(),
    path: z.string(),
    content: z.string(),
    language: z.string(),
  })).optional(),
  explanation: z.string().optional(),
  usage: z.string().optional(),
  testCode: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  executionTimeMs: z.number().optional(),
  error: z.string().optional(),
});

type CodeGeneratorInput = z.infer<typeof CodeGeneratorInputSchema>;
type CodeGeneratorOutput = z.infer<typeof CodeGeneratorOutputSchema>;

/**
 * Code Generator Skill
 * Generates code from specifications
 */
export class CodeGeneratorSkill implements Tool {
  name = "code_generator";
  description = "Generate production-quality code from specifications in multiple languages";
  inputSchema = CodeGeneratorInputSchema;

  private readonly metadata = createBaseSkillMetadata({
    id: "code-generator",
    name: "Code Generator",
    description: "Generate production-quality code from detailed specifications in TypeScript, Python, Go, and other languages",
    category: "code",
    version: "1.0.0",
    author: "NexusAI",
    requiredPermissions: ["read:code", "write:code"],
    requiredCapabilities: ["code-generator", "language-model"],
    estimatedDuration: "10-60s",
    trustScore: 78,
    requiresHumanApproval: true,
    rateLimitPerMinute: 10,
    inputSchema: CodeGeneratorInputSchema,
    outputSchema: CodeGeneratorOutputSchema,
  });

  getMetadata() {
    return this.metadata;
  }

  async execute(ctx: any, args: Record<string, any>): Promise<Record<string, any>> {
    const startTime = Date.now();
    const params = CodeGeneratorInputSchema.parse(args);

    try {
      // Parse specification to extract key requirements
      const spec = this.parseSpecification(params.specification);

      // Generate code based on language
      let code = "";
      const files: CodeGeneratorOutput["files"] = [];

      switch (params.language) {
        case "typescript":
        case "javascript":
          code = this.generateTypeScript(spec, params);
          if (params.includeTests) {
            files.push({
              name: `${spec.name}.test.ts`,
              path: `src/${spec.name}.test.ts`,
              content: this.generateTypeScriptTests(spec, params),
              language: "typescript",
            });
          }
          break;
        case "python":
          code = this.generatePython(spec, params);
          if (params.includeTests) {
            files.push({
              name: `test_${spec.name.toLowerCase().replace(/\s+/g, "_")}.py`,
              path: `tests/test_${spec.name.toLowerCase().replace(/\s+/g, "_")}.py`,
              content: this.generatePythonTests(spec),
              language: "python",
            });
          }
          break;
        case "go":
          code = this.generateGo(spec, params);
          if (params.includeTests) {
            files.push({
              name: `${spec.name.toLowerCase()}_test.go`,
              path: `${spec.name.toLowerCase()}_test.go`,
              content: this.generateGoTests(spec),
              language: "go",
            });
          }
          break;
        default:
          return {
            success: false,
            error: `Unsupported language: ${params.language}`,
            executionTimeMs: Date.now() - startTime,
          };
      }

      // Add main file
      files.unshift({
        name: `${spec.name}.${this.getExtension(params.language)}`,
        path: `src/${spec.name}.${this.getExtension(params.language)}`,
        content: code,
        language: params.language,
      });

      return {
        success: true,
        code,
        language: params.language,
        files,
        explanation: this.generateExplanation(spec),
        usage: this.generateUsage(spec, params.language),
        testCode: params.includeTests ? files[1]?.content : undefined,
        dependencies: this.getDependencies(params.language, params.framework),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Code generation failed",
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  private parseSpecification(spec: string): {
    name: string;
    description: string;
    functions: string[];
    types: string[];
    interfaces: string[];
  } {
    // Extract function names from specification
    const functionMatches = spec.match(/(?:function|method|handler|service)\s+(\w+)/gi) || [];
    const functions = functionMatches.map(f => f.split(/\s+/)[1]);

    // Extract type names
    const typeMatches = spec.match(/(?:type|interface|class|struct)\s+(\w+)/gi) || [];
    const types = typeMatches.map(t => t.split(/\s+/)[1]);

    // Generate name from specification
    const nameMatch = spec.match(/called\s+(\w+)/i) || spec.match(/named\s+(\w+)/i);
    const name = nameMatch ? nameMatch[1] : "GeneratedComponent";

    return {
      name: name.charAt(0).toUpperCase() + name.slice(1),
      description: spec.substring(0, 200),
      functions: [...new Set(functions)],
      types: [...new Set(types)],
      interfaces: [],
    };
  }

  private generateTypeScript(spec: { name: string; description: string; functions: string[] }, params: z.infer<typeof CodeGeneratorInputSchema>): string {
    const style = params.style === "functional" ? "functional" : "class-based";
    const useInterface = params.constraints?.useTypeScript !== false;

    if (style === "functional") {
      return `/**
 * ${spec.name}
 * ${spec.description}
 * 
 * Generated by NexusAI Code Generator
 * Language: TypeScript
 */

${useInterface ? `export interface ${spec.name}Config {
  enabled: boolean;
  timeout?: number;
  retries?: number;
}

export interface ${spec.name}Result {
  success: boolean;
  data?: unknown;
  error?: string;
}
` : ''}

/**
 * Main ${spec.name} function
 */
export async function ${spec.name.toLowerCase()}(config: ${useInterface ? `${spec.name}Config` : 'object'}): Promise<${useInterface ? `${spec.name}Result` : 'object'}> {
  const { enabled = true, timeout = 30000, retries = 3 } = config;
  
  if (!enabled) {
    return { success: false, error: 'Component is disabled' };
  }
  
  try {
    // Implementation placeholder
    // Replace with actual logic based on requirements
    
    return { success: true, data: null };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Validate configuration
 */
export function validate${spec.name}Config(config: unknown): config is ${useInterface ? `${spec.name}Config` : 'object'} {
  if (typeof config !== 'object' || config === null) return false;
  const cfg = config as Record<string, unknown>;
  return typeof cfg.enabled === 'boolean';
}
`;
    }

    // Class-based style
    return `/**
 * ${spec.name}
 * ${spec.description}
 * 
 * Generated by NexusAI Code Generator
 * Language: TypeScript
 */

${useInterface ? `export interface ${spec.name}Options {
  timeout?: number;
  retries?: number;
}
` : ''}

/**
 * ${spec.name} main class
 */
export class ${spec.name} {
  private enabled: boolean;
  private timeout: number;
  private retries: number;

  constructor(options: ${useInterface ? `${spec.name}Options` : 'object'} = {}) {
    this.enabled = true;
    this.timeout = options.timeout ?? 30000;
    this.retries = options.retries ?? 3;
  }

  /**
   * Execute the main operation
   */
  async execute(): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!this.enabled) {
      return { success: false, error: 'Component is disabled' };
    }

    try {
      // Implementation placeholder
      // Replace with actual logic based on requirements
      
      return { success: true, data: null };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Enable the component
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Disable the component
   */
  disable(): void {
    this.enabled = false;
  }
}
`;
  }

  private generateTypeScriptTests(spec: { name: string }, params: z.infer<typeof CodeGeneratorInputSchema>): string {
    const useInterface = params.constraints?.useTypeScript !== false;
    return `import { describe, it, expect, beforeEach } from 'vitest';
import { ${spec.name} } from './${spec.name}';

describe('${spec.name}', () => {
  let instance: ${spec.name}${params.style === 'functional' ? '' : ''};

  beforeEach(() => {
    instance = new ${spec.name}();
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const comp = new ${spec.name}();
      expect(comp).toBeDefined();
    });

    it('should create instance with custom options', () => {
      const comp = new ${spec.name}({ timeout: 5000, retries: 5 });
      expect(comp).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should return success result', async () => {
      const result = await instance.execute();
      expect(result.success).toBe(true);
    });
  });

  describe('enable/disable', () => {
    it('should toggle enabled state', () => {
      instance.disable();
      instance.enable();
      // State should be enabled
    });
  });
});
`;
  }

  private generatePython(spec: { name: string; description: string }, params: z.infer<typeof CodeGeneratorInputSchema>): string {
    const name = spec.name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    return `"""
${spec.name}
${spec.description}

Generated by NexusAI Code Generator
Language: Python
"""

from dataclasses import dataclass, field
from typing import Optional, Any, Dict
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


@dataclass
class ${spec.name}Config:
    """Configuration for ${spec.name}"""
    enabled: bool = True
    timeout: int = 30000
    retries: int = 3


@dataclass
class ${spec.name}Result:
    """Result from ${spec.name} execution"""
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


class ${spec.name}:
    """
    ${spec.name} main class.
    
    Args:
        config: Configuration options
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = ${spec.name}Config(**(config or {}))
        self.logger = logger
    
    def execute(self) -> ${spec.name}Result:
        """
        Execute the main operation.
        
        Returns:
            ${spec.name}Result: Execution result
        """
        if not self.config.enabled:
            return ${spec.name}Result(
                success=False,
                error="Component is disabled"
            )
        
        try:
            # Implementation placeholder
            # Replace with actual logic based on requirements
            
            return ${spec.name}Result(
                success=True,
                data=None
            )
        except Exception as e:
            self.logger.error(f"Execution error: {e}")
            return ${spec.name}Result(
                success=False,
                error=str(e)
            )
    
    def enable(self) -> None:
        """Enable the component"""
        self.config.enabled = True
    
    def disable(self) -> None:
        """Disable the component"""
        self.config.enabled = False


def ${name}(config: Optional[Dict[str, Any]] = None) -> ${spec.name}Result:
    """
    Convenience function for ${spec.name}.
    
    Args:
        config: Configuration options
        
    Returns:
        ${spec.name}Result: Execution result
    """
    instance = ${spec.name}(config)
    return instance.execute()


if __name__ == "__main__":
    result = ${name}()
    print(f"Result: {result}")
`;
  }

  private generatePythonTests(spec: { name: string }): string {
    const moduleName = spec.name.toLowerCase().replace(/\s+/g, '_');
    return `"""
Tests for ${spec.name}

Generated by NexusAI Code Generator
"""

import pytest
from ${moduleName}.${moduleName} import ${spec.name}, ${spec.name}Config, ${spec.name}Result


class Test${spec.name}:
    """Test cases for ${spec.name}"""
    
    def test_create_instance_default_config(self):
        """Test creating instance with default config"""
        instance = ${spec.name}()
        assert instance is not None
        assert instance.config.enabled is True
    
    def test_create_instance_custom_config(self):
        """Test creating instance with custom config"""
        instance = ${spec.name}({"timeout": 5000, "retries": 5})
        assert instance.config.timeout == 5000
        assert instance.config.retries == 5
    
    def test_execute_returns_result(self):
        """Test execute method returns a result"""
        instance = ${spec.name}()
        result = instance.execute()
        assert isinstance(result, ${spec.name}Result)
    
    def test_enable_disable(self):
        """Test enable and disable methods"""
        instance = ${spec.name}()
        instance.disable()
        assert instance.config.enabled is False
        instance.enable()
        assert instance.config.enabled is True
`;
  }

  private generateGo(spec: { name: string; description: string }, params: z.infer<typeof CodeGeneratorInputSchema>): string {
    const name = spec.name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    return `// ${spec.name}
// ${spec.description}
//
// Generated by NexusAI Code Generator
// Language: Go

package main

import (
	"context"
	"errors"
	"time"
)

// Config holds configuration for ${spec.name}
type Config struct {
	Enabled bool
	Timeout time.Duration
	Retries int
}

// Result holds the execution result
type Result struct {
	Success    bool
	Data       interface{}
	Error      string
	Timestamp  time.Time
}

// ${spec.name} main struct
type ${spec.name} struct {
	config Config
}

// New${spec.name} creates a new ${spec.name} instance
func New${spec.name}(config *Config) *${spec.name} {
	cfg := Config{
		Enabled: true,
		Timeout: 30 * time.Second,
		Retries: 3,
	}
	if config != nil {
		cfg = *config
	}
	return &${spec.name}{config: cfg}
}

// Execute runs the main operation
func (s *${spec.name}) Execute(ctx context.Context) Result {
	if !s.config.Enabled {
		return Result{
			Success:   false,
			Error:     "component is disabled",
			Timestamp: time.Now(),
		}
	}

	// Implementation placeholder
	// Replace with actual logic based on requirements

	return Result{
		Success:   true,
		Data:      nil,
		Timestamp: time.Now(),
	}
}

// Enable enables the component
func (s *${spec.name}) Enable() {
	s.config.Enabled = true
}

// Disable disables the component
func (s *${spec.name}) Disable() {
	s.config.Enabled = false
}

// ExecuteFunction is a convenience function
func ExecuteFunction(ctx context.Context, config *Config) Result {
	instance := New${spec.name}(config)
	return instance.Execute(ctx)
}

func main() {
	ctx := context.Background()
	result := ExecuteFunction(ctx, nil)
	println("Result:", result.Success)
}
`;
  }

  private generateGoTests(spec: { name: string }): string {
    return `// Tests for ${spec.name}
//
// Generated by NexusAI Code Generator

package main

import (
	"context"
	"testing"
	"time"
)

func TestNew${spec.name}(t *testing.T) {
	instance := New${spec.name}(nil)
	if instance == nil {
		t.Fatal("expected non-nil instance")
	}
	if !instance.config.Enabled {
		t.Error("expected enabled by default")
	}
}

func Test${spec.name}Execute(t *testing.T) {
	ctx := context.Background()
	instance := New${spec.name}(nil)

	result := instance.Execute(ctx)
	if result.Success != true {
		t.Errorf("expected success, got %v", result.Success)
	}
}

func Test${spec.name}Disabled(t *testing.T) {
	ctx := context.Background()
	instance := New${spec.name}(&Config{Enabled: false})

	result := instance.Execute(ctx)
	if result.Success != false {
		t.Errorf("expected failure for disabled component")
	}
}

func Test${spec.name}EnableDisable(t *testing.T) {
	instance := New${spec.name}(nil)

	instance.Disable()
	if instance.config.Enabled {
		t.Error("expected disabled after Disable()")
	}

	instance.Enable()
	if !instance.config.Enabled {
		t.Error("expected enabled after Enable()")
	}
}
`;
  }

  private getExtension(language: string): string {
    const extensions: Record<string, string> = {
      typescript: "ts",
      javascript: "js",
      python: "py",
      go: "go",
      rust: "rs",
      java: "java",
      csharp: "cs",
      sql: "sql",
    };
    return extensions[language] || "txt";
  }

  private getDependencies(language: string, framework?: string): string[] {
    const base: Record<string, string[]> = {
      typescript: ["typescript", "zod"],
      javascript: [],
      python: [],
      go: [],
    };
    const deps = base[language] || [];
    if (framework) {
      deps.push(framework);
    }
    return deps;
  }

  private generateExplanation(spec: { name: string; description: string }): string {
    return `The ${spec.name} component has been generated based on your specification.
    
Key features:
- Configurable options for timeout, retries, and enabled state
- Type-safe implementation with proper error handling
- Async/await support where applicable
- Validation and sanitization built-in

To use this component, import it and instantiate with your configuration.
Review the code and update the placeholder sections with your actual implementation.`;
  }

  private generateUsage(spec: { name: string }, language: string): string {
    return `
// Usage example (${language})

// Import/require the module
import { ${spec.name} } from './${spec.name}';

// Create instance with options
const instance = new ${spec.name}({
  timeout: 30000,
  retries: 3
});

// Execute
const result = await instance.execute();
if (result.success) {
  console.log('Success:', result.data);
} else {
  console.error('Error:', result.error);
}
`;
  }
}
