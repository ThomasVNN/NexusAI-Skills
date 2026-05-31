import React, { useState, useEffect } from 'react';
import type { ApprovalRequest } from '../api/types';
import { getPendingApprovals } from '../api/skills-api';
import { formatDistanceToNow } from 'date-fns';

export function ApprovalQueue() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApprovals();
    const interval = setInterval(fetchApprovals, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchApprovals = async () => {
    try {
      const data = await getPendingApprovals();
      setApprovals(data);
    } catch (error) {
      console.error('Failed to fetch approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-8 bg-bg-elevated rounded mb-4" />
        <div className="h-24 bg-bg-elevated rounded" />
      </div>
    );
  }

  if (approvals.length === 0) {
    return null;
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text-primary">Pending Approvals</h3>
        <span className="badge-warning">{approvals.length}</span>
      </div>
      <div className="space-y-3">
        {approvals.slice(0, 3).map((approval) => (
          <div key={approval.id} className="p-3 bg-bg-secondary rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-text-primary">{approval.skillName}</span>
                <p className="text-xs text-text-tertiary">
                  {approval.userId || 'Unknown'} · {formatDistanceToNow(new Date(approval.requestedAt), { addSuffix: true })}
                </p>
              </div>
              <span className="badge-warning text-xs">Review</span>
            </div>
          </div>
        ))}
      </div>
      {approvals.length > 3 && (
        <p className="text-xs text-text-tertiary text-center mt-3">
          +{approvals.length - 3} more pending
        </p>
      )}
    </div>
  );
}
