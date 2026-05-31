import React, { useState, useEffect } from 'react';
import type { ApprovalRequest } from '../api/types';
import { getPendingApprovals, approveExecution, rejectExecution } from '../api/skills-api';
import { formatDistanceToNow } from 'date-fns';

export function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

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

  const handleApprove = async (id: string) => {
    setProcessing(id);
    await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate API call
    setApprovals((prev) => prev.filter((a) => a.id !== id));
    setProcessing(null);
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    setProcessing(id);
    await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate API call
    setApprovals((prev) => prev.filter((a) => a.id !== id));
    setSelectedId(null);
    setRejectReason('');
    setProcessing(null);
  };

  const getRiskBadge = (risk?: 'low' | 'medium' | 'high') => {
    if (!risk) return null;
    const config = {
      low: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20', label: 'Low Risk' },
      medium: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20', label: 'Medium Risk' },
      high: { bg: 'bg-error/10', text: 'text-error', border: 'border-error/20', label: 'High Risk' },
    };
    return config[risk];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Approval Queue</h1>
          <p className="text-text-tertiary mt-1">Review and approve pending skill execution requests</p>
        </div>
        <div className="flex items-center gap-4">
          {approvals.length > 0 && (
            <span className="badge-warning text-sm py-1.5 px-3">
              {approvals.length} pending
            </span>
          )}
        </div>
      </div>

      {/* Pending Approvals */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-24 bg-bg-elevated rounded" />
            </div>
          ))}
        </div>
      ) : approvals.length === 0 ? (
        <div className="card text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-text-secondary text-lg mb-2">All caught up!</p>
          <p className="text-text-tertiary text-sm">No pending approvals at the moment</p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((approval) => {
            const risk = getRiskBadge(approval.riskLevel);
            
            return (
              <div key={approval.id} className="card hover:border-border-default transition-colors">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                      <svg className="w-6 h-6 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-text-primary">{approval.skillName}</h3>
                      <p className="text-sm text-text-tertiary">
                        Requested by <span className="text-text-secondary">{approval.userId || 'Unknown'}</span>
                        {' · '}
                        {formatDistanceToNow(new Date(approval.requestedAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  {risk && (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${risk.bg} ${risk.text} ${risk.border}`}>
                      {risk.label}
                    </span>
                  )}
                </div>

                {/* Purpose */}
                {approval.purpose && (
                  <div className="mb-4 p-3 bg-bg-secondary rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-4 h-4 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs text-text-tertiary font-medium">Purpose</span>
                    </div>
                    <p className="text-sm text-text-secondary">{approval.purpose}</p>
                  </div>
                )}

                {/* Parameters Preview */}
                {approval.params && Object.keys(approval.params).length > 0 && (
                  <div className="mb-4">
                    <button
                      onClick={() => setSelectedId(selectedId === approval.id ? null : approval.id)}
                      className="text-sm text-accent-primary hover:text-accent-secondary flex items-center gap-1"
                    >
                      <svg className={`w-4 h-4 transition-transform ${selectedId === approval.id ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      {selectedId === approval.id ? 'Hide' : 'Show'} Parameters
                    </button>
                    {selectedId === approval.id && (
                      <div className="mt-2 bg-bg-primary rounded-lg p-3 border border-border-subtle">
                        <pre className="text-xs text-text-secondary font-mono overflow-x-auto">
                          {JSON.stringify(approval.params, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-border-subtle">
                  {processing === approval.id ? (
                    <div className="flex items-center gap-2 text-text-tertiary">
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing...
                    </div>
                  ) : selectedId === approval.id ? (
                    <div className="flex-1 space-y-3">
                      <input
                        type="text"
                        placeholder="Rejection reason (required)..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="input w-full"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReject(approval.id)}
                          className="btn-danger flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Confirm Reject
                        </button>
                        <button
                          onClick={() => {
                            setSelectedId(null);
                            setRejectReason('');
                          }}
                          className="btn-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleApprove(approval.id)}
                        className="btn-success flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Approve
                      </button>
                      <button
                        onClick={() => setSelectedId(approval.id)}
                        className="btn-danger flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
