export default function TopBar() {
  return (
    <header className="topbar">
      <span className="brand">A11yMCP</span>
      <nav aria-label="Primary">
        <a href="/">Home</a>
        <a href="/demo">Demo</a>
        <a href="/inspector">Inspector</a>
      </nav>
    </header>
  );
}