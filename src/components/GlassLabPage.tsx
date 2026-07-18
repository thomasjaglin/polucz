import { useEffect, useState, type ReactNode } from 'react'
import GlassPane from './GlassPane'
import { generateMaskGlassMap, GLASS_OVERSCAN } from '../lib/generateGlassMap'
import { upsertFilter } from '../hooks/useGlassFilter'
import { getGlassMode } from '../lib/glassMode'
import { fx, setFx, type ShaderFx } from '../webgl/shaderFx'
import GlassButton from './GlassButton'
import IconButton from './IconButton'
import { drawLogoMask, LETTER_PATHS, BAR, SX, SY, LOGO_W, LOGO_H } from './AppLogo'

// Glass shader test bench (open with ?lab). Standard panes for reference on
// top, then mask-based shapes of decreasing stroke width driven by live
// sliders — for finding parameter combinations that make thin decorative
// glass read convincingly before promoting them into real components.

interface LabParams {
  scale: number
  blurRadius: number
  highlight: number
  shade: number
  backdropBlur: number
  shadow: boolean
}

const DEFAULTS: LabParams = {
  scale: 30,
  blurRadius: 3,
  highlight: 0.5,
  shade: 0,
  backdropBlur: 3,
  shadow: false,
}

// Donut path builder; outer and inner subpaths wind in opposite directions so
// the hole works under the default nonzero fill rule (canvas and clip-path
// path() both default to nonzero). `off` lets the same geometry be re-emitted
// shifted by the glass overscan for the oversized layer's clip.
function donut(cx: number, cy: number, ro: number, ri: number) {
  return (off: number) => {
    const x = cx + off, y = cy + off
    return (
      `M ${x - ro} ${y} a ${ro} ${ro} 0 1 0 ${ro * 2} 0 a ${ro} ${ro} 0 1 0 ${-ro * 2} 0 Z ` +
      `M ${x - ri} ${y} a ${ri} ${ri} 0 1 1 ${ri * 2} 0 a ${ri} ${ri} 0 1 1 ${-ri * 2} 0 Z`
    )
  }
}

// Pill path builder
function pill(px: number, py: number, w: number, h: number) {
  return (off: number) => {
    const x = px + off, y = py + off
    const r = h / 2
    return `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 1 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 1 1 ${x + r} ${y} Z`
  }
}

interface Shape {
  name: string
  w: number
  h: number
  draw: (ctx: CanvasRenderingContext2D) => void
  // Shape at local size, for the optional drop-shadow layer
  shadowNode: ReactNode
}

function pathShape(name: string, w: number, h: number, dFor: (off: number) => string): Shape {
  return {
    name, w, h,
    draw: ctx => {
      ctx.fillStyle = '#fff'
      ctx.fill(new Path2D(dFor(0)))
    },
    shadowNode: <path d={dFor(0)} />,
  }
}

const logoShadowNode = (
  <g transform={`scale(${SX} ${SY})`}>
    {LETTER_PATHS.map((d, i) => <path key={i} d={d} />)}
    <rect x={BAR.x} y={BAR.y} width={BAR.w} height={BAR.h} rx={BAR.rx} transform={`rotate(90 ${BAR.x} ${BAR.y})`} />
  </g>
)

const SHAPES: Shape[] = [
  pathShape('Ring 18px', 110, 110, donut(55, 55, 48, 30)),
  pathShape('Ring 8px', 110, 110, donut(55, 55, 48, 40)),
  pathShape('Bar 14px', 200, 24, pill(4, 5, 192, 14)),
  { name: 'Logo strokes ~5px', w: LOGO_W, h: LOGO_H, draw: drawLogoMask, shadowNode: logoShadowNode },
]

// The overscanned glass layer is confined to the shape with a CSS mask built
// from the same draw function as the displacement map. Reference-free on
// purpose: svg clipPath url() references silently clip these layers to
// nothing inside the scrolled page content (they work fine from the header),
// and a mask image supports any shape that can be drawn to a canvas.
function buildMaskUrl(shape: Shape): string {
  const c = document.createElement('canvas')
  c.width = shape.w + GLASS_OVERSCAN * 2
  c.height = shape.h + GLASS_OVERSCAN * 2
  const ctx = c.getContext('2d')!
  ctx.translate(GLASS_OVERSCAN, GLASS_OVERSCAN)
  shape.draw(ctx)
  return `url(${c.toDataURL()})`
}

let labCounter = 0

