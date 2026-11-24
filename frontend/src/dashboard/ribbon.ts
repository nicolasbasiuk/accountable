// The funnel as one ribbon, cut into stages. Its thickness is the value (B4).

export type Part = {
  /** Where the part starts, and how wide it is, without the gap after it. */
  x: number
  width: number
  /** How thick the ribbon is where the part is flat. */
  thickness: number
  /** Where the flat piece starts. */
  flatX: number
}

const GAP = 3
const CORNER = 12
/** How much of a part's width, at each side, curves toward its neighbor. */
const CURVE = 0.2

export function ribbon(values: number[], width: number, height: number): { path: string; parts: Part[] } {
  const each = width / values.length
  const highest = Math.max(...values, 0)
  const last = values.length - 1

  const parts = values.map((value, index) => ({
    x: index * each,
    width: index < last ? each - GAP : each,
    thickness: highest > 0 ? (value / highest) * height : 0,
    flatX: index === 0 ? 0 : (index + CURVE) * each,
  }))

  // The points where each part's flat piece starts and ends, from left to right.
  const points = parts.flatMap(({ thickness, flatX }, index) => [
    { x: flatX, half: thickness / 2 },
    { x: index < last ? (index + 1 - CURVE) * each : width, half: thickness / 2 },
  ])
  const n = (amount: number) => Number(amount.toFixed(2))
  const at = (index: number, side: 1 | -1) => `${n(points[index]!.x)},${n(height / 2 + side * points[index]!.half)}`
  const curve = (from: number, to: number, side: 1 | -1) => {
    const middle = n((points[from]!.x + points[to]!.x) / 2)
    const y = (index: number) => n(height / 2 + side * points[index]!.half)
    return `C${middle},${y(from)} ${middle},${y(to)} ${at(to, side)}`
  }

  const end = points.length - 1
  const [startCorner, endCorner] = [Math.min(CORNER, points[0]!.half), Math.min(CORNER, points[end]!.half)]
  const top = height / 2 - points[0]!.half
  const bottom = height / 2 + points[0]!.half
  const endTop = height / 2 - points[end]!.half
  const endBottom = height / 2 + points[end]!.half

  let path = `M0,${n(top + startCorner)}Q0,${n(top)} ${n(startCorner)},${n(top)}`
  for (let index = 1; index < end; index += 1) path += index % 2 ? `L${at(index, -1)}` : curve(index - 1, index, -1)
  path += `L${n(width - endCorner)},${n(endTop)}Q${n(width)},${n(endTop)} ${n(width)},${n(endTop + endCorner)}`
  path += `L${n(width)},${n(endBottom - endCorner)}Q${n(width)},${n(endBottom)} ${n(width - endCorner)},${n(endBottom)}`
  for (let index = end - 1; index > 0; index -= 1) path += index % 2 ? curve(index + 1, index, 1) : `L${at(index, 1)}`
  path += `L${n(startCorner)},${n(bottom)}Q0,${n(bottom)} 0,${n(bottom - startCorner)}Z`
  return { path, parts }
}
