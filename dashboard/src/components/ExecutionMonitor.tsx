import React, { useState, useEffect } from 'react';
import type { ExecutionRecord } from '../api/types';
import { formatDistanceToNow } from 'date-fns';

interface ExecutionMonitorProps {
  refreshInterval?: number;
}

export function ExecutionMonitor({ refreshInterval = 5000 }: ExecutionMonitorProps) {
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [filter, setFilter] = useState<'all' | 'running' | 'completed' | 'failed'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExecutions();
    const interval = setInterval(fetchExecutions, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const fetchExecutions = async () => {
    try {
      const response = await fetch('/api/skills/executions?limit=50');
      const data = await response.json();
      setExecutions(data);
    } catch (error) {
      console.error('Failed to fetch executions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredExecutions = executions.filter((exec) => {
    if (filter === 'all') return true;
    return exec.state === filter;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Execution Monitor</h2>
        <div className="flex gap-2">
          {(['all', 'running', 'completed', 'failed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total"
          value={executions.length}
          icon={<TotalIcon />}
          color="text-blue-400"
        />
        <StatCard
          label="Running"
          value={executions.filter((e) => e.state === 'running').length}
          icon={<RunningIcon />}
          color="text-yellow-400"
        />
        <StatCard
          label="Completed"
          value={executions.filter((e) => e.state === 'completed').length}
          icon={<CompletedIcon />}
          color="text-green-400"
        />
        <StatCard
          label="Failed"
          value={executions.filter((e) => e.state === 'failed').length}
          icon={<FailedIcon />}
          color="text-red-400"
        />
      </div>

      {/* Execution List */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Skill</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Started</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Duration</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Loading...
                  </td>
                </tr>
              ) : filteredExecutions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    No executions found
                  </td>
                </tr>
              ) : (
                filteredExecutions.map((exec) => (
                  <tr key={exec.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-sm text-slate-400 font-mono">
                      {exec.id.substring(0, 16)}...
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-white">{exec.skillName}</div>
                      <div className="text-xs text-slate-500">{exec.skillId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge state={exec.state} />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {formatDistanceToNow(new Date(exec.startedAt), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {exec.completedAt
                        ? `${new Date(exec.completedAt).getTime() - new Date(exec.startedAt).getTime()}ms`
                        : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`p-3 rounded-lg bg-slate-700 ${color}`}>{icon}</div>
      <div>
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-sm text-slate-400">{label}</div>
      </div>
    </div>
  );
}

function StatusBadge({ state }: { state: string }) {
  const styles = {
    queued: 'bg-yellow-500/20 text-yellow-400',
    running: 'bg-blue-500/20 text-blue-400',
    completed: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
    cancelled: 'bg-gray-500/20 text-gray-400',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${styles[state as keyof typeof styles] || 'bg-gray-500/20 text-gray-400'}`}>
      {state}
    </span>
  );
}

function TotalIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

function RunningIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function CompletedIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function FailedIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
