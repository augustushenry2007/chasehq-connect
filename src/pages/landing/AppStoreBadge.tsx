import { APP_STORE_URL } from "./constants";

type Props = { size?: "md" | "lg"; className?: string };

export default function AppStoreBadge({ size = "md", className = "" }: Props) {
  const dims = size === "lg" ? "h-14" : "h-12";
  return (
    <a
      href={APP_STORE_URL}
      aria-label="Download ChaseHQ on the App Store"
      className={`inline-flex transition-transform duration-200 ease-out hover:scale-[1.03] active:scale-[0.98] motion-reduce:transform-none ${className}`}
    >
      <svg
        viewBox="0 0 180 60"
        className={`${dims} w-auto`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-hidden="true"
      >
        <rect width="180" height="60" rx="10" fill="#000" />
        <path
          d="M37 22.4c-.6.7-1.5 1.3-2.5 1.2-.1-1 .4-2.1 1-2.7.6-.7 1.6-1.3 2.5-1.3.1 1 -.3 2.1-1 2.8zm1 1.5c-1.4-.1-2.6.8-3.2.8-.7 0-1.7-.8-2.8-.7-1.4 0-2.7.8-3.5 2.1-1.5 2.6-.4 6.4 1.1 8.5.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7 1.3 0 1.6.7 2.8.7 1.2 0 1.9-1 2.6-2 .8-1.2 1.2-2.3 1.2-2.4-.1 0-2.3-.9-2.3-3.5 0-2.2 1.8-3.2 1.9-3.3-1-1.5-2.6-1.6-3.3-1.6z"
          fill="#fff"
        />
        <text x="58" y="26" fontFamily="-apple-system, system-ui, sans-serif" fontSize="9" fill="#fff" opacity="0.9">
          Download on the
        </text>
        <text x="58" y="44" fontFamily="-apple-system, system-ui, sans-serif" fontSize="18" fontWeight="600" fill="#fff">
          App Store
        </text>
      </svg>
    </a>
  );
}
