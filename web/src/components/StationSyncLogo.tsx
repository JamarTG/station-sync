interface Props {
  size?: number
  color?: string
}

const FILLED = [
  [0, 0], [1, 0],
  [0, 1],
  [1, 2], [2, 2],
] as const

export function StationSyncLogo({ size = 20, color = '#111' }: Props) {
  const cell = size / 3
  const gap  = cell * 0.18

  return (
    <svg className="ss-logo" width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      {FILLED.map(([col, row]) => (
        <rect
          key={`${col}-${row}`}
          x={col * cell + gap}
          y={row * cell + gap}
          width={cell - gap * 2}
          height={cell - gap * 2}
          rx={cell * 0.18}
          fill={color}
        />
      ))}
    </svg>
  )
}

export function LogoLoader({ size = 52 }: { size?: number }) {
  const cell = size / 3
  const gap  = cell * 0.18

  return (
    <>
      <style>{`
        @keyframes logo-sq {
          0%, 60%, 100% { opacity: 0.12; }
          30% { opacity: 1; }
        }
      `}</style>
      <svg className="ss-logo-loader" width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
        {FILLED.map(([col, row], i) => (
          <rect
            key={`${col}-${row}`}
            x={col * cell + gap}
            y={row * cell + gap}
            width={cell - gap * 2}
            height={cell - gap * 2}
            rx={cell * 0.18}
            fill="currentColor"
            style={{
              animation: `logo-sq 1.4s ease-in-out infinite`,
              animationDelay: `${i * 200}ms`,
              opacity: 0.12,
            }}
          />
        ))}
      </svg>
    </>
  )
}
