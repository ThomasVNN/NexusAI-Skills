import React from 'react';
import { ExecutionMonitor } from '../components/ExecutionMonitor';

export function MonitorPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Execution Monitor</h1>
        <p className="text-slate-400 mt-1">Monitor real-time skill execution and queue status</p>
      </div>

      {/* Monitor */}
      <ExecutionMonitor refreshInterval={5000} />
    </div>
  );
}
