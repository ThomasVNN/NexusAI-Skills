import React from 'react';
import { ExecutionMonitor } from '../components/ExecutionMonitor';

export function MonitorPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Execution Monitor</h1>
        <p className="text-text-tertiary mt-1">Monitor real-time skill execution and queue status</p>
      </div>

      <ExecutionMonitor refreshInterval={5000} />
    </div>
  );
}
