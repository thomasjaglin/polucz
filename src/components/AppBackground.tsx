export default function AppBackground() {
  return (
    <div
      className="app-bg-layer absolute inset-0 z-10"
      style={{
        // Theme-driven: see --app-base in index.css.
        background: 'var(--app-base)',
      }}
    />
  )
}
