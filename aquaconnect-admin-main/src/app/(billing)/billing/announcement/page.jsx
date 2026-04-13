"use client";

export default function BillingAnnouncementPage() {
  return (
    <div className="text-[#e8f4f0]">
      <div className="bg-[#05141f] border border-[rgba(29,158,117,0.08)] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(29,158,117,0.08)]">
          <div>
            <h2 className="font-syne font-bold text-sm tracking-tight">
              Announcement
            </h2>
            <p className="text-[10px] text-[rgba(232,244,240,0.3)] mt-0.5">
              Post billing notices and service updates
            </p>
          </div>
        </div>

        <div className="px-6 py-6 space-y-3 text-sm text-[rgba(232,244,240,0.72)]">
          <p>
            This section can be used for billing announcements such as payment
            reminders, service interruptions, and OCR schedule updates.
          </p>
          <div className="rounded-xl border border-[rgba(29,158,117,0.08)] bg-[rgba(29,158,117,0.03)] p-4 text-xs text-[rgba(232,244,240,0.55)]">
            No announcements are configured yet.
          </div>
        </div>
      </div>
    </div>
  );
}
