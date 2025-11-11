interface MetricCardProps {
  label: string;
  value: number | string;
  helper?: string;
  accent?: "warning" | "success" | "neutral" | "danger";
}

export function MetricCard({ label, value, helper, accent }: MetricCardProps) {
  const formattedValue = typeof value === "number" ? value.toLocaleString() : value;

  return (
    <article className="metric-card" data-accent={accent ?? "neutral"}>
      <h3>{label}</h3>
      <p className="value">{formattedValue}</p>
      {helper ? <p className="meta">{helper}</p> : null}
    </article>
  );
}

export default MetricCard;
