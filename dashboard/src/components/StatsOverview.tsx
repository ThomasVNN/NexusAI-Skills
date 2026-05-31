import React, { useState, useEffect } from 'react';
import type { ExecutionStats, SkillAnalytics } from '../api/types';

interface StatsOverviewProps {
  refreshInterval?: number;
}

export function StatsOverview({ refreshInterval = 30000 }: StatsOverviewProps) {
  const [stats, setStats] = useState<ExecutionStats | null>(null);
  const [analytics, setAnalytics] = useState<SkillAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const fetchData = async () => {
    try {
      const [statsRes, analyticsRes] = await Promise.all([
        fetch('/api/skills/stats'),
        fetch('/api/skills/analytics'),
      ]);
      setStats(await statsRes.json());
      setAnalytics(await analyticsRes.json());
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
            <div className="h-8 bg-slate-700 rounded mb-2" />
            <div className="h-4 bg-slate-700 rounded w-2/3" />
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
        />
        <StatCard
          label="Success Rate"
          value={`${successRate}%`}
          icon={<SuccessIcon />}
          trend={successRate >= 90 ? 'Good' : 'Needs attention'}
          trendColor={successRate >= 90 ? 'text-green-400' : 'text-yellow-400'}
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

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Execution Trend Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Execution Trend</h3>
          <div className="h-48 flex items-end gap-2">
            {[65, 45, 78, 52, 90, 73, 85, 68, 92, 76, 88, 80].map((value, i) => (
              <div
                key={i}
                className="flex-1 bg-gradient-to-t from-primary-600 to-primary-400 rounded-t transition-all hover:from-primary-500 hover:to-primary-300"
                style={{ height: `${value}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-500">
            <span>Jan</span>
            <span>Dec</span>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">By Category</h3>
          <div className="space-y-4">
            {[
              { name: 'Data', count: analytics.filter((a) => a.totalExecutions > 0).length, color: 'bg-blue-500' },
              { name: 'Legal', count: analytics.filter((a) => a.totalExecutions > 0).length, color: 'bg-purple-500' },
              { name: 'Code', count: analytics.filter((a) => a.totalExecutions > 0).length, color: 'bg-green-500' },
            ].map((cat) => (
              <div key={cat.name} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${cat.color}`} />
                <span className="text-slate-400 flex-1">{cat.name}</span>
                <span className="text-white font-medium">{cat.count} skills</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Skills */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4">Most Used Skills</h3>
        <div className="space-y-3">
          {analytics
            .sort((a, b) => b.totalExecutions - a.totalExecutions)
            .slice(0, 5)
            .map((skill, index) => (
              <div key={skill.skillId} className="flex items-center gap-4">
                <span className="text-slate-500 w-6">#{index + 1}</span>
                <div className="flex-1">
                  <div className="text-white font-medium">{skill.skillId}</div>
                  <div className="text-sm text-slate-400">
                    {skill.totalExecutions} executions • {Math.round(skill.errorRate * 100)}% error rate
                  </div>
                </div>
                <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 rounded-full"
                    style={{ width: `${Math.min(100, (skill.totalExecutions / Math.max(...analytics.map((a) => a.totalExecutions), 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          {analytics.length === 0 && (
            <p className="text-slate-500 text-center py-4">No execution data yet</p>
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
  trendColor = 'text-green-400',
  highlight = false,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendColor?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`card ${highlight ? 'border-yellow-500/50' : ''}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-slate-700 text-primary-400">{icon}</div>
        {trend && (
          <span className={`text-sm ${trendColor}`}>
            {trend}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-slate-400">{label}</div>
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
