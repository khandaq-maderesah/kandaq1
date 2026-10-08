/**
 * NeonWaveBackground — purely DECORATIVE background (no UI content).
 *
 * Deep dark purple/navy base with flowing neon light ribbons:
 * many thin parallel SVG wave paths with cyan → blue → violet → pink
 * gradients, layered glow (blurred duplicate strokes), ambient blurred
 * light blobs and subtle glowing orbs. Extends beyond the viewBox so no
 * edges are visible; scales responsively via preserveAspectRatio="slice".
 *
 * Usage: place as the FIRST child of a `relative overflow-hidden` container.
 * Animation keyframes live in globals.css and respect prefers-reduced-motion.
 */

const WAVE_A =
  'M-320,330 C60,150 380,450 720,330 S1260,110 1760,290'
const WAVE_B =
  'M-320,510 C200,690 430,310 770,460 S1250,650 1760,430'
const WAVE_C =
  'M-320,670 C230,530 530,810 890,650 S1330,510 1760,640'
const WAVE_D =
  'M-320,420 C270,560 570,230 910,390 S1370,590 1760,370'

/** One ribbon = glow stroke + a bundle of thin parallel lines. */
function Ribbon({
  d,
  gradient,
  offsets,
}: {
  d: string
  gradient: string
  offsets: number[]
}) {
  return (
    <g fill="none" strokeLinecap="round">
      {/* soft neon glow */}
      <path
        d={d}
        stroke={gradient}
        strokeWidth={16}
        opacity={0.35}
        style={{ filter: 'blur(14px)' }}
      />
      <path
        d={d}
        stroke={gradient}
        strokeWidth={6}
        opacity={0.45}
        style={{ filter: 'blur(5px)' }}
      />
      {/* thin parallel lines */}
      {offsets.map((off, i) => (
        <path
          key={off}
          d={d}
          transform={`translate(0 ${off})`}
          stroke={gradient}
          strokeWidth={i === Math.floor(offsets.length / 2) ? 2 : 1}
          opacity={i === Math.floor(offsets.length / 2) ? 0.95 : 0.4 + 0.08 * i}
        />
      ))}
    </g>
  )
}

const ORBS = [
  { cx: 180, cy: 170, r: 3.5 },
  { cx: 420, cy: 640, r: 2.5 },
  { cx: 700, cy: 120, r: 3 },
  { cx: 980, cy: 720, r: 2.5 },
  { cx: 1220, cy: 240, r: 4 },
  { cx: 1350, cy: 560, r: 2.5 },
  { cx: 80, cy: 480, r: 3 },
]

export default function NeonWaveBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #070316 0%, #14083a 30%, #312e81 55%, #4c1d95 75%, #12071f 100%)' }}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="nwCyan" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="45%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          <linearGradient id="nwBlue" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="55%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
          <linearGradient id="nwViolet" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#f472b6" />
          </linearGradient>
          <linearGradient id="nwPink" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="60%" stopColor="#d946ef" />
            <stop offset="100%" stopColor="#f9a8d4" />
          </linearGradient>
          <radialGradient id="nwOrb">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="45%" stopColor="#c4b5fd" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#c4b5fd" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ambient blurred light blobs */}
        <g style={{ filter: 'blur(70px)' }}>
          <ellipse cx="300" cy="260" rx="340" ry="200" fill="#7c3aed" opacity="0.30" />
          <ellipse cx="1150" cy="380" rx="380" ry="230" fill="#2563eb" opacity="0.24" />
          <ellipse cx="820" cy="760" rx="420" ry="200" fill="#db2777" opacity="0.20" />
        </g>

        {/* flowing neon ribbons (paths extend past the viewBox on both sides) */}
        <g className="nw-drift-a">
          <Ribbon d={WAVE_A} gradient="url(#nwCyan)" offsets={[-14, -7, 0, 7, 14]} />
        </g>
        <g className="nw-drift-d">
          <Ribbon d={WAVE_D} gradient="url(#nwBlue)" offsets={[-12, -6, 0, 6, 12]} />
        </g>
        <g className="nw-drift-b">
          <Ribbon d={WAVE_B} gradient="url(#nwViolet)" offsets={[-16, -8, 0, 8, 16]} />
        </g>
        <g className="nw-drift-c">
          <Ribbon d={WAVE_C} gradient="url(#nwPink)" offsets={[-12, -6, 0, 6, 12]} />
        </g>

        {/* subtle glowing orbs */}
        <g>
          {ORBS.map((o, i) => (
            <circle
              key={i}
              cx={o.cx}
              cy={o.cy}
              r={o.r * 4}
              fill="url(#nwOrb)"
              className="nw-orb"
              style={{ animationDelay: `${i * 1.7}s` }}
            />
          ))}
        </g>
      </svg>
    </div>
  )
}
