import React, { useState, useEffect } from 'react';
import type { Skill } from '../api/types';
import { SkillCard } from '../components/SkillCard';
import { SkillDetail } from '../components/SkillDetail';

export function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [filteredSkills, setFilteredSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);

  useEffect(() => {
    fetchSkills();
  }, []);

  useEffect(() => {
    let filtered = skills;

    // Filter by category
    if (category !== 'all') {
      filtered = filtered.filter((s) => s.category === category);
    }

    // Filter by search
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(searchLower) ||
          s.description.toLowerCase().includes(searchLower)
      );
    }

    setFilteredSkills(filtered);
  }, [skills, category, search]);

  const fetchSkills = async () => {
    try {
      const response = await fetch('/api/skills');
      const data = await response.json();
      setSkills(data);
    } catch (error) {
      console.error('Failed to fetch skills:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = async (skillId: string, enabled: boolean) => {
    try {
      const endpoint = enabled ? `/api/skills/${skillId}/enable` : `/api/skills/${skillId}/disable`;
      await fetch(endpoint, { method: 'POST' });
      setSkills((prev) =>
        prev.map((s) => (s.id === skillId ? { ...s, status: enabled ? 'approved' : 'disabled' } : s))
      );
      if (selectedSkill?.id === skillId) {
        setSelectedSkill((prev) => prev ? { ...prev, status: enabled ? 'approved' : 'disabled' } : null);
      }
    } catch (error) {
      console.error('Failed to toggle skill:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Skills Registry</h1>
          <p className="text-slate-400 mt-1">Manage and monitor all available skills</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="badge-info">{skills.length} skills</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
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

        {/* Category Filter */}
        <div className="flex gap-2">
          {[
            { value: 'all', label: 'All' },
            { value: 'data', label: 'Data' },
            { value: 'legal', label: 'Legal' },
            { value: 'code', label: 'Code' },
            { value: 'general', label: 'General' },
          ].map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                category === cat.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Skills Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="w-12 h-12 bg-slate-700 rounded-lg mb-4" />
              <div className="h-6 bg-slate-700 rounded mb-2" />
              <div className="h-4 bg-slate-700 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : filteredSkills.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-16 h-16 mx-auto text-slate-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-slate-400 text-lg">No skills found</p>
          <p className="text-slate-500 text-sm mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onClick={() => setSelectedSkill(skill)}
            />
          ))}
        </div>
      )}

      {/* Skill Detail Modal */}
      {selectedSkill && (
        <SkillDetail
          skill={selectedSkill}
          onClose={() => setSelectedSkill(null)}
          onToggleEnabled={(enabled) => handleToggleEnabled(selectedSkill.id, enabled)}
        />
      )}
    </div>
  );
}
