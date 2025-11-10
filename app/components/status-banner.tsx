interface StatusBannerProps {
  message: string;
  variant?: "info" | "warning" | "error";
}

export function StatusBanner({ message, variant = "info" }: StatusBannerProps) {
  return (
    <div className={`status-banner status-banner--${variant}`}>
      <span>{message}</span>
    </div>
  );
}

export default StatusBanner;
