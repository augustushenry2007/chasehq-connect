export function formatAgo(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "moments ago";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(ms / 3_600_000);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}