function TestShape({ shape, params }: { shape: Shape; params: LabParams }) {
  const [fid] = useState(() => `glass-lab-${++labCounter}`)
  const [maskUrl] = useState(() => buildMaskUrl(shape))
  const { scale, blurRadius, highlight, shade } = params

  useEffect(() => {
    const maps = generateMaskGlassMap(shape.w, shape.h, shape.draw, { scale, blurRadius, highlight, shade })
    upsertFilter(fid, maps, shape.w, shape.h)
    return () => {
      document.querySelector(`#kube-glass-filters #${fid}`)?.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, blurRadius, highlight, shade])

  return (
    <div className="relative shrink-0" style={{ width: shape.w, height: shape.h }}>
      {params.shadow && (
        <svg
          width={shape.w}
          height={shape.h}
          className="absolute inset-0"
          style={{ filter: 'blur(2.5px)', transform: 'translateY(2.5px)', opacity: 0.4 }}
        >
          {shape.shadowNode}
        </svg>
      )}

      <div
        className="absolute"
        style={{
          inset: -GLASS_OVERSCAN,
          backdropFilter: `blur(${params.backdropBlur}px) saturate(160%)`,
          WebkitBackdropFilter: `blur(${params.backdropBlur}px) saturate(160%)`,
          filter: `url(#${fid})`,
          maskImage: maskUrl,
          WebkitMaskImage: maskUrl,
        }}
      />
    </div>
  )
}

function Slider({ label, min, max, step, value, onChange }: {
  label: string; min: number; max: number; step: number
  value: number; onChange: (v: number) => void
}) {
  return (
    <label className="flex items-center gap-3 text-[13px] text-white/70">
      <span className="w-28 shrink-0">{label}</span>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-purple-300"
      />
      <span className="w-10 shrink-0 text-right tabular-nums text-white/90">{value}</span>
    </label>
  )
}

export default function GlassLabPage() {
  const [params, setParams] = useState<LabParams>(DEFAULTS)
  const set = (patch: Partial<LabParams>) => setParams(p => ({ ...p, ...patch }))
  const glassMode = getGlassMode()

  // WebGL shader FX (mirrors the mutable shaderFx store)
  const [fxState, setFxState] = useState<ShaderFx>({ ...fx })
  const setFxParam = (patch: Partial<ShaderFx>) => {
    setFx(patch)
    setFxState(s => ({ ...s, ...patch }))
  }

  return (
    <div className="animate-fade-in flex flex-col gap-8 pb-48">
      {/* ?lab overrides all page routing, so the lab needs its own way out */}
      <div className="flex items-center justify-between">
        <h1 className="font-instrument text-[22px] font-semibold text-white/80">Glass lab</h1>
        <button
          onClick={() => { window.location.href = window.location.pathname }}
          className="flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3.5 py-1.5 text-[13px] text-white/80"
        >
          <span className="material-symbols-rounded text-[16px]">close</span>
          Exit
        </button>
      </div>

      {glassMode !== 'svg' && (
        <p className="text-[13px] text-amber-300/90">
          Glass mode is “{glassMode}” — the mask shapes below render via SVG filters and
          are only meaningful with <code>?glass=svg</code> (default in Chrome).
        </p>
      )}

      {/* WebGL shader FX — applies live to every glass pane on screen */}
      {glassMode === 'webgl' && (
        <div className="flex flex-col gap-2 rounded-2xl bg-white/[0.04] p-4">
          <h2 className="mb-1 text-[13px] uppercase tracking-wide text-white/40">WebGL shader FX</h2>
          <Slider label="Chroma" min={0} max={1} step={0.05} value={fxState.chroma} onChange={v => setFxParam({ chroma: v })} />
          <Slider label="Fresnel" min={0} max={1} step={0.05} value={fxState.fresnel} onChange={v => setFxParam({ fresnel: v })} />
          <Slider label="Wobble" min={0} max={1} step={0.05} value={fxState.wobble} onChange={v => setFxParam({ wobble: v })} />
          <Slider label="Light angle" min={-180} max={180} step={5}
            value={Math.round(fxState.lightAngle * 180 / Math.PI)}
            onChange={v => setFxParam({ lightAngle: v * Math.PI / 180 })} />
          <label className="flex items-center gap-3 text-[13px] text-white/70">
            <span className="w-28 shrink-0">Auto light</span>
            <input type="checkbox" checked={fxState.autoLight}
              onChange={e => setFxParam({ autoLight: e.target.checked })} className="accent-purple-300" />
          </label>
          <label className="flex items-center gap-3 text-[13px] text-white/70">
            <span className="w-28 shrink-0">Tilt light</span>
            <input type="checkbox" checked={fxState.tiltLight}
              onChange={e => setFxParam({ tiltLight: e.target.checked })} className="accent-purple-300" />
          </label>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col gap-2 rounded-2xl bg-white/[0.04] p-4">
        <Slider label="Displacement" min={0} max={80} step={2} value={params.scale} onChange={v => set({ scale: v })} />
        <Slider label="Band radius" min={1} max={8} step={1} value={params.blurRadius} onChange={v => set({ blurRadius: v })} />
        <Slider label="Highlight" min={0} max={1} step={0.05} value={params.highlight} onChange={v => set({ highlight: v })} />
        <Slider label="Shade" min={0} max={1} step={0.05} value={params.shade} onChange={v => set({ shade: v })} />
        <Slider label="Backdrop blur" min={0} max={12} step={1} value={params.backdropBlur} onChange={v => set({ backdropBlur: v })} />
        <label className="flex items-center gap-3 text-[13px] text-white/70">
          <span className="w-28 shrink-0">Drop shadow</span>
          <input
            type="checkbox"
            checked={params.shadow}
            onChange={e => set({ shadow: e.target.checked })}
            className="accent-purple-300"
          />
        </label>
        <button
          className="mt-1 self-start rounded-lg bg-white/[0.08] px-3 py-1 text-[13px] text-white/80"
          onClick={() => setParams(DEFAULTS)}
        >
          Reset
        </button>
      </div>

      {/* Reference: the standard pane glass (fixed params, for comparison) */}
      <div className="flex flex-col gap-3">
        <h2 className="text-[13px] uppercase tracking-wide text-white/40">Reference panes (production params)</h2>
        <GlassPane borderRadius={24} className="rounded-[24px] p-5">
          <span className="font-instrument text-[18px] font-semibold text-white/90">Card pane</span>
        </GlassPane>
        <div className="flex items-center gap-3">
          <GlassPane borderRadius={18} className="rounded-[18px] px-4 py-2">
            <span className="text-[14px] text-white/90">Pill</span>
          </GlassPane>
          <GlassPane borderRadius={12} className="rounded-[12px] px-2 py-1">
            <span className="text-[12px] text-white/80">Tiny</span>
          </GlassPane>
        </div>

        {/* Button variants — the app's real GlassButton styles */}
        <div className="flex items-center gap-3">
          <GlassButton radius={16} pane="bg-[#B4A0FF]/10" className="flex-1 border border-[#B4A0FF]/20 py-3 font-instrument text-[15px] font-medium text-[#B4A0FF]">
            Primary
          </GlassButton>
          <GlassButton radius={16} pane="bg-red-400/10" className="flex-1 border border-red-400/20 py-3 font-instrument text-[15px] font-medium text-red-400/80">
            Danger
          </GlassButton>
          <GlassButton radius={16} pane="bg-white/[0.04]" className="flex-1 border border-white/10 py-3 font-instrument text-[15px] font-medium text-white/70">
            Neutral
          </GlassButton>
        </div>

        {/* Icon buttons + play-style circle */}
        <div className="flex items-center gap-3">
          <IconButton icon="search" onClick={() => {}} />
          <IconButton icon="settings" onClick={() => {}} />
          <GlassButton radius={30} pane="bg-[#B4A0FF]/15" className="h-[60px] w-[60px] border border-[#B4A0FF]/30 shadow-[0_0_24px_rgba(180,160,255,0.25)]">
            <span className="material-symbols-rounded text-[28px] text-[#B4A0FF]">play_arrow</span>
          </GlassButton>
          <GlassButton radius={19} pane="bg-white/5" className="h-[38px] w-[38px] border border-white/10 text-white/50">
            <span className="material-symbols-rounded text-[20px]">refresh</span>
          </GlassButton>
        </div>
      </div>

      {/* Mask shapes under test */}
      <div className="flex flex-col gap-5">
        <h2 className="text-[13px] uppercase tracking-wide text-white/40">Mask shapes (live params)</h2>
        {SHAPES.map(s => (
          <div key={s.name} className="flex flex-col gap-1.5">
            <span className="text-[12px] text-white/40">{s.name}</span>
            <TestShape shape={s} params={params} />
          </div>
        ))}
      </div>
    </div>
  )
}
