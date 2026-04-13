'use client';

import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';

const TYPE_STYLES = {
  BILLING_OFFICER:   'bg-[rgba(55,138,221,0.12)] text-[#378ADD]',
  COMPLAINT_OFFICER: 'bg-[rgba(212,83,126,0.12)] text-[#D4537E]',
};

export default function OfficerTable({ officers, onEdit, onDelete }) {
  if (!officers.length) return <EmptyState message="No field officers found." />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-[rgba(29,158,117,0.06)]">
            {['Name', 'Email', 'Phone', 'Type', 'Status', 'Created', 'Actions'].map((h) => (
              <th key={h} className="text-left text-[rgba(232,244,240,0.3)] font-medium pb-3 pr-4 uppercase tracking-wider text-[10px]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {officers.map((o) => (
            <tr key={o.id} className="border-b border-[rgba(29,158,117,0.04)] hover:bg-[rgba(29,158,117,0.03)] transition-colors">
              <td className="py-3 pr-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[rgba(29,158,117,0.15)] flex items-center justify-center text-[10px] font-syne font-bold text-[#1D9E75] shrink-0">
                    {o.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>
                  <span className="font-medium text-[rgba(232,244,240,0.85)]">{o.fullName}</span>
                </div>
              </td>
              <td className="py-3 pr-4 text-[rgba(232,244,240,0.5)]">{o.email}</td>
              <td className="py-3 pr-4 text-[rgba(232,244,240,0.5)]">{o.phoneE164}</td>
              <td className="py-3 pr-4">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium ${TYPE_STYLES[o.fieldOfficerType]}`}>
                  {o.fieldOfficerType === 'BILLING_OFFICER' ? 'Billing' : 'Complaint'}
                </span>
              </td>
              <td className="py-3 pr-4"><Badge status={o.status} /></td>
              <td className="py-3 pr-4 text-[rgba(232,244,240,0.4)]">{new Date(o.createdAt).toLocaleDateString()}</td>
              <td className="py-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => onEdit(o)} className="px-3 py-1 rounded-lg text-[10px] bg-[rgba(29,158,117,0.08)] text-[#1D9E75] hover:bg-[rgba(29,158,117,0.18)] transition-colors">Edit</button>
                  <button onClick={() => onDelete(o)} className="px-3 py-1 rounded-lg text-[10px] bg-[rgba(226,75,74,0.08)] text-[#E24B4A] hover:bg-[rgba(226,75,74,0.18)] transition-colors">Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}