import React, { useState, useEffect } from 'react';
import type { Skill, SkillConfig } from '../api/types';

export function ConfigPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [config, setConfig] = useState<Partial<SkillConfig>>({});

  useEffect(() => {
    fetchSkills();
  }, []);

  const fetchSkills = async () => {
    try {
      const response = await fetch('/api/skills');
      const data = await response.json();
      setSkills(data.filter((s: Skill) => s.status !== 'pending'));
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
  };

  const handleSaveConfig = async () => {
    if (!selectedSkill) return;

    try {
      await fetch(`/api/skills/${selectedSkill.id}/config`, {
        method: 'PUT',
        body: JSON.stringify(config),
      });
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
      setSelectedSkill(null);
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Configuration</h1>
        <p className="text-slate-400 mt-1">Configure skill settings and approval requirements</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Skills List */}
        <div className="col-span-2 card">
          <h3 className="text-lg font-semibold text-white mb-4">Select a Skill to Configure</h3>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-slate-700 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {skills.map((skill) => (
                <button
                  key={skill.id}
                  onClick={() => handleSelectSkill(skill)}
                  className={`w-full text-left p-4 rounded-lg transition-colors ${
                    selectedSkill?.id === skill.id
                      ? 'bg-primary-600/20 border border-primary-500'
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white">{skill.name}</div>
                      <div className="text-sm text-slate-400">{skill.category} • v{skill.version}</div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      skill.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                      skill.status === 'disabled' ? 'bg-gray-500/20 text-gray-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {skill.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Config Form */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">
            {selectedSkill ? `Configure: ${selectedSkill.name}` : 'Configuration'}
          </h3>

          {selectedSkill ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Rate Limit (per minute)
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
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.requiresHumanApproval ?? selectedSkill.requiresHumanApproval}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, requiresHumanApproval: e.target.checked }))
                    }
                    className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-white">Requires Human Approval</span>
                </label>
                <p className="text-sm text-slate-500 mt-1">
                  When enabled, executions will require manual approval before running
                </p>
              </div>

              <div className="pt-4 flex gap-3">
                <button onClick={handleSaveConfig} className="btn-primary flex-1">
                  Save Changes
                </button>
                <button onClick={() => setSelectedSkill(null)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <p>Select a skill to configure</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
