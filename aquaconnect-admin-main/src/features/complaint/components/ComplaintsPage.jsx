'use client';

import { useComplaints } from '../hooks/useComplaints';
import ComplaintsTable from './ComplaintsTable';
import UpdateStatusModal from './UpdateStatusModal';
import Pagination from '@/features/subcity-admins/components/Pagination';

const STATUSES = ['', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export default function ComplaintsPage({ assignedOnly = false, title, fixedStatus = '' }) {
  const {
    complaints, totalPages, page, setPage,
    search, setSearch,
    filterStatus, setFilterStatus,
    loading,
    updateTarget, setUpdateTarget,
    updateStatus,
    totalCount,
  } = useComplaints({ assignedOnly, statusFilter: fixedStatus });

  return (
    <div className="text-[#e8f4f0]">
      <div className="bg-[#05141f] border border-[rgba(29,158,117,0.08)] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(29,158,117,0.08)]">
          <div>
            <h2 className="font-syne font-bold text-sm tracking-tight">{title}</h2>
            <p className="text-[10px] text-[rgba(232,244,240,0.3)] mt-0.5">{totalCount} complaints found</p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 py-3 border-b border-[rgba(29,158,117,0.06)]">
          <div className="relative flex-1 max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(232,244,240,0.2)] text-xs">🔍</span>
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by title or customer..." className="w-full bg-[rgba(29,158,117,0.04)] border border-[rgba(29,158,117,0.1)] rounded-xl pl-8 pr-4 py-2 text-xs text-[#e8f4f0] placeholder-[rgba(232,244,240,0.2)] outline-none focus:border-[rgba(29,158,117,0.4)] transition-all" />
          </div>
          {!fixedStatus && (
            <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="bg-[rgba(29,158,117,0.04)] border border-[rgba(29,158,117,0.1)] rounded-xl px-3 py-2 text-xs text-[#e8f4f0] outline-none focus:border-[rgba(29,158,117,0.4)] transition-all">
              {STATUSES.map((s) => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
            </select>
          )}
          {(search || filterStatus) && (
            <button onClick={() => { setSearch(''); setFilterStatus(''); setPage(1); }} className="text-[10px] text-[rgba(232,244,240,0.3)] hover:text-[#E24B4A] transition-colors">Clear</button>
          )}
        </div>

        <div className="px-6 py-4">
          <ComplaintsTable
            complaints={complaints}
            onUpdate={setUpdateTarget}
            showUpdateBtn={assignedOnly}
          />
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </div>

      <UpdateStatusModal
        complaint={updateTarget}
        onClose={() => setUpdateTarget(null)}
        onConfirm={updateStatus}
        loading={loading}
      />
    </div>
  );
}