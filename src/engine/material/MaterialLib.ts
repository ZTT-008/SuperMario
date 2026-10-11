import {
  DataTexture,
  EquirectangularReflectionMapping,
  FloatType,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PMREMGenerator,
  PointsMaterial,
  RGBAFormat,
  Scene,
  WebGLRenderer,
} from 'three'
import {
  disposeTextures,
  makeBrickTexture,
  makeButterflyTexture,
  makeCloudTexture,
  makeCrateTexture,
  makeFlowerTexture,
  makeGrassTexture,
  makeGroundDirtTexture,
  makePetalTexture,
  makePipeTexture,
  makePlatformTexture,
  makeQuestionTexture,
  makeReedTexture,
  makeSnowDirtTexture,
  makeSnowTopTexture,
  makeSpikeTexture,
  makeStoneDirtTexture,
  makeStoneTopTexture,
  makeTuftTexture,
  makeWaterTexture,
} from './ProceduralTextures'

/**
 * 程序化环境反射(DESIGN §10.2):渐变等距柱状 DataTexture → PMREMGenerator
 * → scene.environment。three 的 PBR 按 roughness 采样 IBL 必须经 PMREM,
 * 裸 CubeTexture 得不到柔和反射;全程无外部文件。
 */
export function applyProceduralEnvironment(renderer: WebGLRenderer, scene: Scene): void {
  const w = 64
  const h = 32
  const data = new Float32Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1) // 0 = 天顶,1 = 地面
    let r: number, g: number, b: number
    if (v < 0.5) {
      const t = v / 0.5 // 天顶蓝 → 地平线暖
      r = 0.3 + t * 0.65
      g = 0.5 + t * 0.3
      b = 0.9 - t * 0.3
    } else {
      const t = (v - 0.5) / 0.5 // 地平线暖 → 地面灰
      r = 0.95 - t * 0.6
      g = 0.8 - t * 0.48
      b = 0.6 - t * 0.3
    }
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 1
    }
  }
  const tex = new DataTexture(data, w, h, RGBAFormat, FloatType)
  tex.mapping = EquirectangularReflectionMapping
  tex.needsUpdate = true

  const pmrem = new PMREMGenerator(renderer)
  scene.environment = pmrem.fromEquirectangular(tex).texture
  pmrem.dispose()
  tex.dispose()
}

/**
 * 共享材质按「角色」命名(technical-art 材质库约定):同一视觉角色全局复用
 * 一个实例,draw call 与 program 数都不随内容增长。metalness=0 介质为主,
 * 靠 roughness 对比(哑光泥土 vs 半亮金砖)区分角色,不只靠色相。
 */
const dirt = makeGroundDirtTexture()
const grass = makeGrassTexture()
const crate = makeCrateTexture()
const question = makeQuestionTexture()
const cloud = makeCloudTexture()
const water = makeWaterTexture()
const stoneDirt = makeStoneDirtTexture()
const stoneTop = makeStoneTopTexture()
const snowDirt = makeSnowDirtTexture()
const snowTop = makeSnowTopTexture()
const brick = makeBrickTexture()
const pipe = makePipeTexture()
const spike = makeSpikeTexture()
const platform = makePlatformTexture()
// M3 背景美化(bird 贴图由 World 直取工厂做 shader uniform,不占平表)
const flower = makeFlowerTexture()
const tuft = makeTuftTexture()
const butterfly = makeButterflyTexture()
const reed = makeReedTexture()
const petal = makePetalTexture()

