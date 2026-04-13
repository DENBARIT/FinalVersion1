"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTariff } from "@/features/billing/hooks/useBilling";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";

export default function TariffPage() {
  const { tariffs, effectiveTariff, loading, setTariff } = useTariff();
  const [modalOpen, setModalOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    await setTariff(data);
    reset();
    setModalOpen(false);
  };

  return (
    <div className="text-[#e8f4f0]">
      {/* Current Tariff Hero */}
      <div className="bg-[#05141f] border border-[rgba(29,158,117,0.12)] rounded-2xl p-8 mb-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_80%_50%,rgba(29,158,117,0.06),transparent)]" />
        <div className="relative flex items-center justify-between flex-wrap gap-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-[rgba(29,158,117,0.1)] border border-[rgba(29,158,117,0.2)] rounded-full px-3 py-1 text-[10px] text-[#1D9E75] mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E75] animate-pulse" />
              Currently Active Tariff
            </div>
            {effectiveTariff ? (
              <>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-syne text-6xl font-extrabold text-[#1D9E75] tracking-tight">
                    {effectiveTariff.pricePerCubicMeter.toFixed(2)}
                  </span>
                  <span className="text-[rgba(232,244,240,0.4)] text-sm">
                    ETB / m³
                  </span>
                </div>
                <p className="text-xs text-[rgba(232,244,240,0.4)]">
                  Effective from{" "}
                  <span className="text-[#e8f4f0]">
                    {new Date(effectiveTariff.effectiveFrom).toLocaleDateString(
                      "en-GB",
                      {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      },
                    )}
                  </span>
                </p>
              </>
            ) : (
              <p className="text-sm text-[rgba(232,244,240,0.4)]">
                No active tariff found.
              </p>
            )}
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="bg-[#1D9E75] text-[#020f1a] font-syne font-bold px-8 py-3.5 rounded-xl hover:bg-[#5DCAA5] transition-all hover:-translate-y-0.5 text-sm"
          >
            + Set New Tariff
          </button>
        </div>
      </div>

      {/* Tariff History */}
      <div className="bg-[#05141f] border border-[rgba(29,158,117,0.08)] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[rgba(29,158,117,0.08)]">
          <h2 className="font-syne font-bold text-sm tracking-tight">
            Tariff History
          </h2>
          <p className="text-[10px] text-[rgba(232,244,240,0.3)] mt-0.5">
            {tariffs.length} tariffs set
          </p>
        </div>
        <div className="px-6 py-4 overflow-x-auto">
          {loading && !tariffs.length ? (
            <p className="text-xs text-[rgba(232,244,240,0.5)]">
              Loading tariffs...
            </p>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-[rgba(29,158,117,0.06)]">
                  {["Price (ETB/m³)", "Effective From", "Set On", "Status"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left text-[rgba(232,244,240,0.3)] font-medium pb-3 pr-4 uppercase tracking-wider text-[10px]"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {[...tariffs]
                  .sort(
                    (a, b) =>
                      new Date(b.effectiveFrom) - new Date(a.effectiveFrom),
                  )
                  .map((t) => {
                    const isActive = effectiveTariff?.id === t.id;
                    const isFuture = new Date(t.effectiveFrom) > new Date();
                    return (
                      <tr
                        key={t.id}
                        className="border-b border-[rgba(29,158,117,0.04)] hover:bg-[rgba(29,158,117,0.03)] transition-colors"
                      >
                        <td className="py-3 pr-4">
                          <span
                            className={`font-syne font-bold text-base tracking-tight ${isActive ? "text-[#1D9E75]" : "text-[rgba(232,244,240,0.6)]"}`}
                          >
                            {t.pricePerCubicMeter.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-[rgba(232,244,240,0.6)]">
                          {new Date(t.effectiveFrom).toLocaleDateString(
                            "en-GB",
                            {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            },
                          )}
                        </td>
                        <td className="py-3 pr-4 text-[rgba(232,244,240,0.4)]">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3">
                          {isActive ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] bg-[rgba(29,158,117,0.12)] text-[#1D9E75] font-medium">
                              Active
                            </span>
                          ) : isFuture ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] bg-[rgba(239,159,39,0.12)] text-[#EF9F27]">
                              Scheduled
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] bg-[rgba(232,244,240,0.05)] text-[rgba(232,244,240,0.3)]">
                              Expired
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Set Tariff Modal */}
      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          reset();
        }}
        title="Set New Tariff"
      >
        <p className="text-xs text-[rgba(232,244,240,0.4)] font-light mb-5 leading-relaxed">
          Set a new tariff rate and the date it becomes effective. Future dates
          will be scheduled automatically.
        </p>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormField
            label="Price per m³ (ETB)"
            error={errors.pricePerM3?.message}
          >
            <Input
              type="number"
              step="0.01"
              placeholder="e.g. 15.00"
              error={errors.pricePerM3}
              {...register("pricePerM3", {
                required: "Price is required.",
                min: { value: 0.01, message: "Price must be greater than 0." },
                valueAsNumber: true,
              })}
            />
          </FormField>
          <FormField
            label="Effective from"
            error={errors.effectiveFrom?.message}
          >
            <Input
              type="datetime-local"
              error={errors.effectiveFrom}
              {...register("effectiveFrom", {
                required: "Effective date is required.",
              })}
            />
          </FormField>
          <div className="bg-[rgba(239,159,39,0.08)] border border-[rgba(239,159,39,0.2)] rounded-xl p-3 mb-5">
            <p className="text-[10px] text-[#EF9F27] leading-relaxed">
              ⚠️ Setting a tariff with a past date will make it immediately
              active and override the current tariff.
            </p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1D9E75] text-[#020f1a] font-syne font-bold py-3 rounded-xl hover:bg-[#5DCAA5] transition-all disabled:opacity-60 disabled:cursor-not-allowed text-sm"
          >
            {loading ? "Setting Tariff..." : "Set Tariff"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
