import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

/**
 * 程序化 CanvasTexture 库(DESIGN §10.5,零外部文件):一次绘制、全局复用。
 * 颜色贴图统一 SRGBColorSpace;平铺类设 RepeatWrapping;anisotropy 4 抗斜视角糊。
 */

const registry: CanvasTexture[] = []

function track(tex: CanvasTexture): CanvasTexture {
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  registry.push(tex)
  return tex
}

function makeCanvas(w: number, h: number = w): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return { c, g: c.getContext('2d')! }
}

/** 确定性伪随机(每次运行贴图一致,截图可复现) */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function speckle(g: CanvasRenderingContext2D, size: number, n: number, colors: string[], alpha: number): void {
  const rnd = mulberry32(1337)
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[Math.floor(rnd() * colors.length)] ?? '#000000'
    g.globalAlpha = alpha * (0.5 + rnd() * 0.5)
    const s = 1 + Math.floor(rnd() * 3)
    g.fillRect(Math.floor(rnd() * size), Math.floor(rnd() * size), s, s)
  }
  g.globalAlpha = 1
}

/** 地面泥土:2×2 错缝砖纹 + 磨损噪点(128px,每瓦片一循环) */
export function makeGroundDirtTexture(): CanvasTexture {
  const size = 128
  const { c, g } = makeCanvas(size)
  g.fillStyle = '#8a5a33'
  g.fillRect(0, 0, size, size)
  // 错缝砖:两行,第二行半格错位
  const mortar = '#5f3d20'
  g.fillStyle = mortar
  g.fillRect(0, 61, size, 4)
  g.fillRect(0, 0, size, 3)
  g.fillRect(0, 125, size, 3)
  for (const [row, offset] of [
    [0, 0],
    [1, 32],
  ] as const) {
    const y = row === 0 ? 3 : 65
    const h = row === 0 ? 58 : 60
    for (let x = offset - 64; x < size; x += 64) {
      g.fillStyle = '#6e4728'
      g.fillRect(x + 60, y, 4, h) // 砖竖缝
    }
  }
  // 砖面提亮 + 噪点磨损
  g.globalAlpha = 0.12
  g.fillStyle = '#c08a52'
  for (let i = 0; i < 26; i++) {
    const rnd = mulberry32(i * 7919)
    g.fillRect(rnd() * size, rnd() * size, 6 + rnd() * 14, 3 + rnd() * 6)
  }
  g.globalAlpha = 1
  speckle(g, size, 240, ['#3f2a15', '#a8734a'], 0.35)
  const tex = track(new CanvasTexture(c))
  tex.wrapS = tex.wrapT = RepeatWrapping
  return tex
}

/** 草皮顶盖:嫩草渐变 + 草叶噪点 */
export function makeGrassTexture(): CanvasTexture {
  const size = 128
  const { c, g } = makeCanvas(size)
  const grad = g.createLinearGradient(0, 0, 0, size)
  grad.addColorStop(0, '#6cc24a')
  grad.addColorStop(0.7, '#4ea233')
  grad.addColorStop(1, '#3d8527')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  speckle(g, size, 320, ['#8fd96b', '#2f6b1e'], 0.4)
  const tex = track(new CanvasTexture(c))
  tex.wrapS = tex.wrapT = RepeatWrapping
  return tex
}

/** 木箱:外框 + 内板纹 + 四角铆钉(经典 SMB 箱型读感) */
export function makeCrateTexture(): CanvasTexture {
  const size = 128
  const { c, g } = makeCanvas(size)
  g.fillStyle = '#a8642c'
  g.fillRect(0, 0, size, size)
  // 内板横纹
  g.fillStyle = '#8f5222'
  for (let y = 24; y < size; y += 20) g.fillRect(14, y, size - 28, 3)
  speckle(g, size, 140, ['#7a4419', '#c07a3a'], 0.3)
  // 外框(上浅下深 → 受光暗示)
  g.fillStyle = '#c07a3a'
  g.fillRect(0, 0, size, 12)
  g.fillRect(0, 0, 12, size)
  g.fillStyle = '#6e3d16'
  g.fillRect(0, size - 12, size, 12)
  g.fillRect(size - 12, 0, 12, size)
  // 铆钉
  g.fillStyle = '#4a2a0e'
  for (const [x, y] of [
    [5, 5],
    [111, 5],
    [5, 111],
    [111, 111],
  ] as const) {
    g.beginPath()
    g.arc(x + 4, y + 4, 4, 0, Math.PI * 2)
    g.fill()
  }
  const tex = track(new CanvasTexture(c))
  return tex
}

