import React, { useState, useEffect } from 'react';
import type { ExecutionRecord } from '../api/types';
import { getExecutions } from '../api/skills-api';
import { formatDistanceToNow, format } from 'date-fns';

interface ExecutionMonitorProps {
  refreshInterval?: number;
}

export function ExecutionMonitor({ refreshInterval = 5000 }: ExecutionMonitorProps) {
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [filter, setFilter] = useState<'all' | 'running' | 'completed' | 'failed' | 'queued'>('all');
  const [loading, setLoading] = useState(true);
  const [selectedExecution, setSelectedExecution] = useState<ExecutionRecord | null>(null);

  useEffect(() => {
    fetchExecutions();
    const interval = setInterval(fetchExecutions, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const fetchExecutions = async () => {
    try {
      const data = await getExecutions({ limit: 50 });
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

  const stats = {
    total: executions.length,
    running: executions.filter((e) => e.state === 'running').length,
    queued: executions.filter((e) => e.state === 'queued').length,
    completed: executions.filter((e) => e.state === 'completed').length,
    failed: executions.filter((e) => e.state === 'failed').length,
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        <StatCard label="Total" value={stats.total} icon={<TotalIcon />} color="text-info" />
        <StatCard label="Running" value={stats.running} icon={<RunningIcon />} color="text-warning" />
        <StatCard label="Queued" value={stats.queued} icon={<QueuedIcon />} color="text-text-tertiary" />
        <StatCard label="Completed" value={stats.completed} icon={<CompletedIcon />} color="text-success" />
        <StatCard label="Failed" value={stats.failed} icon={<FailedIcon />} color="text-error" />
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Execution Queue</h2>
        <div className="flex gap-2">
          {(['all', 'running', 'queued', 'completed', 'failed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-accent-primary text-white'
                  : 'bg-bg-secondary text-text-secondary hover:text-text-primary border border-border-subtle'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== 'all' && (
                <span className={`ml-1.5 text-xs ${
                  filter === f ? 'text-white/70' : 'text-text-tertiary'
                }`}>
                  {f === 'running' ? stats.running :
                   f === 'queued' ? stats.queued :
                   f === 'completed' ? stats.completed :
                   f === 'failed' ? stats.failed : ''}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Execution Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th className="sticky top-0 bg-bg-secondary">Skill</th>
              <th className="sticky top-0 bg-bg-secondary">User</th>
              <th className="sticky top-0 bg-bg-secondary">Status</th>
              <th className="sticky top-0 bg-bg-secondary">Started</th>
              <th className="sticky top-0 bg-bg-secondary">Duration</th>
              <th className="sticky top-0 bg-bg-secondary">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-text-tertiary">
                  Loading executions...
                </td>
              </tr>
            ) : filteredExecutions.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-text-tertiary">
                  No executions found
                </td>
              </tr>
            ) : (
              filteredExecutions.map((exec) => (
                <tr
                  key={exec.id}
                  className="cursor-pointer hover:bg-bg-elevated/50"
                  onClick={() => setSelectedExecution(exec)}
                >
                  <td>
                    <div className="font-medium text-text-primary">{exec.skillName}</div>
                    <div className="text-xs text-text-tertiary font-mono">{exec.skillId}</div>
                  </td>
                  <td>
                    <span className="text-text-secondary">{exec.userId || 'System'}</span>
                  </td>
                  <td>
                    <StatusBadge state={exec.state} />
                  </td>
                  <td>
                    <div className="text-text-secondary text-sm">
                      {formatDistanceToNow(new Date(exec.startedAt), { addSuffix: true })}
                    </div>
                    <div className="text-xs text-text-tertiary">
                      {format(new Date(exec.startedAt), 'HH:mm:ss')}
                    </div>
                  </td>
                  <td>
                    {exec.completedAt ? (
                      <span className="text-text-secondary">
                        {new Date(exec.completedAt).getTime() - new Date(exec.startedAt).getTime()}ms
                      </span>
                    ) : exec.state === 'running' ? (
                      <span className="text-warning">
                        {new Date().getTime() - new Date(exec.startedAt).getTime()}ms
                      </span>
                    ) : (
                      <span className="text-text-tertiary">-</span>
                    )}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedExecution(exec)}
                        className="btn-ghost text-xs py-1"
                      >
                        View
                      </button>
                      {exec.state === 'running' && (
                        <button className="btn-ghost text-xs py-1 text-error hover:text-error">
                          Stop
                        </button>
                      )}
                      {exec.state === 'queued' && (
                        <button className="btn-ghost text-xs py-1 text-error hover:text-error">
                          Cancel
                        </button>
                      )}
                      {exec.state === 'failed' && (
                        <button className="btn-ghost text-xs py-1 text-info hover:text-info">
                          Retry
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Log Viewer Modal */}
      {selectedExecution && (
        <LogViewerModal
          execution={selectedExecution}
          onClose={() => setSelectedExecution(null)}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`p-3 rounded-xl bg-bg-secondary ${color}`}>{icon}</div>
      <div>
        <div className="text-2xl font-bold text-text-primary">{value}</div>
        <div className="text-sm text-text-tertiary">{label}</div>
      </div>
    </div>
  );
}

function StatusBadge({ state }: { state: string }) {
  const styles: Record<string, { bg: string; text: string; dot: string }> = {
    queued: { bg: 'bg-bg-secondary', text: 'text-text-secondary', dot: 'bg-text-tertiary' },
    running: { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning animate-pulse' },
    completed: { bg: 'bg-success/10', text: 'text-success', dot: 'bg-success' },
    failed: { bg: 'bg-error/10', text: 'text-error', dot: 'bg-error' },
    cancelled: { bg: 'bg-text-tertiary/10', text: 'text-text-tertiary', dot: 'bg-text-tertiary' },
  };

  const style = styles[state] || styles.queued;

  return (
    <div className={`flex items-center gap-2 ${style.bg} px-2.5 py-1 rounded-full`}>
      <span className={`w-2 h-2 rounded-full ${style.dot}`} />
      <span className={`text-xs font-medium capitalize ${style.text}`}>{state}</span>
    </div>
  );
}

function LogViewerModal({ execution, onClose }: { execution: ExecutionRecord; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopyLogs = () => {
    const logText = execution.logs
      ?.map((log) => `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`)
      .join('\n') || 'No logs available';
    navigator.clipboard.writeText(logText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden border border-border-subtle">
        {/* Header */}
        <div className="p-6 border-b border-border-subtle">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">{execution.skillName}</h2>
              <p className="text-text-tertiary text-sm mt-1 font-mono">{execution.id}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-bg-elevated rounded-lg transition-colors">
              <svg className="w-6 h-6 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Execution Info */}
        <div className="px-6 py-4 border-b border-border-subtle bg-bg-secondary/50">
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-text-tertiary">Status: </span>
              <StatusBadge state={execution.state} />
            </div>
            <div>
              <span className="text-text-tertiary">User: </span>
              <span className="text-text-secondary">{execution.userId || 'System'}</span>
            </div>
            <div>
              <span className="text-text-tertiary">Started: </span>
              <span className="text-text-secondary">{format(new Date(execution.startedAt), 'HH:mm:ss')}</span>
            </div>
            <div>
              <span className="text-text-tertiary">Duration: </span>
              <span className="text-text-secondary">
                {execution.completedAt
                  ? `${new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()}ms`
                  : execution.state === 'running'
                  ? `${new Date().getTime() - new Date(execution.startedAt).getTime()}ms`
                  : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Log Viewer */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-250px)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-text-secondary">Execution Logs</h3>
            <button
              onClick={handleCopyLogs}
              className="btn-ghost text-xs flex items-center gap-1"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Logs
                </>
              )}
            </button>
          </div>

          <div className="log-viewer border border-border-subtle">
            {execution.logs && execution.logs.length > 0 ? (
              execution.logs.map((log, index) => (
                <div
                  key={index}
                  className={`log-line ${
                    log.level === 'error' ? 'log-line-error' :
                    log.level === 'warn' ? 'log-line-warn' :
                    log.level === 'info' ? 'log-line-info' :
                    'log-line-debug'
                  }`}
                >
                  <span className="text-text-tertiary mr-2">
                    [{format(new Date(log.timestamp), 'HH:mm:ss.SSS')}]
                  </span>
                  <span className={`uppercase text-xs font-medium mr-2 ${
                    log.level === 'error' ? 'text-error' :
                    log.level === 'warn' ? 'text-warning' :
                    log.level === 'info' ? 'text-info' :
                    'text-text-tertiary'
                  }`}>
                    {log.level}
                  </span>
                  {log.message}
                </div>
              ))
            ) : (
              <div className="text-text-tertiary py-8 text-center">
                No logs available for this execution
              </div>
            )}
          </div>

          {/* Error Message */}
          {execution.error && (
            <div className="mt-4 p-4 bg-error/10 border border-error/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium text-error">Error</span>
              </div>
              <p className="text-sm text-text-secondary font-mono">{execution.error}</p>
            </div>
          )}

          {/* Result */}
          {execution.result && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-text-secondary mb-2">Result</h4>
              <div className="bg-bg-primary rounded-lg p-4 border border-border-subtle">
                <pre className="text-sm text-text-secondary font-mono overflow-x-auto">
                  {JSON.stringify(execution.result, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border-subtle flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
          {execution.state === 'failed' && (
            <button className="btn-primary flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry Execution
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Icons
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

function QueuedIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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
