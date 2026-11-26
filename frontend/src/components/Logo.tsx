// ---------------------------------------------------------------------------
// The nodehub wordmark: "node" in the text color, "hub" in the brand color.
// The browser tab icon (public/favicon.svg) uses the same colors with "nh".
// ---------------------------------------------------------------------------

export default function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className={`font-semibold tracking-tight ${size === 'lg' ? 'text-3xl' : 'text-xl'}`}>
      node<span className="text-brand dark:text-brand-dark">hub</span>
    </span>
  )
}
