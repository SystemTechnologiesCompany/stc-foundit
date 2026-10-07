export function RadarLoader({ label = "Loading", size = "normal" }: { label?: string; size?: "small" | "normal" }) {
  return (
    <span className={`stc-radar-loader stc-radar-loader-${size}`} role="status" aria-label={label}>
      <span className="stc-radar-loader-core" aria-hidden="true" />
      <span className="stc-radar-loader-sweep" aria-hidden="true" />
    </span>
  );
}
