import React from 'react';
import { StatsOverview } from '../components/StatsOverview';
import { ApprovalQueue } from '../components/ApprovalQueue';

export function AnalyticsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Analytics & Approvals</h1>
        <p className="text-slate-400 mt-1">View skill analytics and manage pending approvals</p>
      </div>

      {/* Stats */}
      <StatsOverview />

      {/* Approval Queue */}
      <ApprovalQueue />
    </div>
  );
}
