// ---------------------------------------------------------------------------
// Animated page background: a faint grid that fades towards the edges, with two soft brand-colored
// glows drifting slowly behind it. Purely decorative: fixed behind everything, ignores the mouse,
// hidden from screen readers, and still when the OS asks for reduced motion (see index.css).
// ---------------------------------------------------------------------------

export default function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="backdrop-glow backdrop-glow-a" />
      <div className="backdrop-glow backdrop-glow-b" />
      <div className="backdrop-grid" />
    </div>
  )
}
