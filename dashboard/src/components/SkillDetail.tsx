import React, { useState } from 'react';
import type { Skill } from '../api/types';

interface SkillDetailProps {
  skill: Skill;
  onClose: () => void;
  onToggleEnabled?: (enabled: boolean) => void;
  onUpdateConfig?: (config: Partial<Skill>) => void;
}

export function SkillDetail({ skill, onClose, onToggleEnabled, onUpdateConfig }: SkillDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'permissions' | 'analytics'>('overview');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-white">{skill.name}</h2>
                <StatusBadge status={skill.status} />
              </div>
              <p className="text-slate-400">{skill.description}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          {(['overview', 'permissions', 'analytics'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'text-primary-400 border-b-2 border-primary-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <InfoCard label="Category" value={skill.category} />
                <InfoCard label="Version" value={skill.version} />
                <InfoCard label="Author" value={skill.author} />
                <InfoCard label="Duration" value={skill.estimatedDuration} />
                <InfoCard label="Trust Score" value={`${skill.trustScore}%`} />
                <InfoCard label="Rate Limit" value={`${skill.rateLimitPerMinute}/min`} />
              </div>

              <div className="card">
                <h4 className="text-lg font-semibold text-white mb-4">Actions</h4>
                <div className="flex gap-3">
                  {skill.status === 'approved' || skill.status === 'disabled' ? (
                    <button
                      onClick={() => onToggleEnabled?.(false)}
                      className="btn-danger"
                    >
                      Disable Skill
                    </button>
                  ) : (
                    <button
                      onClick={() => onToggleEnabled?.(true)}
                      className="btn-success"
                    >
                      Enable Skill
                    </button>
                  )}
                  {skill.requiresHumanApproval && (
                    <span className="badge-warning self-center">Requires Approval</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-white">Required Permissions</h4>
              <div className="flex flex-wrap gap-2">
                {skill.permissions.map((perm) => (
                  <span key={perm} className="badge-info">{perm}</span>
                ))}
              </div>

              <h4 className="text-lg font-semibold text-white mt-6">Required Capabilities</h4>
              <div className="flex flex-wrap gap-2">
                {skill.requiredCapabilities.map((cap) => (
                  <span key={cap} className="badge-info">{cap}</span>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="card text-center">
                  <div className="text-3xl font-bold text-white mb-1">0</div>
                  <div className="text-sm text-slate-400">Total Executions</div>
                </div>
                <div className="card text-center">
                  <div className="text-3xl font-bold text-green-400 mb-1">0%</div>
                  <div className="text-sm text-slate-400">Success Rate</div>
                </div>
                <div className="card text-center">
                  <div className="text-3xl font-bold text-white mb-1">0ms</div>
                  <div className="text-sm text-slate-400">Avg Duration</div>
                </div>
                <div className="card text-center">
                  <div className="text-3xl font-bold text-yellow-400 mb-1">0</div>
                  <div className="text-sm text-slate-400">Error Rate</div>
                </div>
              </div>
              <p className="text-slate-500 text-sm text-center">Analytics will be populated as executions occur.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="text-sm text-slate-400 mb-1">{label}</div>
      <div className="text-lg font-semibold text-white capitalize">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    approved: 'bg-green-500',
    pending: 'bg-yellow-500',
    revoked: 'bg-red-500',
    disabled: 'bg-gray-500',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium text-white ${colors[status as keyof typeof colors] || 'bg-gray-500'}`}>
      {status}
    </span>
  );
}
