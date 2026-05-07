interface Props {
  size?: number
  color?: string
}

export function StationSyncLogo({ size = 20, color = '#111' }: Props) {
  const cell = size / 3
  const gap = cell * 0.18

  const filled = [
    [0, 0], [1, 0],
    [0, 1],
    [1, 2], [2, 2],
  ]

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      {filled.map(([col, row]) => (
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
