import { useEffect, useRef, useState } from 'react'
import { generateGlassMap } from '../lib/generateGlassMap'

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

function upsertFilter(id: string, dataUrl: string, w: number, h: number) {
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

    const feImage = document.createElementNS('http://www.w3.org/2000/svg', 'feImage')
    feImage.setAttribute('result', 'map')
    filter.appendChild(feImage)

    const feDisplace = document.createElementNS('http://www.w3.org/2000/svg', 'feDisplacementMap')
    feDisplace.setAttribute('in', 'SourceGraphic')
    feDisplace.setAttribute('in2', 'map')
    feDisplace.setAttribute('scale', '60')
    feDisplace.setAttribute('xChannelSelector', 'R')
    feDisplace.setAttribute('yChannelSelector', 'G')
    filter.appendChild(feDisplace)

    defs.appendChild(filter)
  }

  const feImage = filter.querySelector('feImage')!
  feImage.setAttribute('href', dataUrl)
  feImage.setAttribute('x', '0')
  feImage.setAttribute('y', '0')
  feImage.setAttribute('width', String(w))
  feImage.setAttribute('height', String(h))
}

export function useGlassFilter(borderRadius: number) {
  const elRef = useRef<HTMLElement | null>(null)
  const [filterId] = useState(() => `kube-glass-${++counter}`)
  const prevSize = useRef({ w: 0, h: 0 })

  useEffect(() => {
    const el = elRef.current
    if (!el) return

    function update(w: number, h: number) {
      if (w === prevSize.current.w && h === prevSize.current.h) return
      prevSize.current = { w, h }
      if (w < 2 || h < 2) return
      const dataUrl = generateGlassMap(w, h, borderRadius)
      upsertFilter(filterId, dataUrl, w, h)
    }

    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      update(Math.round(width), Math.round(height))
    })
    ro.observe(el)

    const rect = el.getBoundingClientRect()
    update(Math.round(rect.width), Math.round(rect.height))

    return () => {
      ro.disconnect()
      // Clean up filter from DOM on unmount
      const defs = document.querySelector('#kube-glass-filters defs')
      defs?.querySelector(`#${filterId}`)?.remove()
    }
  }, [filterId, borderRadius])

  return { elRef, filterId }
}
