// The app mark, in whichever ink the current theme needs.
//
// Two files rather than one recoloured by CSS: the logo is a solid silhouette,
// so a filter would have to invert it, and inverting a near-black to a
// near-white loses the exact ink the brand uses. The swap is the same
// display-toggle pattern the rest of the app uses for theme-paired elements —
// both are in the DOM, CSS picks one, and switching costs no re-render.

export default function Logo({ size = 64, className = '' }: { size?: number; className?: string }) {
  const common = 'object-contain'
  return (
    <>
      <img
        src="logo-light.png"
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className={`theme-light-only ${common} ${className}`}
        style={{ width: size, height: size }}
      />
      <img
        src="logo-dark.png"
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className={`theme-dark-only ${common} ${className}`}
        style={{ width: size, height: size }}
      />
    </>
  )
}
