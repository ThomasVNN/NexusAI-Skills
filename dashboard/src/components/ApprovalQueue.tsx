import React, { useState, useEffect } from 'react';
import type { ApprovalRequest } from '../api/types';
import { formatDistanceToNow } from 'date-fns';

interface ApprovalQueueProps {
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

export function ApprovalQueue({ onApprove, onReject }: ApprovalQueueProps) {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    fetchApprovals();
    const interval = setInterval(fetchApprovals, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchApprovals = async () => {
    try {
      const response = await fetch('/api/skills/approvals/pending');
      const data = await response.json();
      setApprovals(data);
    } catch (error) {
      console.error('Failed to fetch approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await fetch(`/api/skills/executions/${id}/approve`, { method: 'POST' });
      setApprovals((prev) => prev.filter((a) => a.id !== id));
      onApprove?.(id);
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    try {
      await fetch(`/api/skills/executions/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason }),
      });
      setApprovals((prev) => prev.filter((a) => a.id !== id));
      setSelectedId(null);
      setRejectReason('');
      onReject?.(id);
    } catch (error) {
      console.error('Failed to reject:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Approval Queue</h2>
        <span className="badge-warning">{approvals.length} pending</span>
      </div>

      {loading ? (
        <div className="card text-center py-8 text-slate-400">Loading...</div>
      ) : approvals.length === 0 ? (
        <div className="card text-center py-8">
          <svg className="w-12 h-12 mx-auto text-slate-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-slate-400">No pending approvals</p>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map((approval) => (
            <div key={approval.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-medium text-white">{approval.skillName}</h3>
                    <span className="badge-info">{approval.skillId}</span>
                  </div>
                  <p className="text-sm text-slate-400 mb-2">
                    Requested {formatDistanceToNow(new Date(approval.requestedAt), { addSuffix: true })}
                  </p>
                  {approval.userId && (
                    <p className="text-sm text-slate-500">User: {approval.userId}</p>
                  )}
                  {approval.params && Object.keys(approval.params).length > 0 && (
                    <div className="mt-2">
                      <button
                        onClick={() => setSelectedId(selectedId === approval.id ? null : approval.id)}
                        className="text-sm text-primary-400 hover:text-primary-300"
                      >
                        {selectedId === approval.id ? 'Hide' : 'Show'} Parameters
                      </button>
                      {selectedId === approval.id && (
                        <pre className="mt-2 p-3 bg-slate-900 rounded-lg text-sm text-slate-300 overflow-x-auto">
                          {JSON.stringify(approval.params, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 ml-4">
                  <button
                    onClick={() => handleApprove(approval.id)}
                    className="btn-success flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Approve
                  </button>
                  {selectedId === approval.id ? (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        placeholder="Rejection reason..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="input text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReject(approval.id)}
                          className="btn-danger flex-1 text-sm"
                        >
                          Confirm Reject
                        </button>
                        <button
                          onClick={() => {
                            setSelectedId(null);
                            setRejectReason('');
                          }}
                          className="btn-secondary text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSelectedId(approval.id)}
                      className="btn-danger flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Reject
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
