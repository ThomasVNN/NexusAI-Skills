import React from 'react';
import type { Skill } from '../api/types';

interface SkillCardProps {
  skill: Skill;
  onClick?: () => void;
  onExecute?: () => void;
}

const categoryConfig = {
  data: {
    bgGradient: 'from-cat-data/20 to-cat-data/5',
    borderColor: 'border-cat-data/30',
    iconBg: 'bg-cat-data/20',
    iconColor: 'text-cat-data',
    badge: 'badge-data',
    label: 'Data',
  },
  legal: {
    bgGradient: 'from-cat-legal/20 to-cat-legal/5',
    borderColor: 'border-cat-legal/30',
    iconBg: 'bg-cat-legal/20',
    iconColor: 'text-cat-legal',
    badge: 'badge-legal',
    label: 'Legal',
  },
  code: {
    bgGradient: 'from-cat-code/20 to-cat-code/5',
    borderColor: 'border-cat-code/30',
    iconBg: 'bg-cat-code/20',
    iconColor: 'text-cat-code',
    badge: 'badge-code',
    label: 'Code',
  },
  general: {
    bgGradient: 'from-cat-general/20 to-cat-general/5',
    borderColor: 'border-cat-general/30',
    iconBg: 'bg-cat-general/20',
    iconColor: 'text-cat-general',
    badge: 'badge-general',
    label: 'General',
  },
};

const statusConfig = {
  approved: {
    dot: 'bg-success',
    label: 'Approved',
    badgeClass: 'badge-success',
  },
  pending: {
    dot: 'bg-warning',
    label: 'Pending',
    badgeClass: 'badge-warning',
  },
  revoked: {
    dot: 'bg-error',
    label: 'Revoked',
    badgeClass: 'badge-danger',
  },
  disabled: {
    dot: 'bg-text-tertiary',
    label: 'Disabled',
    badgeClass: 'badge-info',
  },
};

const durationColor = {
  Fast: 'text-success',
  Medium: 'text-warning',
  Slow: 'text-error',
};

export function SkillCard({ skill, onClick, onExecute }: SkillCardProps) {
  const config = categoryConfig[skill.category];
  const status = statusConfig[skill.status];

  return (
    <div
      className={`card-hover bg-gradient-to-br ${config.bgGradient} border ${config.borderColor}`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl ${config.iconBg} flex items-center justify-center`}>
            <CategoryIcon category={skill.category} className={config.iconColor} />
          </div>
          <div>
            <span className={config.badge}>{config.label}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${status.dot}`} />
          <span className="text-sm text-text-tertiary">{status.label}</span>
        </div>
      </div>

      {/* Title & Description */}
      <h3 className="text-lg font-semibold text-text-primary mb-2 group-hover:text-accent-primary transition-colors">
        {skill.name}
      </h3>
      <p className="text-sm text-text-secondary mb-4 line-clamp-2">
        {skill.description}
      </p>

      {/* Trust Score */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-text-tertiary">Trust Score</span>
          <span className="font-medium text-text-primary">{skill.trustScore}%</span>
        </div>
        <div className="progress-bar">
          <div
            className={`progress-bar-fill ${skill.trustScore >= 90 ? 'bg-success' : skill.trustScore >= 70 ? 'bg-warning' : 'bg-error'}`}
            style={{ width: `${skill.trustScore}%` }}
          />
        </div>
      </div>

      {/* Meta Info */}
      <div className="flex items-center gap-4 mb-4 text-sm text-text-tertiary">
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className={durationColor[skill.estimatedDuration as keyof typeof durationColor] || 'text-text-secondary'}>
            {skill.estimatedDuration}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{skill.rateLimitPerMinute}/min</span>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {skill.permissions.slice(0, 3).map((perm) => (
          <span key={perm} className="px-2 py-0.5 text-xs bg-bg-secondary rounded text-text-tertiary border border-border-subtle">
            {perm}
          </span>
        ))}
        {skill.permissions.length > 3 && (
          <span className="px-2 py-0.5 text-xs bg-bg-secondary rounded text-text-tertiary">
            +{skill.permissions.length - 3}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-4 border-t border-border-subtle">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
          className="btn-secondary flex-1 text-sm"
        >
          View Details
        </button>
        {skill.status === 'approved' && !skill.requiresHumanApproval && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExecute?.();
            }}
            className="btn-primary flex-1 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Execute
          </button>
        )}
        {skill.requiresHumanApproval && (
          <span className="badge-warning text-xs">Approval Required</span>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center gap-2 text-xs text-text-tertiary">
        <span>v{skill.version}</span>
        <span>•</span>
        <span>{skill.author}</span>
      </div>
    </div>
  );
}

interface CategoryIconProps {
  category: string;
  className?: string;
}

function CategoryIcon({ category, className = '' }: CategoryIconProps) {
  const iconClass = `w-6 h-6 ${className}`;
  
  switch (category) {
    case 'data':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
      );
    case 'legal':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
        </svg>
      );
    case 'code':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      );
  }
}
