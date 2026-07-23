import { useEffect, useRef, useState } from 'react'
import type { MotionValue } from 'framer-motion'
import { generateGlassMap, GLASS_OVERSCAN, type GlassMaps } from '../lib/generateGlassMap'
import { getGlassMode } from '../lib/glassMode'
import { registerPane } from '../webgl/glassStore'

let counter = 0

function getSvgDefs(): SVGDefsElement {
  let svg = document.getElementById('kube-glass-filters') as SVGSVGElement | null
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.id = 'kube-glass-filters'
    svg.setAttribute('style', 'position:absolute;width:0;height:0;pointer-events:none')
    document.body.prepend(svg)
  }
  let defs = svg.querySelector('defs')
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
    svg.appendChild(defs)
  }
  return defs as SVGDefsElement
}

export function upsertFilter(id: string, maps: GlassMaps, w: number, h: number) {
  const defs = getSvgDefs()
  let filter = defs.querySelector(`#${id}`) as SVGFilterElement | null

  if (!filter) {
    filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter')
    filter.id = id
    filter.setAttribute('color-interpolation-filters', 'sRGB')
    filter.setAttribute('x', '-15%')
    filter.setAttribute('y', '-15%')
    filter.setAttribute('width', '130%')
    filter.setAttribute('height', '130%')

    const feMap = document.createElementNS('http://www.w3.org/2000/svg', 'feImage')
    feMap.setAttribute('result', 'map')
    filter.appendChild(feMap)

    const feDisplace = document.createElementNS('http://www.w3.org/2000/svg', 'feDisplacementMap')
    feDisplace.setAttribute('in', 'SourceGraphic')
    feDisplace.setAttribute('in2', 'map')
    feDisplace.setAttribute('xChannelSelector', 'R')
    feDisplace.setAttribute('yChannelSelector', 'G')
    feDisplace.setAttribute('result', 'displaced')
    filter.appendChild(feDisplace)

    // Rim lighting from the map's blue relief channel (128 neutral, above =
    // highlight, below = shade). Both matrices emit premultiplied-consistent
    // output (RGB' tracks A'): Chromium composites feColorMatrix output as
    // premultiplied, so the textbook "RGB=1, alpha=B" matrix bleeds additive
    // white across the whole map.

    // Highlight: white at intensity max(2B−1, 0), screen-blended
    const feSpec = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix')
    feSpec.setAttribute('in', 'map')
    feSpec.setAttribute('type', 'matrix')
    feSpec.setAttribute('values', '0 0 2 0 -1  0 0 2 0 -1  0 0 2 0 -1  0 0 2 0 -1')
    feSpec.setAttribute('result', 'spec')
    filter.appendChild(feSpec)

    const feBlend = document.createElementNS('http://www.w3.org/2000/svg', 'feBlend')
    feBlend.setAttribute('in', 'spec')
    feBlend.setAttribute('in2', 'displaced')
    feBlend.setAttribute('mode', 'screen')
    feBlend.setAttribute('result', 'lit')
    filter.appendChild(feBlend)

    // Shade: black at alpha max(1−2B, 0), composited over — darkens the
    // away-facing rim so thin shapes read as relief, not outline
    const feShade = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix')
    feShade.setAttribute('in', 'map')
    feShade.setAttribute('type', 'matrix')
    feShade.setAttribute('values', '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 -2 0 1')
    feShade.setAttribute('result', 'shade')
    filter.appendChild(feShade)

    const feShadeBlend = document.createElementNS('http://www.w3.org/2000/svg', 'feBlend')
    feShadeBlend.setAttribute('in', 'shade')
    feShadeBlend.setAttribute('in2', 'lit')
    feShadeBlend.setAttribute('mode', 'normal')
    filter.appendChild(feShadeBlend)

    defs.appendChild(filter)
  }

  // Displacement is normalized against the map's maximum, so that maximum
  // is reused directly as the filter's scale.
  filter.querySelector('feDisplacementMap')!.setAttribute('scale', String(maps.scale))

  // The filter's user space is the ::before pseudo-element, which starts
  // GLASS_OVERSCAN px up-left of the element — the padded map covers it
  // exactly from its own origin.
  const feImage = filter.querySelector('feImage')!
  feImage.setAttribute('href', maps.url)
  feImage.setAttribute('x', '0')
  feImage.setAttribute('y', '0')
  feImage.setAttribute('width', String(w + GLASS_OVERSCAN * 2))
  feImage.setAttribute('height', String(h + GLASS_OVERSCAN * 2))
}

// `rotation` (degrees, a live MotionValue) lets a tilting pane — a swiped
// card — tell the webgl renderer its angle so the glass rotates to match.
export function useGlassFilter(borderRadius: number, rotation?: MotionValue<number>) {
  const elRef = useRef<HTMLElement | null>(null)
  const [filterId] = useState(() => `kube-glass-${++counter}`)
  const prevSize = useRef({ w: 0, h: 0 })
  const mode = getGlassMode()

  useEffect(() => {
    const el = elRef.current
    if (!el) return

    // webgl mode: the canvas paints the glass; just expose the element.
    // css mode: plain backdrop blur from the stylesheet, nothing to do.
    if (mode === 'webgl') {
      const getRotation = rotation ? () => (rotation.get() * Math.PI) / 180 : undefined
      return registerPane({ el, borderRadius, getRotation })
    }
    if (mode !== 'svg') return

    function update(w: number, h: number) {
      if (w === prevSize.current.w && h === prevSize.current.h) return
      prevSize.current = { w, h }
      if (w < 2 || h < 2) return
      const maps = generateGlassMap(w, h, borderRadius)
      upsertFilter(filterId, maps, w, h)
    }

    const ro = new ResizeObserver(entries => {
      // Border-box size: contentRect excludes the pane's own padding, which
      // would size the map smaller than the ::before it must cover.
      const box = entries[0].borderBoxSize?.[0]
      if (box) {
        update(Math.round(box.inlineSize), Math.round(box.blockSize))
      } else {
        const rect = entries[0].target.getBoundingClientRect()
        update(Math.round(rect.width), Math.round(rect.height))
      }
    })
    ro.observe(el)

    const rect = el.getBoundingClientRect()
    update(Math.round(rect.width), Math.round(rect.height))

    return () => {
      ro.disconnect()
      // Clean up filter from DOM on unmount. Reset the size cache too, so a
      // StrictMode remount (same ref, same size) regenerates the filter.
      prevSize.current = { w: 0, h: 0 }
      const defs = document.querySelector('#kube-glass-filters defs')
      defs?.querySelector(`#${filterId}`)?.remove()
    }
  }, [filterId, borderRadius, mode, rotation])

  // In non-svg modes the ::before must not reference a filter that never gets
  // created — GlassPane feeds this straight into --glass-filter.
  return { elRef, filterId, filterCss: mode === 'svg' ? `url(#${filterId})` : 'none' }
}
