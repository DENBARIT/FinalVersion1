"use client";

import { useMemo, useState } from "react";
import { useOfficers } from "@/features/woreda/hooks/useOfficers";
import OfficerTable from "@/features/woreda/components/OfficerTable";
import OfficerForm from "@/features/woreda/components/OfficerForm";
import Pagination from "@/features/subcity-admins/components/Pagination";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";

const STATUSES = ["", "ACTIVE", "SUSPENDED", "DEACTIVATED"];

export default function BillingOfficersPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { allOfficers, loading, createOfficer, updateOfficer, deleteOfficer } =
    useOfficers();

  const billingOfficers = useMemo(() => {
    return allOfficers
      .filter((o) => o.fieldOfficerType === "BILLING_OFFICER")
      .filter((o) => {
        const matchSearch =
          !search ||
          o.fullName.toLowerCase().includes(search.toLowerCase()) ||
          o.email.toLowerCase().includes(search.toLowerCase());
        const matchStatus = !filterStatus || o.status === filterStatus;
        return matchSearch && matchStatus;
      });
  }, [allOfficers, search, filterStatus]);

  const PAGE_SIZE = 5;
  const totalPages = Math.max(1, Math.ceil(billingOfficers.length / PAGE_SIZE));
  const officers = billingOfficers.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const handleCreate = async (data) => {
    await createOfficer({ ...data, fieldOfficerType: "BILLING_OFFICER" });
    setCreateOpen(false);
  };

  const handleUpdate = async (data) => {
    await updateOfficer(editTarget.id, {
      ...data,
      fieldOfficerType: "BILLING_OFFICER",
    });
    setEditTarget(null);
  };

  const handleDelete = async () => {
    await deleteOfficer(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="text-[#e8f4f0]">
      <div className="bg-[#05141f] border border-[rgba(29,158,117,0.08)] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(29,158,117,0.08)]">
          <div>
            <h2 className="font-syne font-bold text-sm tracking-tight">
              Billing Officers
            </h2>
            <p className="text-[10px] text-[rgba(232,244,240,0.3)] mt-0.5">
              {billingOfficers.length} officers found
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 rounded-xl text-xs bg-[#1D9E75] text-[#020f1a] font-medium hover:bg-[#5DCAA5] transition-colors"
          >
            + Add Officer
          </button>
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
        title="Add Billing Officer"
      >
        <OfficerForm
          onSubmit={handleCreate}
          loading={loading}
          defaultValues={{ fieldOfficerType: "BILLING_OFFICER" }}
        />
      </Modal>

      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Billing Officer"
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
        title="Delete Billing Officer"
        message={`Are you sure you want to delete ${deleteTarget?.fullName}? This action cannot be undone.`}
      />
    </div>
  );
}
