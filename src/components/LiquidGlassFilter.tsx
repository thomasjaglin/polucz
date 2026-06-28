export default function LiquidGlassFilter() {
  return (
    <svg className="absolute w-0 h-0 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/*
          Displacement-only filter. Blur and saturation are handled by
          backdrop-filter on the .kube-glass-bg::before pseudo-element so
          this works in Chrome/WebView, not just Firefox.
          scale is tuned low (15px) because the SourceGraphic here is already
          blurred — high displacement on blurred input looks muddy.
        */}
        <filter id="kube-displace-only" x="-20%" y="-20%" width="140%" height="140%">
          {/* Same noise map feeds both displacement and specular so the
              light catches exactly the same bumps that cause the wobble. */}
          <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves={2} result="noise" />

          {/* Displace the blurred backdrop */}
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={15} xChannelSelector="R" yChannelSelector="G" result="displaced" />

          {/* Specular highlights from the noise surface */}
          <feSpecularLighting in="noise" surfaceScale={3} specularConstant={1.2} specularExponent={40} lightingColor="#ffffff" result="specular_raw">
            <feDistantLight azimuth={90} elevation={45} />
          </feSpecularLighting>

          {/* Remap to white with luminance-driven alpha */}
          <feColorMatrix in="specular_raw" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.33 0.33 0.33 0 0" result="specular_layer" />

          {/* Fade to a subtle sheen (slope controls intensity) */}
          <feComponentTransfer in="specular_layer" result="specular_faded">
            <feFuncA type="linear" slope={0.2} />
          </feComponentTransfer>

          {/* Composite specular over displaced result */}
          <feBlend in="specular_faded" in2="displaced" mode="normal" />
        </filter>
      </defs>
    </svg>
  )
}
