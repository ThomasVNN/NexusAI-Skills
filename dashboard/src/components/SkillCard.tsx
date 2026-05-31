import React from 'react';
import type { Skill } from '../api/types';

interface SkillCardProps {
  skill: Skill;
  onClick?: () => void;
}

const categoryColors = {
  data: 'from-blue-500 to-cyan-500',
  legal: 'from-purple-500 to-pink-500',
  code: 'from-green-500 to-emerald-500',
  general: 'from-gray-500 to-slate-500',
};

const statusColors = {
  approved: 'bg-green-500',
  pending: 'bg-yellow-500',
  revoked: 'bg-red-500',
  disabled: 'bg-gray-500',
};

export function SkillCard({ skill, onClick }: SkillCardProps) {
  return (
    <div 
      className="card-hover cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${categoryColors[skill.category]} flex items-center justify-center`}>
          <CategoryIcon category={skill.category} />
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColors[skill.status]}`} />
          <span className="text-sm text-slate-400 capitalize">{skill.status}</span>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-primary-400 transition-colors">
        {skill.name}
      </h3>

      <p className="text-slate-400 text-sm mb-4 line-clamp-2">
        {skill.description}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="text-sm text-slate-400">{skill.trustScore}%</span>
          </div>
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-sm text-slate-400">{skill.rateLimitPerMinute}/min</span>
          </div>
        </div>
        {skill.requiresHumanApproval && (
          <span className="badge-warning">Approval Required</span>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-700">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>v{skill.version}</span>
          <span>•</span>
          <span>{skill.category}</span>
          <span>•</span>
          <span>{skill.author}</span>
        </div>
      </div>
    </div>
  );
}

function CategoryIcon({ category }: { category: string }) {
  switch (category) {
    case 'data':
      return (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
      );
    case 'legal':
      return (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
        </svg>
      );
    case 'code':
      return (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      );
    default:
      return (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      );
  }
}
