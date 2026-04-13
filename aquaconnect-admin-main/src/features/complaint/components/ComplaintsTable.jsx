'use client';

import EmptyState from '@/components/ui/EmptyState';

const STATUS_STYLES = {
  OPEN:        'bg-[rgba(226,75,74,0.12)] text-[#E24B4A]',
  IN_PROGRESS: 'bg-[rgba(239,159,39,0.12)] text-[#EF9F27]',
  RESOLVED:    'bg-[rgba(29,158,117,0.12)] text-[#1D9E75]',
  CLOSED:      'bg-[rgba(136,135,128,0.12)] text-[#888780]',
};

export default function ComplaintsTable({ complaints, onUpdate, showUpdateBtn = true }) {
  if (!complaints.length) return <EmptyState message="No complaints found." />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-[rgba(29,158,117,0.06)]">
            {['Title', 'Submitted By', 'Assigned To', 'Status', 'Created', 'Updated', ...(showUpdateBtn ? ['Actions'] : [])].map((h) => (
              <th key={h} className="text-left text-[rgba(232,244,240,0.3)] font-medium pb-3 pr-4 uppercase tracking-wider text-[10px]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {complaints.map((c) => (
            <tr key={c.id} className="border-b border-[rgba(29,158,117,0.04)] hover:bg-[rgba(29,158,117,0.03)] transition-colors">
              <td className="py-3 pr-4 max-w-50">
                <p className="font-medium text-[rgba(232,244,240,0.85)] truncate">{c.title}</p>
                <p className="text-[9px] text-[rgba(232,244,240,0.35)] mt-0.5 truncate">{c.description}</p>
              </td>
              <td className="py-3 pr-4">
                <p className="text-[rgba(232,244,240,0.7)]">{c.submittedBy.fullName}</p>
                <p className="text-[9px] text-[rgba(232,244,240,0.35)]">{c.submittedBy.phoneE164}</p>
              </td>
              <td className="py-3 pr-4">
                {c.assignedTo ? (
                  <span className="px-2 py-0.5 rounded-md text-[10px] bg-[rgba(29,158,117,0.08)] text-[#1D9E75]">
                    {c.assignedTo.fullName}
                  </span>
                ) : (
                  <span className="text-[rgba(232,244,240,0.25)] text-[10px]">Unassigned</span>
                )}
              </td>
              <td className="py-3 pr-4">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] ${STATUS_STYLES[c.status]}`}>{c.status}</span>
              </td>
              <td className="py-3 pr-4 text-[rgba(232,244,240,0.4)]">{new Date(c.createdAt).toLocaleDateString()}</td>
              <td className="py-3 pr-4 text-[rgba(232,244,240,0.4)]">{new Date(c.updatedAt).toLocaleDateString()}</td>
              {showUpdateBtn && (
                <td className="py-3">
                  {c.status !== 'RESOLVED' && c.status !== 'CLOSED' && (
                    <button
                      onClick={() => onUpdate(c)}
                      className="px-3 py-1 rounded-lg text-[10px] bg-[rgba(29,158,117,0.08)] text-[#1D9E75] hover:bg-[rgba(29,158,117,0.18)] transition-colors"
                    >
                      Update
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}