// The scale of a chart's axis, as in mockup D: round steps, and room above the highest value for its label.

/** The least room above the highest value, so its label never reaches the edge. */
const ROOM = 1.1

/** Steps of 1, 2 or 5, or ten, a hundred and so on times that. The largest that fits at least twice. */
function stepFor(highest: number): number {
  const power = 10 ** Math.floor(Math.log10(highest))
  const step = [5, 2, 1, 0.5].map((size) => size * power).find((size) => highest / size >= 2)!
  return Math.max(step, 1)
}

export function scale(highest: number): { top: number; ticks: number[] } {
  const step = stepFor(highest)
  const half = step / 2
  const top = Math.ceil((highest * ROOM) / half) * half
  const ticks = Array.from({ length: Math.floor(top / step) + 1 }, (_, index) => index * step)
  return { top, ticks }
}
