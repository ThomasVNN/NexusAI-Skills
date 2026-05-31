import React, { useState } from 'react';
import type { Skill } from '../api/types';

interface SkillDetailProps {
  skill: Skill;
  onClose: () => void;
  onToggleEnabled?: (enabled: boolean) => void;
  onExecute?: () => void;
}

export function SkillDetail({ skill, onClose, onToggleEnabled, onExecute }: SkillDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'permissions' | 'schemas' | 'analytics'>('overview');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-border-subtle">
        {/* Header */}
        <div className="p-6 border-b border-border-subtle">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                skill.category === 'data' ? 'bg-cat-data/20' :
                skill.category === 'legal' ? 'bg-cat-legal/20' :
                skill.category === 'code' ? 'bg-cat-code/20' :
                'bg-cat-general/20'
              }`}>
                <CategoryIcon category={skill.category} className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-2xl font-bold text-text-primary">{skill.name}</h2>
                  <StatusBadge status={skill.status} />
                </div>
                <p className="text-text-secondary">{skill.description}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-bg-elevated rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border-subtle px-6">
          {(['overview', 'permissions', 'schemas', 'analytics'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium capitalize transition-colors relative ${
                activeTab === tab
                  ? 'text-accent-primary'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-280px)]">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Info Grid */}
              <div className="grid grid-cols-3 gap-4">
                <InfoCard label="Category" value={skill.category} icon="category" />
                <InfoCard label="Version" value={`v${skill.version}`} icon="version" />
                <InfoCard label="Author" value={skill.author} icon="author" />
                <InfoCard label="Duration" value={skill.estimatedDuration} icon="duration" />
                <InfoCard label="Trust Score" value={`${skill.trustScore}%`} icon="trust" />
                <InfoCard label="Rate Limit" value={`${skill.rateLimitPerMinute}/min`} icon="rate" />
              </div>

              {/* Trust Score Progress */}
              <div className="card">
                <h4 className="text-sm font-medium text-text-tertiary mb-3">Trust Score</h4>
                <div className="flex items-center gap-4">
                  <div className="flex-1 progress-bar h-3">
                    <div
                      className={`progress-bar-fill ${skill.trustScore >= 90 ? 'bg-success' : skill.trustScore >= 70 ? 'bg-warning' : 'bg-error'}`}
                      style={{ width: `${skill.trustScore}%` }}
                    />
                  </div>
                  <span className="text-lg font-bold text-text-primary w-16 text-right">{skill.trustScore}%</span>
                </div>
              </div>

              {/* Actions */}
              <div className="card">
                <h4 className="text-sm font-medium text-text-tertiary mb-3">Actions</h4>
                <div className="flex gap-3">
                  {skill.status === 'approved' ? (
                    <button
                      onClick={() => onToggleEnabled?.(false)}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      Disable Skill
                    </button>
                  ) : skill.status === 'disabled' ? (
                    <button
                      onClick={() => onToggleEnabled?.(true)}
                      className="btn-success flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Enable Skill
                    </button>
                  ) : null}
                  
                  {skill.status === 'approved' && !skill.requiresHumanApproval && (
                    <button onClick={onExecute} className="btn-primary flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      </svg>
                      Execute Skill
                    </button>
                  )}
                  
                  {skill.requiresHumanApproval && (
                    <span className="badge-warning self-center px-3 py-2">
                      Requires Human Approval
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-medium text-text-tertiary mb-3">Required Permissions</h4>
                <div className="flex flex-wrap gap-2">
                  {skill.permissions.map((perm) => (
                    <span key={perm} className="px-3 py-1.5 rounded-lg bg-bg-secondary border border-border-subtle text-text-secondary text-sm font-mono">
                      {perm}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-text-tertiary mb-3">Required Capabilities</h4>
                <div className="flex flex-wrap gap-2">
                  {skill.requiredCapabilities.map((cap) => (
                    <span key={cap} className="px-3 py-1.5 rounded-lg bg-accent-primary/10 border border-accent-primary/20 text-accent-secondary text-sm">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'schemas' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-medium text-text-tertiary mb-3">Input Schema</h4>
                <div className="bg-bg-primary rounded-lg p-4 border border-border-subtle">
                  <pre className="text-sm text-text-secondary font-mono overflow-x-auto">
                    {skill.inputSchema ? JSON.stringify(skill.inputSchema, null, 2) : '{ }'}
                  </pre>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-text-tertiary mb-3">Output Schema</h4>
                <div className="bg-bg-primary rounded-lg p-4 border border-border-subtle">
                  <pre className="text-sm text-text-secondary font-mono overflow-x-auto">
                    {skill.outputSchema ? JSON.stringify(skill.outputSchema, null, 2) : '{ }'}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="card text-center">
                  <div className="text-3xl font-bold text-text-primary mb-1">0</div>
                  <div className="text-sm text-text-tertiary">Total Executions</div>
                </div>
                <div className="card text-center">
                  <div className="text-3xl font-bold text-success mb-1">0%</div>
                  <div className="text-sm text-text-tertiary">Success Rate</div>
                </div>
                <div className="card text-center">
                  <div className="text-3xl font-bold text-text-primary mb-1">0ms</div>
                  <div className="text-sm text-text-tertiary">Avg Duration</div>
                </div>
                <div className="card text-center">
                  <div className="text-3xl font-bold text-error mb-1">0</div>
                  <div className="text-sm text-text-tertiary">Error Rate</div>
                </div>
              </div>
              <p className="text-text-tertiary text-sm text-center py-4">
                Analytics will be populated as executions occur.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border-subtle flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
          {skill.status === 'approved' && !skill.requiresHumanApproval && (
            <button onClick={onExecute} className="btn-primary">
              Execute Skill
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-2">
        <InfoIcon type={icon} />
        <span className="text-sm text-text-tertiary">{label}</span>
      </div>
      <div className="text-lg font-semibold text-text-primary capitalize">{value}</div>
    </div>
  );
}

function InfoIcon({ type }: { type: string }) {
  const className = 'w-4 h-4 text-text-tertiary';
  switch (type) {
    case 'category':
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>;
    case 'version':
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>;
    case 'author':
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
    case 'duration':
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
    case 'trust':
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>;
    case 'rate':
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    default:
      return null;
  }
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    approved: 'badge-success',
    pending: 'badge-warning',
    revoked: 'badge-danger',
    disabled: 'badge-info',
  };

  return (
    <span className={`${styles[status as keyof typeof styles] || 'badge-info'}`}>
      {status}
    </span>
  );
}

function CategoryIcon({ category, className = '' }: { category: string; className?: string }) {
  const iconClass = `w-6 h-6 ${className}`;
  const colorClass = category === 'data' ? 'text-cat-data' :
    category === 'legal' ? 'text-cat-legal' :
    category === 'code' ? 'text-cat-code' : 'text-cat-general';
  
  switch (category) {
    case 'data':
      return <svg className={`${iconClass} ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>;
    case 'legal':
      return <svg className={`${iconClass} ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>;
    case 'code':
      return <svg className={`${iconClass} ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>;
    default:
      return <svg className={`${iconClass} ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>;
  }
}