export const materials = {
  groundDirt: new MeshStandardMaterial({ map: dirt, roughness: 0.88, metalness: 0 }),
  grassTop: new MeshStandardMaterial({ map: grass, roughness: 0.92, metalness: 0 }),
  crateWood: new MeshStandardMaterial({ map: crate, roughness: 0.68, metalness: 0 }),
  questionGold: new MeshStandardMaterial({
    map: question,
    emissive: 0xffb03a,
    emissiveMap: question,
    emissiveIntensity: 0.35,
    roughness: 0.5,
    metalness: 0.25,
    envMapIntensity: 1.1,
  }),
  // 马里奥配色分区(剪影靠色块,不靠贴图)
  marioSkin: new MeshStandardMaterial({ color: 0xf2b28c, roughness: 0.62 }),
  marioShirt: new MeshStandardMaterial({ color: 0xd8231f, roughness: 0.66 }),
  marioOveralls: new MeshStandardMaterial({ color: 0x2a5bd7, roughness: 0.72 }),
  marioShoes: new MeshStandardMaterial({ color: 0x6b3410, roughness: 0.55 }),
  marioHair: new MeshStandardMaterial({ color: 0x33200e, roughness: 0.82 }),
  // 敌人配色
  goombaBody: new MeshStandardMaterial({ color: 0x9c5a1e, roughness: 0.8 }),
  goombaFoot: new MeshStandardMaterial({ color: 0x3a2410, roughness: 0.75 }),
  goombaEye: new MeshStandardMaterial({ color: 0xf5efe0, roughness: 0.4 }),
  // 奖励/终点
  coin: new MeshStandardMaterial({
    color: 0xffd24a,
    emissive: 0xffaa00,
    emissiveIntensity: 0.7,
    metalness: 0.6,
    roughness: 0.25,
  }),
  flagPole: new MeshStandardMaterial({ color: 0xcfd6dd, metalness: 0.6, roughness: 0.35 }),
  flagCloth: new MeshBasicMaterial({ color: 0xd8231f }),
  // 水域:半透明体块 + 流动波面(uv 滚动)
  waterBody: new MeshStandardMaterial({
    color: 0x1f5fae,
    transparent: true,
    opacity: 0.82,
    roughness: 0.2,
    metalness: 0.1,
  }),
  waterTop: new MeshStandardMaterial({ map: water, transparent: true, opacity: 0.92, roughness: 0.15, metalness: 0.1 }),
  // ── M2 地形样式带(ChunkBuilder 按 STYLE_ZONES 换实例网格材质,+0 draw)──
  stoneDirt: new MeshStandardMaterial({ map: stoneDirt, roughness: 0.9, metalness: 0.05 }),
  stoneTop: new MeshStandardMaterial({ map: stoneTop, roughness: 0.85, metalness: 0.05 }),
  snowDirt: new MeshStandardMaterial({ map: snowDirt, roughness: 0.6, metalness: 0.08 }),
  snowTop: new MeshStandardMaterial({ map: snowTop, roughness: 0.5, metalness: 0.1 }),
  brickBlock: new MeshStandardMaterial({ map: brick, roughness: 0.8, metalness: 0 }),
  pipeBody: new MeshStandardMaterial({ map: pipe, roughness: 0.45, metalness: 0.05 }),
  pipeRim: new MeshStandardMaterial({ map: pipe, roughness: 0.4, metalness: 0.08 }),
  spikeMetal: new MeshStandardMaterial({ map: spike, roughness: 0.3, metalness: 0.55 }),
  // 单向桥与移动浮台共用木台材质(同角色同实例,program 不增)
  platformWood: new MeshStandardMaterial({ map: platform, roughness: 0.72, metalness: 0 }),
  // ── M2 空中敌配色(剪影靠色块,延续 goomba 分区法)──
  batBody: new MeshStandardMaterial({ color: 0x5a4a6e, roughness: 0.8 }),
  batWing: new MeshStandardMaterial({ color: 0x2e2438, roughness: 0.75 }),
  birdBody: new MeshStandardMaterial({ color: 0xc9502f, roughness: 0.75 }),
  birdWing: new MeshStandardMaterial({ color: 0x8f3423, roughness: 0.7 }),
  birdBeak: new MeshStandardMaterial({ color: 0xf2b23a, roughness: 0.5 }),
  paraShell: new MeshStandardMaterial({ color: 0x3fae49, roughness: 0.55, metalness: 0.05 }),
  paraBody: new MeshStandardMaterial({ color: 0xf2d34a, roughness: 0.65 }),
  // 背景层不受光(MeshBasic 卡通剪影,零光照成本,颜色即所见)
  hillFar: new MeshBasicMaterial({ color: 0x9ecf9a }),
  hillNear: new MeshBasicMaterial({ color: 0x6fae5c }),
  bush: new MeshBasicMaterial({ color: 0x4e9440 }),
  cloud: new MeshBasicMaterial({ map: cloud, transparent: true, depthWrite: false }),
  // ── M3 背景美化(Decorations 地面层/粒子;Basic 剪影不受光,平表统一 dispose)──
  flower: new MeshBasicMaterial({ map: flower, transparent: true, depthWrite: false }),
  tuft: new MeshBasicMaterial({ map: tuft, transparent: true, depthWrite: false }),
  butterfly: new MeshBasicMaterial({ map: butterfly, transparent: true, depthWrite: false }),
  reed: new MeshBasicMaterial({ map: reed, transparent: true, depthWrite: false }),
  // 粒子:sizeAttenuation=false → 正交相机下 size 为设备像素,不随深度缩放
  petal: new PointsMaterial({ map: petal, transparent: true, depthWrite: false, size: 9, sizeAttenuation: false }),
  snowDots: new PointsMaterial({ color: 0xf5f9ff, transparent: true, opacity: 0.9, depthWrite: false, size: 5, sizeAttenuation: false }),
  pineDark: new MeshBasicMaterial({ color: 0x2e5d3a }),
  snowMound: new MeshBasicMaterial({ color: 0xf3f7fb }),
  sailDark: new MeshBasicMaterial({ color: 0x44586e }),
}

export function disposeMaterials(): void {
  for (const m of Object.values(materials)) m.dispose()
  disposeTextures()
}
