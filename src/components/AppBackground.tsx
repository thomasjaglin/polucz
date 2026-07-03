export default function AppBackground() {
  return (
    <>
      <div
        className="app-bg-layer absolute inset-0 z-0"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(217, 217, 217, 0.52) 3px, transparent 3px)',
          backgroundSize: '10px 10px',
        }}
      />
      <div
        className="app-bg-layer absolute inset-0 z-10"
        style={{
          background: 'radial-gradient(62% 67.44% at 47.57% 50.05%, rgba(18, 18, 18, 0.99) 62.02%, rgba(18, 18, 18, 0.65) 100%)',
        }}
      />
    </>
  )
}
