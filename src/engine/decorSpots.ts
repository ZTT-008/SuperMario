/**
 * 地面装饰确定性布点(纯函数,vitest 可测):mulberry32 种子,点落 [x0, x1) 带内、
 * 避开障碍区间(水域/灌木/管道/阶梯/旗杆)、最小间距防叠。同种子同结果、无累积状态
 * ——与 ProceduralTextures 同一伪随机纪律,截图逐帧可复现。
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type AvoidRange = readonly [number, number]

export function decorSpots(
  seed: number,
  x0: number,
  x1: number,
  n: number,
  avoid: readonly AvoidRange[] = [],
  minGap = 1.5,
): number[] {
  const rnd = mulberry32(seed)
  const spots: number[] = []
  // 重试上限保证密集障碍下仍终止;重试序列由种子决定 → 仍确定性
  for (let guard = 0; spots.length < n && guard < n * 30; guard++) {
    const x = x0 + rnd() * (x1 - x0)
    if (avoid.some(([a, b]) => x > a - 1 && x < b + 1)) continue
    if (spots.some((s) => Math.abs(s - x) < minGap)) continue
    spots.push(Number(x.toFixed(3)))
  }
  return spots
}
