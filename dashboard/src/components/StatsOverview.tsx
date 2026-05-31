import React, { useState, useEffect } from 'react';
import type { ExecutionStats, SkillAnalytics } from '../api/types';
import { getExecutionStats, getAnalytics } from '../api/skills-api';

export function StatsOverview() {
  const [stats, setStats] = useState<ExecutionStats | null>(null);
  const [analytics, setAnalytics] = useState<SkillAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, analyticsRes] = await Promise.all([
        getExecutionStats(),
        getAnalytics(),
      ]);
      setStats(statsRes);
      setAnalytics(analyticsRes);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-8 bg-bg-elevated rounded mb-2" />
            <div className="h-4 bg-bg-elevated rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  const successRate = stats.totalExecutions > 0
    ? Math.round((stats.successfulExecutions / stats.totalExecutions) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Executions"
          value={stats.totalExecutions}
          icon={<TotalIcon />}
          trend={stats.totalExecutions > 0 ? '+12%' : undefined}
          trendUp
        />
        <StatCard
          label="Success Rate"
          value={`${successRate}%`}
          icon={<SuccessIcon />}
          trend={successRate >= 90 ? 'Good' : 'Needs attention'}
          trendUp={successRate >= 90}
        />
        <StatCard
          label="Avg Duration"
          value={`${Math.round(stats.averageExecutionTimeMs)}ms`}
          icon={<DurationIcon />}
        />
        <StatCard
          label="Pending Approvals"
          value={stats.pendingApprovals}
          icon={<ApprovalIcon />}
          highlight={stats.pendingApprovals > 0}
        />
      </div>

      {/* Top Skills */}
      <div className="card">
        <h3 className="text-lg font-semibold text-text-primary mb-4">Most Used Skills</h3>
        <div className="space-y-3">
          {analytics
            .sort((a, b) => b.totalExecutions - a.totalExecutions)
            .slice(0, 5)
            .map((skill, index) => {
              const maxExec = analytics[0]?.totalExecutions || 1;
              const percentage = Math.round((skill.totalExecutions / maxExec) * 100);
              
              return (
                <div key={skill.skillId} className="flex items-center gap-4">
                  <span className="text-text-tertiary w-5 text-sm">#{index + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-text-primary">{skill.skillName}</span>
                      <span className="text-xs text-text-tertiary">
                        {skill.totalExecutions} executions · {Math.round(skill.errorRate * 100)}% errors
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-bar-fill bg-accent-primary"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          {analytics.length === 0 && (
            <p className="text-text-tertiary text-center py-4">No execution data yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  trend,
  trendUp,
  highlight = false,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`card ${highlight ? 'border-warning/30 bg-warning/5' : ''}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2.5 rounded-xl bg-accent-primary/10 text-accent-primary">{icon}</div>
        {trend && (
          <span className={`text-sm ${trendUp ? 'text-success' : 'text-warning'}`}>
            {trendUp ? '↑' : '↓'} {trend}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-text-primary">{value}</div>
      <div className="text-sm text-text-tertiary">{label}</div>
    </div>
  );
}

function TotalIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function SuccessIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

function DurationIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ApprovalIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}