/** 问号砖:金底 + 白圆 + 深色「?」+ 铆钉;兼作 emissiveMap */
export function makeQuestionTexture(): CanvasTexture {
  const size = 128
  const { c, g } = makeCanvas(size)
  g.fillStyle = '#e8a33d'
  g.fillRect(0, 0, size, size)
  g.fillStyle = '#b57a22'
  g.fillRect(0, 0, size, 8)
  g.fillRect(0, size - 8, size, 8)
  g.fillRect(0, 0, 8, size)
  g.fillRect(size - 8, 0, 8, size)
  g.fillStyle = '#6b3c12'
  for (const [x, y] of [
    [14, 14],
    [102, 14],
    [14, 102],
    [102, 102],
  ] as const) {
    g.beginPath()
    g.arc(x + 5, y + 5, 5, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = '#fff6e0'
  g.beginPath()
  g.arc(64, 64, 36, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#7a4a16'
  g.font = 'bold 56px "Segoe UI", system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('?', 64, 68)
  return track(new CanvasTexture(c))
}

/** 云朵:透明底白色蓬簇(256×128,背景层用) */
export function makeCloudTexture(): CanvasTexture {
  const w = 256
  const h = 128
  const { c, g } = makeCanvas(w, h)
  const puffs: [number, number, number][] = [
    [70, 78, 34],
    [118, 62, 44],
    [172, 74, 36],
    [210, 84, 26],
  ]
  for (const [x, y, r] of puffs) {
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = '#ffffff'
  g.fillRect(60, 78, 160, 26)
  // 底部淡灰 → 体积感
  const grad = g.createLinearGradient(0, 84, 0, 106)
  grad.addColorStop(0, 'rgba(180, 200, 220, 0)')
  grad.addColorStop(1, 'rgba(160, 185, 210, 0.55)')
  g.fillStyle = grad
  g.fillRect(56, 84, 168, 22)
  return track(new CanvasTexture(c))
}

/** 水面:深蓝底 + 双层错位亮波弧(RepeatWrapping,uv 横向滚动即流动) */
export function makeWaterTexture(): CanvasTexture {
  const w = 128
  const h = 64
  const { c, g } = makeCanvas(w, h)
  const grad = g.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#2f7fd8')
  grad.addColorStop(1, '#1a4f9e')
  g.fillStyle = grad
  g.fillRect(0, 0, w, h)
  const rnd = mulberry32(4242)
  g.strokeStyle = 'rgba(150, 205, 255, 0.55)'
  g.lineWidth = 2
  for (const row of [14, 34, 52]) {
    for (let x = -20; x < w + 20; x += 26) {
      const off = row * 7 + rnd() * 8
      g.beginPath()
      g.arc(x + off, row + 10, 11, Math.PI * 1.15, Math.PI * 1.85)
      g.stroke()
    }
  }
  g.strokeStyle = 'rgba(220, 240, 255, 0.35)'
  for (let x = 6; x < w; x += 41) {
    g.beginPath()
    g.arc(x, 24, 7, Math.PI * 1.2, Math.PI * 1.8)
    g.stroke()
  }
  const tex = track(new CanvasTexture(c))
  tex.wrapS = tex.wrapT = RepeatWrapping
  return tex
}

/** 石地泥土(M2 石样式带):冷灰砌块 + 深缝 */
export function makeStoneDirtTexture(): CanvasTexture {
  const size = 128
  const { c, g } = makeCanvas(size)
  g.fillStyle = '#7d838c'
  g.fillRect(0, 0, size, size)
  g.fillStyle = '#565b63'
  g.fillRect(0, 60, size, 5)
  g.fillRect(0, 0, size, 3)
  g.fillRect(0, 125, size, 3)
  for (const [row, offset] of [
    [0, 0],
    [1, 42],
  ] as const) {
    const y = row === 0 ? 3 : 65
    const h = row === 0 ? 57 : 60
    for (let x = offset - 84; x < size; x += 84) {
      g.fillStyle = '#4a4f57'
      g.fillRect(x + 80, y, 4, h)
    }
  }
  g.globalAlpha = 0.14
  g.fillStyle = '#a9b0ba'
  for (let i = 0; i < 22; i++) {
    const rnd = mulberry32(i * 6271)
    g.fillRect(rnd() * size, rnd() * size, 5 + rnd() * 12, 3 + rnd() * 5)
  }
  g.globalAlpha = 1
  speckle(g, size, 200, ['#3c4046', '#98a0aa'], 0.3)
  const tex = track(new CanvasTexture(c))
  tex.wrapS = tex.wrapT = RepeatWrapping
  return tex
}

/** 石顶盖:板岩灰 + 裂纹 */
export function makeStoneTopTexture(): CanvasTexture {
  const size = 128
  const { c, g } = makeCanvas(size)
  const grad = g.createLinearGradient(0, 0, 0, size)
  grad.addColorStop(0, '#9aa2ad')
  grad.addColorStop(0.7, '#7b828d')
  grad.addColorStop(1, '#666d78')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  g.strokeStyle = 'rgba(60, 64, 72, 0.5)'
  g.lineWidth = 2
  const rnd = mulberry32(777)
  for (let i = 0; i < 6; i++) {
    g.beginPath()
    let x = rnd() * size
    let y = rnd() * size
    g.moveTo(x, y)
    for (let s = 0; s < 3; s++) {
      x += (rnd() - 0.5) * 40
      y += (rnd() - 0.5) * 40
      g.lineTo(x, y)
    }
    g.stroke()
  }
  speckle(g, size, 260, ['#b6bdc7', '#565c66'], 0.35)
  const tex = track(new CanvasTexture(c))
  tex.wrapS = tex.wrapT = RepeatWrapping
  return tex
}

/** 雪/冰泥土(M2 雪样式带):冷蓝冰砖,缝更深 */
export function makeSnowDirtTexture(): CanvasTexture {
  const size = 128
  const { c, g } = makeCanvas(size)
  g.fillStyle = '#cfe0ee'
  g.fillRect(0, 0, size, size)
  g.fillStyle = '#9db8cf'
  g.fillRect(0, 60, size, 5)
  g.fillRect(0, 0, size, 3)
  g.fillRect(0, 125, size, 3)
  for (const [row, offset] of [
    [0, 0],
    [1, 36],
  ] as const) {
    const y = row === 0 ? 3 : 65
    const h = row === 0 ? 57 : 60
    for (let x = offset - 72; x < size; x += 72) {
      g.fillStyle = '#8aa6bf'
      g.fillRect(x + 68, y, 4, h)
    }
  }
  g.globalAlpha = 0.3
  g.fillStyle = '#ffffff'
  for (let i = 0; i < 18; i++) {
    const rnd = mulberry32(i * 3571)
    g.fillRect(rnd() * size, rnd() * size, 8 + rnd() * 16, 3 + rnd() * 4)
  }
  g.globalAlpha = 1
  speckle(g, size, 160, ['#7f9cb5', '#eef6fc'], 0.35)
  const tex = track(new CanvasTexture(c))
  tex.wrapS = tex.wrapT = RepeatWrapping
  return tex
}

/** 雪顶盖:白雪渐变 + 冰晶闪点 */
export function makeSnowTopTexture(): CanvasTexture {
  const size = 128
  const { c, g } = makeCanvas(size)
  const grad = g.createLinearGradient(0, 0, 0, size)
  grad.addColorStop(0, '#ffffff')
  grad.addColorStop(0.7, '#e4eef7')
  grad.addColorStop(1, '#c6d8e6')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  const rnd = mulberry32(99)
  g.fillStyle = 'rgba(150, 190, 225, 0.5)'
  for (let i = 0; i < 40; i++) {
    const x = rnd() * size
    const y = rnd() * size
    g.fillRect(x, y, 2, 1)
    g.fillRect(x + 1, y - 1, 1, 3) // 十字晶
  }
  speckle(g, size, 180, ['#d3e2ef', '#ffffff'], 0.4)
  const tex = track(new CanvasTexture(c))
  tex.wrapS = tex.wrapT = RepeatWrapping
  return tex
}

/** 实心砖:经典暗红砖纹(比泥土更规整的 4 缝网格) */
export function makeBrickTexture(): CanvasTexture {
  const size = 128
  const { c, g } = makeCanvas(size)
  g.fillStyle = '#b5542f'
  g.fillRect(0, 0, size, size)
  g.fillStyle = '#7c3517'
  g.fillRect(0, 0, size, 4)
  g.fillRect(0, 42, size, 4)
  g.fillRect(0, 84, size, 4)
  g.fillRect(0, 124, size, 4)
  for (const [y, off] of [
    [4, 0],
    [46, 32],
    [88, 0],
  ] as const) {
    for (let x = off - 64; x < size; x += 64) g.fillRect(x + 60, y, 4, 40)
  }
  speckle(g, size, 120, ['#8f3f20', '#d4744a'], 0.25)
  const tex = track(new CanvasTexture(c))
  tex.wrapS = tex.wrapT = RepeatWrapping
  return tex
}

/** 管道:绿身 + 纵向高光(受光左缘);顶缘另加宽圈 */
export function makePipeTexture(): CanvasTexture {
  const size = 128
  const { c, g } = makeCanvas(size)
  const grad = g.createLinearGradient(0, 0, size, 0)
  grad.addColorStop(0, '#1f7a2d')
  grad.addColorStop(0.28, '#57c253')
  grad.addColorStop(0.55, '#2e9438')
  grad.addColorStop(1, '#155c20')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  g.fillStyle = 'rgba(255, 255, 255, 0.28)'
  g.fillRect(20, 0, 12, size) // 高光带
  g.fillStyle = 'rgba(0, 40, 10, 0.35)'
  g.fillRect(0, 0, 6, size)
  const tex = track(new CanvasTexture(c))
  tex.wrapS = tex.wrapT = RepeatWrapping
  return tex
}

/** 尖刺:钢灰锥面渐变 + 刃口亮线 */
export function makeSpikeTexture(): CanvasTexture {
  const size = 64
  const { c, g } = makeCanvas(size)
  const grad = g.createLinearGradient(0, 0, size, 0)
  grad.addColorStop(0, '#8b929c')
  grad.addColorStop(0.45, '#d7dde4')
  grad.addColorStop(0.6, '#6e747d')
  grad.addColorStop(1, '#43484f')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  g.strokeStyle = 'rgba(255, 255, 255, 0.6)'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(size * 0.42, size)
  g.lineTo(size * 0.5, 0)
  g.stroke()
  speckle(g, size, 60, ['#5a6068', '#eef2f6'], 0.25)
  const tex = track(new CanvasTexture(c))
  return tex
}

/** 移动浮台/单向桥:木板面 + 边绳铆接(工业木台读感) */
export function makePlatformTexture(): CanvasTexture {
  const size = 128
  const { c, g } = makeCanvas(size)
  g.fillStyle = '#9a6a38'
  g.fillRect(0, 0, size, size)
  g.fillStyle = '#7d5227'
  for (let y = 10; y < size; y += 26) g.fillRect(0, y, size, 3)
  g.fillStyle = '#b9854e'
  g.fillRect(0, 0, size, 8)
  g.fillStyle = '#5e3c1c'
  g.fillRect(0, size - 10, size, 10)
  const rnd = mulberry32(555)
  g.fillStyle = '#3f2811'
  for (let x = 8; x < size; x += 24) {
    g.beginPath()
    g.arc(x, size - 5, 3, 0, Math.PI * 2)
    g.fill()
    g.beginPath()
    g.arc(x + rnd() * 4, 4, 2.5, 0, Math.PI * 2)
    g.fill()
  }
  speckle(g, size, 90, ['#6e4722', '#c79a63'], 0.25)
  const tex = track(new CanvasTexture(c))
  tex.wrapS = tex.wrapT = RepeatWrapping
  return tex
}

// ── M3 背景美化(World 海鸟 / Decorations 地面层):透明底剪影,不平铺 ──

/** 飞鸟剪影:透明底深色双弧「∿」,远景鸟群实例面片用 */
export function makeBirdTexture(): CanvasTexture {
  const { c, g } = makeCanvas(64, 32)
  g.strokeStyle = '#2a3542'
  g.lineWidth = 3.5
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(6, 9)
  g.quadraticCurveTo(20, 27, 32, 16)
  g.quadraticCurveTo(44, 27, 58, 9)
  g.stroke()
  return track(new CanvasTexture(c))
}

/** 花丛:弯茎 + 双花头(红瓣黄蕊 + 白瓣橙蕊),草区装饰 */
export function makeFlowerTexture(): CanvasTexture {
  const size = 64
  const { c, g } = makeCanvas(size)
  g.strokeStyle = '#3d8527'
  g.lineWidth = 4
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(30, 64)
  g.quadraticCurveTo(22, 44, 26, 26)
  g.stroke()
  g.beginPath()
  g.moveTo(30, 62)
  g.quadraticCurveTo(42, 50, 45, 36)
  g.lineWidth = 3
  g.stroke()
  // 叶
  g.fillStyle = '#4ea233'
  g.beginPath()
  g.ellipse(37, 47, 7, 3, -0.6, 0, Math.PI * 2)
  g.fill()
  const head = (x: number, y: number, r: number, petal: string, core: string): void => {
    g.fillStyle = petal
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      g.beginPath()
      g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.72, 0, Math.PI * 2)
      g.fill()
    }
    g.fillStyle = core
    g.beginPath()
    g.arc(x, y, r * 0.7, 0, Math.PI * 2)
    g.fill()
  }
  head(26, 20, 6, '#ff6b8a', '#ffd24a')
  head(46, 31, 5, '#ffffff', '#f2b23a')
  return track(new CanvasTexture(c))
}

/** 草丛 + 碎石:石区装饰(灰绿配色,与草区花区分品种) */
export function makeTuftTexture(): CanvasTexture {
  const size = 64
  const { c, g } = makeCanvas(size)
  g.lineCap = 'round'
  const blades: [number, number, string][] = [
    [14, 64, '#6fae5c'],
    [24, 64, '#4e9440'],
    [34, 64, '#6fae5c'],
    [44, 64, '#4e9440'],
    [52, 64, '#5c9e4c'],
  ]
  for (const [x, y0, col] of blades) {
    g.strokeStyle = col
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(x, y0)
    g.quadraticCurveTo(x + (x < 32 ? -6 : 6), y0 - 26, x + (x < 32 ? -10 : 10), y0 - 38)
    g.stroke()
  }
  g.fillStyle = '#9aa0a6'
  g.beginPath()
  g.ellipse(20, 60, 7, 4, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#7c8288'
  g.beginPath()
  g.ellipse(46, 61, 5, 3, 0.3, 0, Math.PI * 2)
  g.fill()
  return track(new CanvasTexture(c))
}

/** 蝴蝶:对称橙翅 + 深身,草区游走装饰 */
export function makeButterflyTexture(): CanvasTexture {
  const size = 64
  const { c, g } = makeCanvas(size)
  for (const s of [-1, 1]) {
    g.fillStyle = '#f28c28'
    g.beginPath()
    g.ellipse(32 + s * 13, 24, 13, 15, s * 0.25, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#ffd24a'
    g.beginPath()
    g.arc(32 + s * 15, 22, 4.5, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = '#33200e'
  g.beginPath()
  g.ellipse(32, 32, 3, 14, 0, 0, Math.PI * 2)
  g.fill()
  return track(new CanvasTexture(c))
}

/** 芦苇:三茎弯弧 + 棕穗头,水域边缘前景 */
export function makeReedTexture(): CanvasTexture {
  const w = 64
  const h = 128
  const { c, g } = makeCanvas(w, h)
  const stems: [number, number][] = [[14, -8], [34, 4], [50, 10]]
  for (const [x, bend] of stems) {
    g.strokeStyle = '#4e9440'
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(x, h)
    g.quadraticCurveTo(x + bend * 0.4, h * 0.5, x + bend, 22)
    g.stroke()
  }
  g.fillStyle = '#8a5a33'
  for (const [x, bend] of [stems[0]!, stems[2]!] as const) {
    g.beginPath()
    g.ellipse(x + bend, 16, 4, 11, bend > 0 ? 0.18 : -0.18, 0, Math.PI * 2)
    g.fill()
  }
  return track(new CanvasTexture(c))
}

/** 花瓣:粉椭圆 + 亮芯,草区飘落粒子用(Points 小图) */
export function makePetalTexture(): CanvasTexture {
  const size = 32
  const { c, g } = makeCanvas(size)
  g.fillStyle = '#ff9ab5'
  g.beginPath()
  g.ellipse(16, 16, 12, 8, 0.5, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#ffc6d6'
  g.beginPath()
  g.ellipse(14, 14, 6, 4, 0.5, 0, Math.PI * 2)
  g.fill()
  return track(new CanvasTexture(c))
}

export function disposeTextures(): void {
  for (const t of registry) t.dispose()
  registry.length = 0
}
