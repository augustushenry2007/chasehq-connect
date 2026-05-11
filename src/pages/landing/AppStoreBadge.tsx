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
        viewBox="0 0 160 54"
        className={`${dims} w-auto`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-hidden="true"
      >
        <rect width="160" height="54" rx="9" fill="#000" />
        <rect width="160" height="54" rx="9" fill="none" stroke="#6e6e6e" strokeWidth="1" />
        <g transform="translate(6, 8) scale(1.65)">
          <path
            d="M14.5 6.4c-.6.7-1.5 1.3-2.5 1.2-.1-1 .4-2.1 1-2.7.6-.7 1.6-1.3 2.5-1.3.1 1-.3 2.1-1 2.8zm1 1.5c-1.4-.1-2.6.8-3.2.8-.7 0-1.7-.8-2.8-.7-1.4 0-2.7.8-3.5 2.1-1.5 2.6-.4 6.4 1.1 8.5.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7 1.3 0 1.6.7 2.8.7 1.2 0 1.9-1 2.6-2 .8-1.2 1.2-2.3 1.2-2.4-.1 0-2.3-.9-2.3-3.5 0-2.2 1.8-3.2 1.9-3.3-1-1.5-2.6-1.6-3.3-1.6z"
            fill="#fff"
          />
        </g>
        <text
          x="50"
          y="22"
          fontFamily="-apple-system, SF Pro Display, Helvetica Neue, sans-serif"
          fontSize="11"
          letterSpacing="0.3"
          fill="#fff"
        >
          Download on the
        </text>
        <text
          x="49"
          y="42"
          fontFamily="-apple-system, SF Pro Display, Helvetica Neue, sans-serif"
          fontSize="22"
          fontWeight="600"
          letterSpacing="-0.3"
          fill="#fff"
        >
          App Store
        </text>
      </svg>
    </a>
  );
}
