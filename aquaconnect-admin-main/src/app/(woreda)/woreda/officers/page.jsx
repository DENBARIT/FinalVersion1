"use client";

import { useState } from "react";
import { useOfficers } from "@/features/woreda/hooks/useOfficers";
import OfficerTable from "@/features/woreda/components/OfficerTable";
import OfficerForm from "@/features/woreda/components/OfficerForm";
import Pagination from "@/features/subcity-admins/components/Pagination";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";

const TYPES = ["", "BILLING_OFFICER", "COMPLAINT_OFFICER"];
const STATUSES = ["", "ACTIVE", "SUSPENDED", "DEACTIVATED"];

export default function FieldOfficersPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const {
    officers,
    totalPages,
    page,
    setPage,
    search,
    setSearch,
    filterType,
    setFilterType,
    filterStatus,
    setFilterStatus,
    loading,
    createOfficer,
    updateOfficer,
    deleteOfficer,
    exportCSV,
    totalCount,
    allOfficers,
  } = useOfficers();

  const handleCreate = async (data) => {
    await createOfficer(data);
    setCreateOpen(false);
  };
  const handleUpdate = async (data) => {
    await updateOfficer(editTarget.id, data);
    setEditTarget(null);
  };
  const handleDelete = async () => {
    await deleteOfficer(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="text-[#e8f4f0]">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          ["Total Officers", allOfficers.length, "under your woreda"],
          [
            "Billing Officers",
            allOfficers.filter((o) => o.fieldOfficerType === "BILLING_OFFICER")
              .length,
            "handle meter readings",
          ],
          [
            "Complaint Officers",
            allOfficers.filter(
              (o) => o.fieldOfficerType === "COMPLAINT_OFFICER",
            ).length,
            "handle complaints",
          ],
        ].map(([label, value, sub]) => (
          <div
            key={label}
            className="bg-[#05141f] border border-[rgba(29,158,117,0.08)] rounded-xl p-5"
          >
            <p className="text-[10px] uppercase tracking-widest text-[rgba(232,244,240,0.35)] mb-2">
              {label}
            </p>
            <p className="font-syne text-3xl font-bold tracking-tight">
              {value}
            </p>
            <p className="text-[10px] text-[#1D9E75] mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Main Card */}
      <div className="bg-[#05141f] border border-[rgba(29,158,117,0.08)] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(29,158,117,0.08)]">
          <div>
            <h2 className="font-syne font-bold text-sm tracking-tight">
              Field Officers
            </h2>
            <p className="text-[10px] text-[rgba(232,244,240,0.3)] mt-0.5">
              {totalCount} officers found
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="px-4 py-2 rounded-xl text-xs border border-[rgba(29,158,117,0.15)] text-[rgba(232,244,240,0.5)] hover:text-[#1D9E75] hover:border-[rgba(29,158,117,0.35)] transition-all"
            >
              Export CSV
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              className="px-4 py-2 rounded-xl text-xs bg-[#1D9E75] text-[#020f1a] font-medium hover:bg-[#5DCAA5] transition-colors"
            >
              + Add Officer
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 py-3 border-b border-[rgba(29,158,117,0.06)]">
          <div className="relative flex-1 max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(232,244,240,0.2)] text-xs">
              🔍
            </span>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name or email..."
              className="w-full bg-[rgba(29,158,117,0.04)] border border-[rgba(29,158,117,0.1)] rounded-xl pl-8 pr-4 py-2 text-xs text-[#e8f4f0] placeholder-[rgba(232,244,240,0.2)] outline-none focus:border-[rgba(29,158,117,0.4)] transition-all"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setPage(1);
            }}
            className="bg-[rgba(29,158,117,0.04)] border border-[rgba(29,158,117,0.1)] rounded-xl px-3 py-2 text-xs text-[#e8f4f0] outline-none focus:border-[rgba(29,158,117,0.4)] transition-all"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t
                  ? t === "BILLING_OFFICER"
                    ? "Billing Officers"
                    : "Complaint Officers"
                  : "All Types"}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
            className="bg-[rgba(29,158,117,0.04)] border border-[rgba(29,158,117,0.1)] rounded-xl px-3 py-2 text-xs text-[#e8f4f0] outline-none focus:border-[rgba(29,158,117,0.4)] transition-all"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s || "All Statuses"}
              </option>
            ))}
          </select>
          {(search || filterType || filterStatus) && (
            <button
              onClick={() => {
                setSearch("");
                setFilterType("");
                setFilterStatus("");
                setPage(1);
              }}
              className="text-[10px] text-[rgba(232,244,240,0.3)] hover:text-[#E24B4A] transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <div className="px-6 py-4">
          <OfficerTable
            officers={officers}
            onEdit={setEditTarget}
            onDelete={setDeleteTarget}
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add Field Officer"
      >
        <OfficerForm onSubmit={handleCreate} loading={loading} />
      </Modal>
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Field Officer"
      >
        <OfficerForm
          onSubmit={handleUpdate}
          defaultValues={editTarget}
          loading={loading}
        />
      </Modal>
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={loading}
        title="Delete Field Officer"
        message={`Are you sure you want to delete ${deleteTarget?.fullName}? This action cannot be undone.`}
      />
    </div>
  );
}
