import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { getExecutionStats, getTimeSeriesData, getCategoryDistribution, getDurationData, getAnalytics } from '../api/skills-api';
import type { ExecutionStats, TimeSeriesDataPoint, SkillAnalytics } from '../api/types';

export function AnalyticsPage() {
  const [stats, setStats] = useState<ExecutionStats | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesDataPoint[]>([]);
  const [categoryData, setCategoryData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [durationData, setDurationData] = useState<{ name: string; avgDuration: number }[]>([]);
  const [analytics, setAnalytics] = useState<SkillAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, timeSeries, categories, durations, analyticsRes] = await Promise.all([
        getExecutionStats(),
        getTimeSeriesData(),
        getCategoryDistribution(),
        getDurationData(),
        getAnalytics(),
      ]);
      setStats(statsRes);
      setTimeSeriesData(timeSeries);
      setCategoryData(categories);
      setDurationData(durations);
      setAnalytics(analyticsRes);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const successRate = stats && stats.totalExecutions > 0
    ? Math.round((stats.successfulExecutions / stats.totalExecutions) * 100)
    : 0;

  const topSkills = [...analytics]
    .sort((a, b) => b.totalExecutions - a.totalExecutions)
    .slice(0, 5);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Analytics</h1>
          <p className="text-text-tertiary mt-1">View skill analytics and performance metrics</p>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-8 bg-bg-elevated rounded mb-2" />
              <div className="h-4 bg-bg-elevated rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Analytics</h1>
        <p className="text-text-tertiary mt-1">View skill analytics and performance metrics</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Executions"
          value={stats?.totalExecutions || 0}
          trend="+12%"
          trendUp
          icon={<TotalIcon />}
        />
        <StatCard
          label="Success Rate"
          value={`${successRate}%`}
          trend={successRate >= 90 ? 'Good' : 'Needs attention'}
          trendUp={successRate >= 90}
          icon={<SuccessIcon />}
        />
        <StatCard
          label="Avg Duration"
          value={`${Math.round(stats?.averageExecutionTimeMs || 0)}ms`}
          icon={<DurationIcon />}
        />
        <StatCard
          label="Most Used"
          value={topSkills[0]?.skillName.split(' ')[0] || 'N/A'}
          icon={<StarIcon />}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-2 gap-6">
        {/* Executions Over Time */}
        <div className="card">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Executions Over Time</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeriesData}>
                <defs>
                  <linearGradient id="colorExecutions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSuccesses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34D399" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#34D399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                <XAxis
                  dataKey="timestamp"
                  stroke="#71717A"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis stroke="#71717A" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181B',
                    border: '1px solid #27272A',
                    borderRadius: '8px',
                    color: '#FAFAFA',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="executions"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorExecutions)"
                  name="Total"
                />
                <Area
                  type="monotone"
                  dataKey="successes"
                  stroke="#34D399"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorSuccesses)"
                  name="Successes"
                />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="card">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Executions by Category</h3>
          <div className="h-72 flex items-center">
            <div className="w-1/2">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181B',
                      border: '1px solid #27272A',
                      borderRadius: '8px',
                      color: '#FAFAFA',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 space-y-4">
              {categoryData.map((cat) => (
                <div key={cat.name} className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-text-secondary flex-1">{cat.name}</span>
                  <span className="text-text-primary font-medium">{cat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-2 gap-6">
        {/* Average Duration by Skill */}
        <div className="card">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Avg Duration by Skill (ms)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={durationData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#27272A" horizontal={false} />
                <XAxis type="number" stroke="#71717A" fontSize={12} tickLine={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke="#71717A"
                  fontSize={11}
                  tickLine={false}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181B',
                    border: '1px solid #27272A',
                    borderRadius: '8px',
                    color: '#FAFAFA',
                  }}
                  formatter={(value: number) => [`${value}ms`, 'Avg Duration']}
                />
                <Bar
                  dataKey="avgDuration"
                  fill="#8B5CF6"
                  radius={[0, 4, 4, 0]}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Skills */}
        <div className="card">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Top Skills by Usage</h3>
          <div className="space-y-4">
            {topSkills.map((skill, index) => {
              const maxExec = topSkills[0]?.totalExecutions || 1;
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
            {topSkills.length === 0 && (
              <p className="text-text-tertiary text-center py-8">No data available yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Execution Summary */}
      <div className="card">
        <h3 className="text-lg font-semibold text-text-primary mb-4">Performance Summary</h3>
        <div className="grid grid-cols-4 gap-6">
          <div className="text-center p-4 bg-bg-secondary rounded-xl">
            <div className="text-3xl font-bold text-success mb-1">
              {stats?.successfulExecutions || 0}
            </div>
            <div className="text-sm text-text-tertiary">Successful</div>
          </div>
          <div className="text-center p-4 bg-bg-secondary rounded-xl">
            <div className="text-3xl font-bold text-error mb-1">
              {stats?.failedExecutions || 0}
            </div>
            <div className="text-sm text-text-tertiary">Failed</div>
          </div>
          <div className="text-center p-4 bg-bg-secondary rounded-xl">
            <div className="text-3xl font-bold text-warning mb-1">
              {stats?.activeExecutions || 0}
            </div>
            <div className="text-sm text-text-tertiary">Active</div>
          </div>
          <div className="text-center p-4 bg-bg-secondary rounded-xl">
            <div className="text-3xl font-bold text-info mb-1">
              {stats?.pendingApprovals || 0}
            </div>
            <div className="text-sm text-text-tertiary">Pending Approvals</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  trend,
  trendUp,
  icon,
}: {
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className="card">
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

function StarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}
