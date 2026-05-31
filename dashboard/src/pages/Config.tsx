import React, { useState, useEffect } from 'react';
import type { Skill, SkillConfig } from '../api/types';
import { getSkills } from '../api/skills-api';

type ConfigTab = 'skills' | 'rate-limits' | 'approvals' | 'permissions' | 'logging';

export function ConfigPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [activeTab, setActiveTab] = useState<ConfigTab>('skills');
  const [config, setConfig] = useState<Partial<SkillConfig>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSkills();
  }, []);

  const fetchSkills = async () => {
    try {
      const data = await getSkills();
      setSkills(data.filter((s) => s.status !== 'pending'));
    } catch (error) {
      console.error('Failed to fetch skills:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSkill = (skill: Skill) => {
    setSelectedSkill(skill);
    setConfig({
      rateLimitPerMinute: skill.rateLimitPerMinute,
      requiresHumanApproval: skill.requiresHumanApproval,
    });
    setSaved(false);
  };

  const handleSaveConfig = () => {
    if (!selectedSkill) return;
    
    // Simulate save
    setSkills((prev) =>
      prev.map((s) =>
        s.id === selectedSkill.id
          ? {
              ...s,
              rateLimitPerMinute: config.rateLimitPerMinute ?? s.rateLimitPerMinute,
              requiresHumanApproval: config.requiresHumanApproval ?? s.requiresHumanApproval,
            }
          : s
      )
    );
    setSelectedSkill((prev) =>
      prev
        ? {
            ...prev,
            rateLimitPerMinute: config.rateLimitPerMinute ?? prev.rateLimitPerMinute,
            requiresHumanApproval: config.requiresHumanApproval ?? prev.requiresHumanApproval,
          }
        : null
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const tabs: { id: ConfigTab; label: string; icon: React.ReactNode }[] = [
    { id: 'skills', label: 'Skill Toggles', icon: <SkillToggleIcon /> },
    { id: 'rate-limits', label: 'Rate Limits', icon: <RateLimitIcon /> },
    { id: 'approvals', label: 'Approval Rules', icon: <ApprovalIcon /> },
    { id: 'permissions', label: 'Permissions', icon: <PermissionIcon /> },
    { id: 'logging', label: 'Logging', icon: <LoggingIcon /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Configuration</h1>
        <p className="text-text-tertiary mt-1">Configure skill settings and system policies</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border-subtle pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-accent-primary text-white'
                : 'bg-bg-secondary text-text-secondary hover:text-text-primary border border-border-subtle'
            }`}
          >
            <span className="w-4 h-4">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'skills' && (
        <div className="grid grid-cols-3 gap-6">
          {/* Skills List */}
          <div className="col-span-2 card">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Skill Status</h3>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 bg-bg-elevated rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {skills.map((skill) => (
                  <div
                    key={skill.id}
                    onClick={() => handleSelectSkill(skill)}
                    className={`p-4 rounded-xl transition-all cursor-pointer flex items-center justify-between ${
                      selectedSkill?.id === skill.id
                        ? 'bg-accent-primary/10 border border-accent-primary/30'
                        : 'bg-bg-secondary hover:bg-bg-elevated border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        skill.category === 'data' ? 'bg-cat-data/20 text-cat-data' :
                        skill.category === 'legal' ? 'bg-cat-legal/20 text-cat-legal' :
                        skill.category === 'code' ? 'bg-cat-code/20 text-cat-code' :
                        'bg-cat-general/20 text-cat-general'
                      }`}>
                        <SkillIcon />
                      </div>
                      <div>
                        <div className="font-medium text-text-primary">{skill.name}</div>
                        <div className="text-xs text-text-tertiary">{skill.category} · v{skill.version}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {skill.status === 'approved' ? (
                        <span className="badge-success">Enabled</span>
                      ) : skill.status === 'disabled' ? (
                        <span className="badge-info">Disabled</span>
                      ) : (
                        <span className="badge-warning">Pending</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Config Panel */}
          <div className="card">
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              {selectedSkill ? `Configure: ${selectedSkill.name}` : 'Configuration'}
            </h3>

            {selectedSkill ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Rate Limit (requests/minute)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={config.rateLimitPerMinute || selectedSkill.rateLimitPerMinute}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, rateLimitPerMinute: parseInt(e.target.value) }))
                    }
                    className="input w-full"
                  />
                  <p className="text-xs text-text-tertiary mt-1">
                    Current: {selectedSkill.rateLimitPerMinute}/min
                  </p>
                </div>

                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={config.requiresHumanApproval ?? selectedSkill.requiresHumanApproval}
                        onChange={(e) =>
                          setConfig((prev) => ({ ...prev, requiresHumanApproval: e.target.checked }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-bg-elevated rounded-full peer peer-checked:bg-accent-primary transition-colors"></div>
                      <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                    </div>
                    <div>
                      <span className="text-text-primary block">Human Approval</span>
                      <span className="text-xs text-text-tertiary">Require manual approval before execution</span>
                    </div>
                  </label>
                </div>

                <div className="pt-4 flex flex-col gap-2">
                  <button
                    onClick={handleSaveConfig}
                    disabled={saved}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    {saved ? (
                      <>
                        <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Saved!
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        Save Changes
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setSelectedSkill(null)}
                    className="btn-secondary w-full"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-text-tertiary">
                <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <p>Select a skill to configure</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'rate-limits' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-text-primary mb-6">Global Rate Limits</h3>
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Data Skills (req/min)
                </label>
                <input
                  type="number"
                  defaultValue={100}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Legal Skills (req/min)
                </label>
                <input
                  type="number"
                  defaultValue={30}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Code Skills (req/min)
                </label>
                <input
                  type="number"
                  defaultValue={50}
                  className="input w-full"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Burst Limit (concurrent requests)
              </label>
              <input
                type="number"
                defaultValue={20}
                className="input w-full max-w-xs"
              />
              <p className="text-xs text-text-tertiary mt-1">
                Maximum concurrent executions across all skills
              </p>
            </div>
            <button className="btn-primary">
              Save Rate Limits
            </button>
          </div>
        </div>
      )}

      {activeTab === 'approvals' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-text-primary mb-6">Approval Rules</h3>
          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-text-secondary">Auto-approve Conditions</h4>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 bg-bg-secondary rounded-lg cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded bg-bg-elevated border-border-default text-accent-primary focus:ring-accent-primary" />
                  <div>
                    <span className="text-text-primary block">Low-risk skills</span>
                    <span className="text-xs text-text-tertiary">Auto-approve skills with low risk level</span>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 bg-bg-secondary rounded-lg cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded bg-bg-elevated border-border-default text-accent-primary focus:ring-accent-primary" />
                  <div>
                    <span className="text-text-primary block">Trusted users</span>
                    <span className="text-xs text-text-tertiary">Auto-approve for verified/trusted user roles</span>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 bg-bg-secondary rounded-lg cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded bg-bg-elevated border-border-default text-accent-primary focus:ring-accent-primary" />
                  <div>
                    <span className="text-text-primary block">Read-only operations</span>
                    <span className="text-xs text-text-tertiary">Auto-approve skills that only read data</span>
                  </div>
                </label>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-text-secondary mb-2">Approval Timeout</h4>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  defaultValue={24}
                  className="input w-24"
                />
                <span className="text-text-secondary">hours</span>
                <span className="text-xs text-text-tertiary ml-2">
                  Auto-reject pending approvals after this duration
                </span>
              </div>
            </div>
            <button className="btn-primary">
              Save Approval Rules
            </button>
          </div>
        </div>
      )}

      {activeTab === 'permissions' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-text-primary mb-6">Permission Policies</h3>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-text-secondary mb-3">Allowed Permissions</h4>
                <div className="space-y-2">
                  {['read:database', 'read:knowledge', 'read:documents', 'read:code', 'read:external-api'].map((perm) => (
                    <label key={perm} className="flex items-center gap-2 p-2 bg-bg-secondary rounded-lg cursor-pointer">
                      <input type="checkbox" defaultChecked className="w-4 h-4 rounded bg-bg-elevated border-border-default text-success focus:ring-success" />
                      <span className="text-text-primary font-mono text-sm">{perm}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-text-secondary mb-3">Blocked Permissions</h4>
                <div className="space-y-2">
                  {['write:system', 'delete:*', 'sudo:*', 'exec:shell'].map((perm) => (
                    <label key={perm} className="flex items-center gap-2 p-2 bg-bg-secondary rounded-lg cursor-pointer">
                      <input type="checkbox" defaultChecked className="w-4 h-4 rounded bg-bg-elevated border-border-default text-error focus:ring-error" />
                      <span className="text-text-primary font-mono text-sm">{perm}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <button className="btn-primary">
              Save Permission Policies
            </button>
          </div>
        </div>
      )}

      {activeTab === 'logging' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-text-primary mb-6">Logging Configuration</h3>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Log Level
                </label>
                <select className="input w-full">
                  <option value="debug">Debug</option>
                  <option value="info">Info</option>
                  <option value="warn">Warning</option>
                  <option value="error">Error</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Retention Period
                </label>
                <select className="input w-full">
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="365">1 year</option>
                </select>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-text-secondary">Log What</h4>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 p-3 bg-bg-secondary rounded-lg cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded bg-bg-elevated border-border-default text-accent-primary focus:ring-accent-primary" />
                  <span className="text-text-primary text-sm">Execution logs</span>
                </label>
                <label className="flex items-center gap-2 p-3 bg-bg-secondary rounded-lg cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded bg-bg-elevated border-border-default text-accent-primary focus:ring-accent-primary" />
                  <span className="text-text-primary text-sm">API calls</span>
                </label>
                <label className="flex items-center gap-2 p-3 bg-bg-secondary rounded-lg cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded bg-bg-elevated border-border-default text-accent-primary focus:ring-accent-primary" />
                  <span className="text-text-primary text-sm">Errors & warnings</span>
                </label>
                <label className="flex items-center gap-2 p-3 bg-bg-secondary rounded-lg cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded bg-bg-elevated border-border-default text-accent-primary focus:ring-accent-primary" />
                  <span className="text-text-primary text-sm">Sensitive data</span>
                </label>
              </div>
            </div>
            <button className="btn-primary">
              Save Logging Config
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Icons
function SkillToggleIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function RateLimitIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function ApprovalIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function PermissionIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function LoggingIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function SkillIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}
