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
  const [complaints, setComplaints] = useState([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState(statusFilter);
  const [page, setPage] = useState(1);
  const [updateTarget, setUpdateTarget] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentOfficerId] = useState(() => getJwtPayload()?.userId || "");

  const loadComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await superAdminService.getComplaints({
        status: filterStatus,
        assignedToId: assignedOnly ? currentOfficerId : "",
        subCityId: scopeSubCityId,
        woredaId: scopeWoredaId,
      });
      setComplaints(Array.isArray(rows) ? rows : []);
    } finally {
      setLoading(false);
    }
  }, [
    assignedOnly,
    currentOfficerId,
    filterStatus,
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
        c.submittedBy?.fullName?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = !filterStatus || c.status === filterStatus;
      const matchAssigned =
        !assignedOnly || c.assignedTo?.id === currentOfficerId;
      return matchSearch && matchStatus && matchAssigned;
    });
  }, [complaints, search, filterStatus, assignedOnly, currentOfficerId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const updateStatus = async (id, status) => {
    setLoading(true);
    try {
      await superAdminService.updateComplaintStatus(id, status);
      await loadComplaints();
      setUpdateTarget(null);
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
    loading,
    updateTarget,
    setUpdateTarget,
    updateStatus,
    totalCount: filtered.length,
    allComplaints: complaints,
    STATUSES,
  };
}
