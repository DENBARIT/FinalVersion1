"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getJwtPayload } from "@/services/apiClient";
import { superAdminService } from "@/features/super-admin/services/superAdmin.service";

const PAGE_SIZE = 5;

export function useOfficers() {
  const [officers, setOfficers] = useState([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const woredaId = getJwtPayload()?.woredaId || "";

  const loadOfficers = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await superAdminService.getFieldOfficers({ woredaId });

      setOfficers(Array.isArray(rows) ? rows : []);
    } finally {
      setLoading(false);
    }
  }, [woredaId]);

  useEffect(() => {
    const timerId = setTimeout(() => {
      void loadOfficers();
    }, 0);

    return () => clearTimeout(timerId);
  }, [loadOfficers]);

  const filtered = useMemo(() => {
    return officers.filter((o) => {
      const matchSearch =
        !search ||
        o.fullName.toLowerCase().includes(search.toLowerCase()) ||
        o.email.toLowerCase().includes(search.toLowerCase());
      const matchType = !filterType || o.fieldOfficerType === filterType;
      const matchStatus = !filterStatus || o.status === filterStatus;
      return matchSearch && matchType && matchStatus;
    });
  }, [officers, search, filterType, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const createOfficer = async (data) => {
    setLoading(true);
    try {
      await superAdminService.createFieldOfficer({
        ...data,
        woredaId,
      });

      await loadOfficers();
    } finally {
      setLoading(false);
    }
  };

  const updateOfficer = async (id, data) => {
    setLoading(true);
    try {
      await superAdminService.updateFieldOfficer(id, data);

      await loadOfficers();
    } finally {
      setLoading(false);
    }
  };

  const deleteOfficer = async (id) => {
    setLoading(true);
    try {
      await superAdminService.deleteFieldOfficer(id);

      await loadOfficers();
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const headers = [
      "Name",
      "Email",
      "Phone",
      "National ID",
      "Type",
      "Status",
      "Created",
    ];
    const rows = filtered.map((o) => [
      o.fullName,
      o.email,
      o.phoneE164,
      o.nationalId,
      o.fieldOfficerType,
      o.status,
      new Date(o.createdAt).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "field-officers.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return {
    officers: paginated,
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
    totalCount: filtered.length,
    allOfficers: officers,
  };
}
