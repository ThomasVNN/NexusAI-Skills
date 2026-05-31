import type { Skill, ExecutionRecord, SkillAnalytics, ExecutionStats, ApprovalRequest, SkillConfig } from './types';
import { 
  mockSkills, 
  mockExecutions, 
  mockStats, 
  mockAnalytics, 
  mockApprovals,
  mockTimeSeriesData,
  categoryDistribution,
  durationData 
} from './mock-data';

const API_BASE = '/api';
const USE_MOCK = true; // Toggle for development

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  if (USE_MOCK) {
    return getMockData<T>(url);
  }
  
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Mock data fallback
function getMockData<T>(url: string): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (url.includes('/skills') && !url.includes('/executions') && !url.includes('/approvals') && !url.includes('/stats') && !url.includes('/analytics')) {
        if (url.includes('/skills?')) {
          const category = new URLSearchParams(url.split('?')[1]).get('category');
          if (category && category !== 'all') {
            resolve(mockSkills.filter(s => s.category === category) as T);
          } else {
            resolve(mockSkills as T);
          }
        } else if (url.match(/\/skills\/[\w-]+$/)) {
          const id = url.split('/').pop();
          resolve(mockSkills.find(s => s.id === id) as T);
        } else {
          resolve(mockSkills as T);
        }
      } else if (url.includes('/executions')) {
        resolve(mockExecutions as T);
      } else if (url.includes('/approvals/pending')) {
        resolve(mockApprovals as T);
      } else if (url.includes('/stats')) {
        resolve(mockStats as T);
      } else if (url.includes('/analytics')) {
        resolve(mockAnalytics as T);
      } else {
        resolve([] as T);
      }
    }, 300); // Simulate network delay
  });
}

// Skills API
export async function getSkills(category?: string): Promise<Skill[]> {
  const url = category ? `/skills?category=${category}` : '/skills';
  return fetchJSON<Skill[]>(url);
}

export async function getSkill(id: string): Promise<Skill> {
  return fetchJSON<Skill>(`/skills/${id}`);
}

export async function updateSkillConfig(id: string, config: Partial<SkillConfig>): Promise<Skill> {
  return fetchJSON<Skill>(`/skills/${id}/config`, {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

export async function enableSkill(id: string): Promise<void> {
  await fetchJSON(`/skills/${id}/enable`, { method: 'POST' });
}

export async function disableSkill(id: string): Promise<void> {
  await fetchJSON(`/skills/${id}/disable`, { method: 'POST' });
}

// Executions API
export async function getExecutions(options?: {
  skillId?: string;
  state?: string;
  limit?: number;
  offset?: number;
}): Promise<ExecutionRecord[]> {
  const params = new URLSearchParams();
  if (options?.skillId) params.set('skillId', options.skillId);
  if (options?.state) params.set('state', options.state);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  
  const query = params.toString();
  return fetchJSON<ExecutionRecord[]>(`/skills/executions${query ? `?${query}` : ''}`);
}

export async function getExecution(id: string): Promise<ExecutionRecord> {
  return fetchJSON<ExecutionRecord>(`/skills/executions/${id}`);
}

export async function executeSkill(
  skillId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<ExecutionRecord> {
  return fetchJSON<ExecutionRecord>(`/skills/${skillId}/execute`, {
    method: 'POST',
    body: JSON.stringify({ toolName, args }),
  });
}

export async function cancelExecution(id: string): Promise<void> {
  await fetchJSON(`/skills/executions/${id}/cancel`, { method: 'POST' });
}

export async function retryExecution(id: string): Promise<ExecutionRecord> {
  return fetchJSON<ExecutionRecord>(`/skills/executions/${id}/retry`, { method: 'POST' });
}

// Approval API
export async function getPendingApprovals(): Promise<ApprovalRequest[]> {
  return fetchJSON<ApprovalRequest[]>('/skills/approvals/pending');
}

export async function approveExecution(
  executionId: string,
  reason?: string
): Promise<void> {
  await fetchJSON(`/skills/executions/${executionId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function rejectExecution(
  executionId: string,
  reason: string
): Promise<void> {
  await fetchJSON(`/skills/executions/${executionId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// Analytics API
export async function getAnalytics(skillId?: string): Promise<SkillAnalytics[]> {
  const url = skillId ? `/skills/analytics?skillId=${skillId}` : '/skills/analytics';
  return fetchJSON<SkillAnalytics[]>(url);
}

export async function getExecutionStats(): Promise<ExecutionStats> {
  return fetchJSON<ExecutionStats>('/skills/stats');
}

export async function getTimeSeriesData() {
  return mockTimeSeriesData;
}

export async function getCategoryDistribution() {
  return categoryDistribution;
}

export async function getDurationData() {
  return durationData;
}

// Health API
export async function getHealth(): Promise<{ status: string; service: string }> {
  return fetchJSON<{ status: string; service: string }>('/health');
}
