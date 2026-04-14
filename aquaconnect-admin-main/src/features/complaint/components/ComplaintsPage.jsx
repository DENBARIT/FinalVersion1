"use client";

import { useMemo, useState } from "react";
import { useComplaints } from "../hooks/useComplaints";
import { getJwtPayload } from "@/services/apiClient";
import ComplaintsTable from "./ComplaintsTable";
import UpdateStatusModal from "./UpdateStatusModal";
import ComplaintDetailsModal from "./ComplaintDetailsModal";
import Pagination from "@/features/subcity-admins/components/Pagination";

const STATUSES = ["", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const FALLBACK_CATEGORIES = ["NO_WATER", "WATER_SUPPLY", "LEAKAGE", "OTHER"];

const labelize = (value = "") =>
  String(value)
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const STATUS_CARD_STYLES = {
  OPEN: "bg-[rgba(226,75,74,0.14)] border-[rgba(226,75,74,0.35)] shadow-[0_12px_28px_rgba(226,75,74,0.18)]",
  IN_PROGRESS:
    "bg-[rgba(239,159,39,0.12)] border-[rgba(239,159,39,0.28)] shadow-[0_12px_28px_rgba(239,159,39,0.12)]",
  RESOLVED:
    "bg-[rgba(29,158,117,0.12)] border-[rgba(29,158,117,0.28)] shadow-[0_12px_28px_rgba(29,158,117,0.12)]",
};

export default function ComplaintsPage({
  assignedOnly = false,
  title,
  fixedStatus = "",
}) {
  const jwtPayload = getJwtPayload() || {};
  const role = String(jwtPayload?.role || "").toUpperCase();
  const isSubcityComplaintOfficer = role === "SUBCITY_COMPLAINT_OFFICER";

  const scopeArgs = isSubcityComplaintOfficer
    ? { scopeSubCityId: jwtPayload?.subCityId || "" }
    : { scopeWoredaId: jwtPayload?.woredaId || "" };

  const {
    complaints,
    allComplaints,
    totalPages,
    page,
    setPage,
    search,
    setSearch,
    filterStatus,
    setFilterStatus,
    filterCategory,
    setFilterCategory,
    loading,
    actionError,
    setActionError,
    canUpdateStatus,
    updateTarget,
    setUpdateTarget,
    updateStatus,
    totalCount,
    newAssignedCount,
  } = useComplaints({ assignedOnly, statusFilter: fixedStatus, ...scopeArgs });

  const [viewTarget, setViewTarget] = useState(null);

  const categoryOptions = useMemo(() => {
    const fromRows = Array.from(
      new Set((allComplaints || []).map((c) => c?.category).filter(Boolean)),
    );
    const merged = Array.from(new Set([...fromRows, ...FALLBACK_CATEGORIES]));
    return ["", ...merged];
  }, [allComplaints]);

  const statusSummary = useMemo(() => {
    return {
      OPEN: (allComplaints || []).filter((c) => c.status === "OPEN").length,
      IN_PROGRESS: (allComplaints || []).filter(
        (c) => c.status === "IN_PROGRESS",
      ).length,
      RESOLVED: (allComplaints || []).filter((c) => c.status === "RESOLVED")
        .length,
    };
  }, [allComplaints]);

  return (
    <div className="text-[#e8f4f0]">
      {actionError ? (
        <div className="mb-4 rounded-xl border border-[rgba(226,75,74,0.35)] bg-[#2a1211] px-4 py-3 text-xs text-[#ff9c9b]">
          {actionError}
        </div>
      ) : null}

      {assignedOnly && !canUpdateStatus ? (
        <div className="mb-4 rounded-xl border border-[rgba(55,138,221,0.3)] bg-[rgba(12,28,40,0.85)] px-4 py-3 text-xs text-[#9fd3ff]">
          Your account can view assigned complaints, but status updates are
          restricted.
        </div>
      ) : null}

      <div className="bg-[#05141f] border border-[rgba(29,158,117,0.08)] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(29,158,117,0.08)]">
          <div>
            <h2 className="font-syne font-bold text-sm tracking-tight flex items-center gap-2">
              <span>{title}</span>
              {assignedOnly && newAssignedCount > 0 && (
                <span className="inline-flex min-w-5 h-5 px-1.5 items-center justify-center rounded-full bg-[#E24B4A] text-white text-[10px] font-bold">
                  {newAssignedCount}
                </span>
              )}
            </h2>
            <p className="text-[10px] text-[rgba(232,244,240,0.3)] mt-0.5">
              {totalCount} complaints found
            </p>
          </div>
        </div>

        {!assignedOnly && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-6 py-4 border-b border-[rgba(29,158,117,0.06)]">
            {[
              ["OPEN", "New Complaints", statusSummary.OPEN],
              ["IN_PROGRESS", "In Progress", statusSummary.IN_PROGRESS],
              ["RESOLVED", "Resolved", statusSummary.RESOLVED],
            ].map(([status, label, count]) => (
              <div
                key={status}
                className={`rounded-xl border p-3 ${STATUS_CARD_STYLES[status]}`}
              >
                <p className="text-[10px] uppercase tracking-widest text-[rgba(232,244,240,0.72)]">
                  {label}
                </p>
                <p className="font-syne text-2xl font-bold mt-1">{count}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 px-6 py-3 border-b border-[rgba(29,158,117,0.06)]">
          <div className="relative flex-1 max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(232,244,240,0.2)] text-xs">
              🔍
            </span>
            <input
              suppressHydrationWarning
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by title or customer..."
              className="w-full bg-[rgba(29,158,117,0.04)] border border-[rgba(29,158,117,0.1)] rounded-xl pl-8 pr-4 py-2 text-xs text-[#e8f4f0] placeholder-[rgba(232,244,240,0.2)] outline-none focus:border-[rgba(29,158,117,0.4)] transition-all"
            />
          </div>
          {!fixedStatus && (
            <select
              suppressHydrationWarning
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
          )}
          <select
            suppressHydrationWarning
            value={filterCategory}
            onChange={(e) => {
              setFilterCategory(e.target.value);
              setPage(1);
            }}
            className="bg-[rgba(29,158,117,0.04)] border border-[rgba(29,158,117,0.1)] rounded-xl px-3 py-2 text-xs text-[#e8f4f0] outline-none focus:border-[rgba(29,158,117,0.4)] transition-all"
          >
            {categoryOptions.map((category) => (
              <option key={category || "ALL_CATEGORIES"} value={category}>
                {category ? labelize(category) : "All Types"}
              </option>
            ))}
          </select>
          {(search || filterStatus || filterCategory) && (
            <button
              onClick={() => {
                setSearch("");
                setFilterStatus("");
                setFilterCategory("");
                setActionError("");
                setPage(1);
              }}
              className="text-[10px] text-[rgba(232,244,240,0.3)] hover:text-[#E24B4A] transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <div className="px-6 py-4">
          <ComplaintsTable
            complaints={complaints}
            onUpdate={setUpdateTarget}
            onView={setViewTarget}
            showUpdateBtn={assignedOnly && canUpdateStatus}
            showViewBtn
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      </div>

      <UpdateStatusModal
        complaint={updateTarget}
        onClose={() => setUpdateTarget(null)}
        onConfirm={updateStatus}
        loading={loading}
      />

      <ComplaintDetailsModal
        complaint={viewTarget}
        onClose={() => setViewTarget(null)}
      />
    </div>
  );
}
