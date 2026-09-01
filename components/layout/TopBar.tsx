import Link from "next/link";

export default function TopBar() {
  return (
    <header className="topbar">
      <Link className="brand" href="/" aria-label="A11yMCP home">
        <svg
          className="brand-mark"
          width="26"
          height="26"
          viewBox="0 0 64 64"
          fill="none"
          aria-hidden="true"
        >
          <rect x="2" y="2" width="60" height="60" rx="15" fill="#2b6cb0" />
          <rect
            x="9.5"
            y="9.5"
            width="45"
            height="45"
            rx="10"
            fill="none"
            stroke="#cfe4fb"
            strokeWidth="2"
            strokeDasharray="5.5 4.5"
            opacity="0.9"
          />
          <circle cx="32" cy="21" r="4.2" fill="#ffffff" />
          <path
            d="M18 29 H46 M32 28 V41 M32 41 L24 52 M32 41 L40 52"
            stroke="#ffffff"
            strokeWidth="4.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>A11yMCP</span>
      </Link>
      <nav aria-label="Primary">
        <Link href="/">Home</Link>
        <Link href="/demo">Demo</Link>
        <Link href="/inspector">Inspector</Link>
        {/* static HTML page (public/), not an app route */}
        <a href="/partner">Partner site</a>
      </nav>
    </header>
  );
}
