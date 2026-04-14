"use client";

import { useMemo, useState, useEffect } from "react";
import { getJwtPayload } from "@/services/apiClient";
import { useComplaints } from "@/features/complaint/hooks/useComplaints";
import { superAdminService } from "@/features/super-admin/services/superAdmin.service";

const ACTIVE_STATUSES = ["IN_PROGRESS", "ESCALATED"];

export default function ResolutionPage() {
  const payload = getJwtPayload() || {};
  const role = String(payload?.role || "").toUpperCase();
  const isWoredaComplaintOfficer = role === "WOREDA_COMPLAINT_OFFICER";

  const scopeArgs =
    role === "SUBCITY_COMPLAINT_OFFICER"
      ? { scopeSubCityId: payload?.subCityId || "" }
      : { scopeWoredaId: payload?.woredaId || "" };

  const { allComplaints, loading, reloadComplaints } = useComplaints(scopeArgs);

  const [fieldOfficers, setFieldOfficers] = useState([]);
  const [selectedOfficerByComplaint, setSelectedOfficerByComplaint] = useState(
    {},
  );
  const [submittingId, setSubmittingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [contactTarget, setContactTarget] = useState(null);
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");

  const complaints = useMemo(
    () => allComplaints.filter((item) => ACTIVE_STATUSES.includes(item.status)),
    [allComplaints],
  );

  useEffect(() => {
    const loadOfficers = async () => {
      if (!payload?.woredaId) {
        setFieldOfficers([]);
        return;
      }

      try {
        const rows = await superAdminService.getFieldOfficers({
          woredaId: payload.woredaId,
        });
        setFieldOfficers(Array.isArray(rows) ? rows : []);
      } catch {
        setFieldOfficers([]);
      }
    };

    void loadOfficers();
  }, [payload?.woredaId]);

  const runAction = async (complaintId, action) => {
    setError("");
    setSuccess("");
    setSubmittingId(complaintId);
    try {
      await action();
      await reloadComplaints();
      setSuccess("Complaint action completed successfully.");
    } catch (err) {
      setError(err?.message || "Action failed.");
    } finally {
      setSubmittingId("");
    }
  };

  const assignFieldOfficer = async (complaintId) => {
    const fieldOfficerId = selectedOfficerByComplaint[complaintId] || "";
    if (!fieldOfficerId) {
      setError("Please select a field officer before assigning.");
      return;
    }

    await runAction(complaintId, () =>
      superAdminService.assignComplaintFieldOfficer(
        complaintId,
        fieldOfficerId,
      ),
    );
  };

  const markResolved = async (complaintId) => {
    await runAction(complaintId, () =>
      superAdminService.updateComplaintStatus(complaintId, "RESOLVED"),
    );
  };

  const escalate = async (complaintId) => {
    await runAction(complaintId, () =>
      superAdminService.escalateComplaint(
        complaintId,
        "Not resolved at woreda level. Escalated to subcity complaint officer.",
      ),
    );
  };

  const sendContactMessage = async () => {
    if (!contactTarget) {
      return;
    }

    const subject = contactSubject.trim();
    const message = contactMessage.trim();

    if (!message) {
      setError("Please enter a message for the customer.");
      return;
    }

    await runAction(contactTarget.id, async () => {
      await superAdminService.contactComplaintCustomer(contactTarget.id, {
        subject,
        message,
        sendEmail: true,
        sendInApp: true,
      });
      setContactTarget(null);
      setContactSubject("");
      setContactMessage("");
    });
  };

  return (
    <div className="text-[#e8f4f0] space-y-4">
      {!isWoredaComplaintOfficer && (
        <div className="rounded-xl border border-[rgba(239,159,39,0.28)] bg-[rgba(239,159,39,0.08)] px-4 py-3 text-xs text-[#EF9F27]">
          Resolution actions are intended for woreda complaint officers.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-[rgba(226,75,74,0.28)] bg-[rgba(226,75,74,0.08)] px-4 py-3 text-xs text-[#E24B4A]">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-[rgba(29,158,117,0.28)] bg-[rgba(29,158,117,0.08)] px-4 py-3 text-xs text-[#5DCAA5]">
          {success}
        </div>
      )}

      <div className="bg-[#05141f] border border-[rgba(29,158,117,0.08)] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[rgba(29,158,117,0.08)]">
          <h2 className="font-syne font-bold text-sm tracking-tight">
            Resolution
          </h2>
          <p className="text-[10px] text-[rgba(232,244,240,0.35)] mt-1">
            Assign available woreda field officers, resolve complaints, escalate
            unresolved cases, and contact customers directly.
          </p>
        </div>

        <div className="overflow-x-auto px-6 py-4">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[rgba(29,158,117,0.06)]">
                {[
                  "Complaint",
                  "Customer",
                  "Status",
                  "Field Officer",
                  "Actions",
                ].map((header) => (
                  <th
                    key={header}
                    className="text-left text-[rgba(232,244,240,0.3)] font-medium pb-3 pr-4 uppercase tracking-wider text-[10px]"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {complaints.map((complaint) => {
                const disabled = submittingId === complaint.id || loading;
                return (
                  <tr
                    key={complaint.id}
                    className="border-b border-[rgba(29,158,117,0.04)] align-top"
                  >
                    <td className="py-3 pr-4 max-w-80">
                      <p className="font-medium text-[rgba(232,244,240,0.85)] truncate">
                        {complaint.title}
                      </p>
                      <p className="text-[9px] text-[rgba(232,244,240,0.35)] mt-0.5 truncate">
                        {complaint.description}
                      </p>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-[rgba(232,244,240,0.75)]">
                        {complaint.submittedBy?.fullName || "Unknown"}
                      </p>
                      <p className="text-[9px] text-[rgba(232,244,240,0.35)]">
                        {complaint.submittedBy?.email || "No email"}
                      </p>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-[rgba(29,158,117,0.12)] text-[#1D9E75]">
                        {complaint.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 min-w-56">
                      <p className="text-[10px] text-[rgba(232,244,240,0.45)] mb-1">
                        Current:{" "}
                        {complaint.assignedFieldOfficer?.fullName ||
                          "Unassigned"}
                      </p>
                      <select
                        value={selectedOfficerByComplaint[complaint.id] || ""}
                        onChange={(e) =>
                          setSelectedOfficerByComplaint((prev) => ({
                            ...prev,
                            [complaint.id]: e.target.value,
                          }))
                        }
                        className="w-full bg-[rgba(29,158,117,0.04)] border border-[rgba(29,158,117,0.1)] rounded-lg px-2 py-1.5 text-xs text-[#e8f4f0]"
                      >
                        <option value="">Select field officer</option>
                        {fieldOfficers.map((officer) => (
                          <option key={officer.id} value={officer.id}>
                            {officer.fullName}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-1 min-w-72">
                      <div className="flex flex-wrap gap-2">
                        <button
                          disabled={disabled || !isWoredaComplaintOfficer}
                          onClick={() => void assignFieldOfficer(complaint.id)}
                          className="px-3 py-1 rounded-lg text-[10px] bg-[rgba(29,158,117,0.08)] text-[#1D9E75] hover:bg-[rgba(29,158,117,0.18)] disabled:opacity-50"
                        >
                          Assign Officer
                        </button>
                        <button
                          disabled={disabled || !isWoredaComplaintOfficer}
                          onClick={() => void markResolved(complaint.id)}
                          className="px-3 py-1 rounded-lg text-[10px] bg-[rgba(55,138,221,0.12)] text-[#378ADD] hover:bg-[rgba(55,138,221,0.22)] disabled:opacity-50"
                        >
                          Mark Resolved
                        </button>
                        <button
                          disabled={disabled || !isWoredaComplaintOfficer}
                          onClick={() => void escalate(complaint.id)}
                          className="px-3 py-1 rounded-lg text-[10px] bg-[rgba(239,159,39,0.12)] text-[#EF9F27] hover:bg-[rgba(239,159,39,0.22)] disabled:opacity-50"
                        >
                          Escalate
                        </button>
                        <button
                          disabled={disabled || !isWoredaComplaintOfficer}
                          onClick={() => {
                            setContactTarget(complaint);
                            setContactSubject(
                              `Regarding your complaint: ${complaint.title}`,
                            );
                            setContactMessage("");
                          }}
                          className="px-3 py-1 rounded-lg text-[10px] bg-[rgba(214,83,126,0.12)] text-[#D4537E] hover:bg-[rgba(214,83,126,0.22)] disabled:opacity-50"
                        >
                          Contact Customer
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!complaints.length && (
            <p className="text-[11px] text-[rgba(232,244,240,0.35)] py-4">
              No active complaints found for resolution.
            </p>
          )}
        </div>
      </div>

      {contactTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#05141f] border border-[rgba(29,158,117,0.2)] rounded-2xl p-5">
            <h3 className="font-syne text-base font-bold mb-1">
              Contact Customer
            </h3>
            <p className="text-[11px] text-[rgba(232,244,240,0.45)] mb-4">
              Send both email and in-app notification to{" "}
              {contactTarget.submittedBy?.fullName || "customer"}.
            </p>

            <label className="block text-[10px] uppercase tracking-wider text-[rgba(232,244,240,0.45)] mb-1">
              Subject
            </label>
            <input
              value={contactSubject}
              onChange={(e) => setContactSubject(e.target.value)}
              className="w-full bg-[rgba(29,158,117,0.04)] border border-[rgba(29,158,117,0.1)] rounded-lg px-3 py-2 text-xs text-[#e8f4f0] mb-3"
            />

            <label className="block text-[10px] uppercase tracking-wider text-[rgba(232,244,240,0.45)] mb-1">
              Message
            </label>
            <textarea
              value={contactMessage}
              onChange={(e) => setContactMessage(e.target.value)}
              rows={6}
              className="w-full bg-[rgba(29,158,117,0.04)] border border-[rgba(29,158,117,0.1)] rounded-lg px-3 py-2 text-xs text-[#e8f4f0]"
              placeholder="Write your message to the customer..."
            />

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setContactTarget(null)}
                className="px-4 py-2 rounded-lg text-xs text-[rgba(232,244,240,0.7)] border border-[rgba(232,244,240,0.2)]"
              >
                Cancel
              </button>
              <button
                onClick={() => void sendContactMessage()}
                disabled={Boolean(submittingId)}
                className="px-4 py-2 rounded-lg text-xs bg-[#1D9E75] text-[#02131f] font-semibold hover:bg-[#5DCAA5] disabled:opacity-50"
              >
                {submittingId ? "Sending..." : "Send Message"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
