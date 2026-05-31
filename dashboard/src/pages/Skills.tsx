import React, { useState, useEffect } from 'react';
import type { Skill } from '../api/types';
import { SkillCard } from '../components/SkillCard';
import { SkillDetail } from '../components/SkillDetail';
import { getSkills } from '../api/skills-api';

type Category = 'all' | 'data' | 'legal' | 'code' | 'general';

const categories: { value: Category; label: string; count?: number }[] = [
  { value: 'all', label: 'All Skills' },
  { value: 'data', label: 'Data' },
  { value: 'legal', label: 'Legal' },
  { value: 'code', label: 'Code' },
  { value: 'general', label: 'General' },
];

export function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [filteredSkills, setFilteredSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<Category>('all');
  const [search, setSearch] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [showExecuteModal, setShowExecuteModal] = useState(false);

  useEffect(() => {
    fetchSkills();
  }, []);

  useEffect(() => {
    filterSkills();
  }, [skills, category, search]);

  const fetchSkills = async () => {
    try {
      const data = await getSkills();
      setSkills(data);
    } catch (error) {
      console.error('Failed to fetch skills:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterSkills = () => {
    let filtered = skills;

    if (category !== 'all') {
      filtered = filtered.filter((s) => s.category === category);
    }

    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(searchLower) ||
          s.description.toLowerCase().includes(searchLower)
      );
    }

    setFilteredSkills(filtered);
  };

  const handleToggleEnabled = async (skillId: string, enabled: boolean) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === skillId ? { ...s, status: enabled ? 'approved' : 'disabled' } : s))
    );
    if (selectedSkill?.id === skillId) {
      setSelectedSkill((prev) => prev ? { ...prev, status: enabled ? 'approved' : 'disabled' } : null);
    }
  };

  const getCategoryCount = (cat: Category) => {
    if (cat === 'all') return skills.length;
    return skills.filter((s) => s.category === cat).length;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Skills Registry</h1>
          <p className="text-text-tertiary mt-1">Manage and monitor all available skills</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="badge-info text-sm py-1.5">
            {filteredSkills.length} of {skills.length} skills
          </span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-full pl-10"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 border-b border-border-subtle pb-2">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
              category === cat.value
                ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/20'
                : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-elevated border border-border-subtle'
            }`}
          >
            {cat.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              category === cat.value
                ? 'bg-white/20'
                : 'bg-bg-elevated text-text-tertiary'
            }`}>
              {getCategoryCount(cat.value)}
            </span>
          </button>
        ))}
      </div>

      {/* Skills Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-bg-elevated rounded-xl" />
                <div className="flex-1">
                  <div className="h-4 bg-bg-elevated rounded w-20 mb-2" />
                  <div className="h-3 bg-bg-elevated rounded w-16" />
                </div>
              </div>
              <div className="h-6 bg-bg-elevated rounded mb-2" />
              <div className="h-4 bg-bg-elevated rounded w-3/4 mb-4" />
              <div className="h-2 bg-bg-elevated rounded" />
            </div>
          ))}
        </div>
      ) : filteredSkills.length === 0 ? (
        <div className="card text-center py-16">
          <svg className="w-16 h-16 mx-auto text-text-tertiary mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-text-secondary text-lg mb-2">No skills found</p>
          <p className="text-text-tertiary text-sm">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onClick={() => setSelectedSkill(skill)}
              onExecute={() => {
                setSelectedSkill(skill);
                setShowExecuteModal(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Skill Detail Modal */}
      {selectedSkill && !showExecuteModal && (
        <SkillDetail
          skill={selectedSkill}
          onClose={() => setSelectedSkill(null)}
          onToggleEnabled={(enabled) => handleToggleEnabled(selectedSkill.id, enabled)}
          onExecute={() => setShowExecuteModal(true)}
        />
      )}

      {/* Execute Modal */}
      {selectedSkill && showExecuteModal && (
        <ExecuteModal
          skill={selectedSkill}
          onClose={() => {
            setShowExecuteModal(false);
            setSelectedSkill(null);
          }}
        />
      )}
    </div>
  );
}

// Execute Modal Component
function ExecuteModal({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const [params, setParams] = useState<Record<string, string>>({});
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleExecute = async () => {
    setExecuting(true);
    // Simulate execution
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setResult({
      success: true,
      message: `Skill "${skill.name}" executed successfully! Check the Monitor page for status.`,
    });
    setExecuting(false);
  };

  const inputFields = skill.inputSchema ? Object.entries(skill.inputSchema) : [];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border-subtle">
        {/* Header */}
        <div className="p-6 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent-primary/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Execute Skill</h2>
                <p className="text-sm text-text-tertiary">{skill.name}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-bg-elevated rounded-lg transition-colors">
              <svg className="w-5 h-5 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {result ? (
            <div className={`p-4 rounded-xl ${result.success ? 'bg-success/10 border border-success/20' : 'bg-error/10 border border-error/20'}`}>
              <div className="flex items-center gap-3">
                {result.success ? (
                  <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <p className={`text-sm ${result.success ? 'text-success' : 'text-error'}`}>{result.message}</p>
              </div>
            </div>
          ) : (
            <>
              {inputFields.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-sm text-text-tertiary">Enter the required parameters:</p>
                  {inputFields.map(([key, type]) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-text-secondary mb-1.5">
                        {key}
                        <span className="text-text-tertiary ml-1">({String(type)})</span>
                      </label>
                      {String(type) === 'string' || String(type) === 'string?' ? (
                        <input
                          type="text"
                          value={params[key] || ''}
                          onChange={(e) => setParams((prev) => ({ ...prev, [key]: e.target.value }))}
                          className="input w-full"
                          placeholder={`Enter ${key}...`}
                        />
                      ) : (
                        <textarea
                          value={params[key] || ''}
                          onChange={(e) => setParams((prev) => ({ ...prev, [key]: e.target.value }))}
                          className="input w-full h-24 resize-none"
                          placeholder={`Enter ${key}...`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-text-secondary text-center py-4">This skill does not require any parameters.</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border-subtle flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={handleExecute}
              disabled={executing}
              className="btn-primary"
            >
              {executing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Executing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  </svg>
                  Execute
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
