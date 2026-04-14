"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getJwtPayload } from "@/services/apiClient";
import { superAdminService } from "@/features/super-admin/services/superAdmin.service";

const PAGE_SIZE = 5;
const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export function useComplaints({
  assignedOnly = false,
  statusFilter = "",
  scopeSubCityId = "",
  scopeWoredaId = "",
} = {}) {
  const jwtPayload = getJwtPayload() || {};
  const role = String(jwtPayload?.role || "").toUpperCase();
  const canUpdateStatus = role === "WOREDA_COMPLAINT_OFFICER";

  const [complaints, setComplaints] = useState([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState(statusFilter);
  const [filterCategory, setFilterCategory] = useState("");
  const [page, setPage] = useState(1);
  const [updateTarget, setUpdateTarget] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [currentOfficerId] = useState(() => getJwtPayload()?.userId || "");

  const loadComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await superAdminService.getComplaints({
        status: filterStatus,
        category: filterCategory,
        assignedToId: assignedOnly ? currentOfficerId : "",
        subCityId: scopeSubCityId,
        woredaId: scopeWoredaId,
      });
      setComplaints(Array.isArray(rows) ? rows : []);
    } catch (_error) {
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  }, [
    assignedOnly,
    currentOfficerId,
    filterStatus,
    filterCategory,
    scopeSubCityId,
    scopeWoredaId,
  ]);

  useEffect(() => {
    const timerId = setTimeout(() => {
      void loadComplaints();
    }, 0);

    return () => clearTimeout(timerId);
  }, [loadComplaints]);

  const filtered = useMemo(() => {
    return complaints.filter((c) => {
      const matchSearch =
        !search ||
        c.title?.toLowerCase().includes(search.toLowerCase()) ||
        c.submittedBy?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
        c.category?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = !filterStatus || c.status === filterStatus;
      const matchCategory = !filterCategory || c.category === filterCategory;
      const matchAssigned =
        !assignedOnly || c.assignedTo?.id === currentOfficerId;
      return matchSearch && matchStatus && matchCategory && matchAssigned;
    });
  }, [
    complaints,
    search,
    filterStatus,
    filterCategory,
    assignedOnly,
    currentOfficerId,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const updateStatus = async (id, status) => {
    setActionError("");

    if (!canUpdateStatus) {
      setActionError(
        "You are not allowed to update complaint status from this account.",
      );
      return;
    }

    setLoading(true);
    try {
      await superAdminService.updateComplaintStatus(id, status);
      await loadComplaints();
      setUpdateTarget(null);
    } catch (error) {
      if (error?.status === 403) {
        setActionError(
          "Forbidden: your role cannot update complaint status. Please use a woreda complaint officer account.",
        );
      } else {
        setActionError(
          error?.message || "Unable to update complaint status right now.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    complaints: paginated,
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
    reloadComplaints: loadComplaints,
    totalCount: filtered.length,
    allComplaints: complaints,
    newAssignedCount: complaints.filter(
      (c) => c.status === "OPEN" && c.assignedTo?.id === currentOfficerId,
    ).length,
    STATUSES,
  };
}
