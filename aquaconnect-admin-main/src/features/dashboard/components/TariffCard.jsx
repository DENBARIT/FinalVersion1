export default function TariffCard({ tariff, loading = false }) {
  return (
    <div className="bg-[#05141f] border border-[rgba(29,158,117,0.08)] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-syne font-bold text-sm tracking-tight">
          Current Tariff
        </h3>
      </div>
      <div className="bg-[rgba(29,158,117,0.05)] border border-[rgba(29,158,117,0.15)] rounded-xl p-4 flex justify-between items-center">
        <div>
          <p className="font-syne text-4xl font-extrabold text-[#1D9E75] tracking-tight">
            {loading
              ? "..."
              : tariff
                ? Number(tariff.pricePerCubicMeter).toFixed(2)
                : "-"}
          </p>
          <p className="text-[10px] text-[rgba(232,244,240,0.35)] mt-1">
            ETB per m³
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-[rgba(232,244,240,0.3)]">
            Effective from
          </p>
          <p className="text-xs text-[#e8f4f0] mt-1">
            {loading
              ? "Loading..."
              : tariff
                ? new Date(tariff.effectiveFrom).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "No active tariff"}
          </p>
        </div>
      </div>
    </div>
  );
}
