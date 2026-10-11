import {
  BoxGeometry,
  Color,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Mesh,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  type BufferGeometry,
  type Scene,
  type Texture,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { materials } from './material/MaterialLib'
import { makeBirdTexture } from './material/ProceduralTextures'

/**
 * 视差背景层(authoring-recipes:World kit):天空 → 远山 → 近山 → 云 → 灌木。
 * 正交 2D 视差公式:layer.position.x = camX * (1 - p);p=0 完全跟相机(无限远),
 * p=1 世界固定。背景全部 MeshBasic/ShaderMaterial —— 不受光、不投影、零阴影成本,
 * 颜色即剪影(SMB 卡通分层)。
 */
const X0 = -60
const X1 = 271

/** 丘陵链:二次贝塞尔拱起,正弦扰动让每座丘形状不同(确定性,截图可复现) */
function hillGeometry(step: number, height: number, phase: number): ShapeGeometry {
  const shape = new Shape()
  shape.moveTo(X0, -1)
  let x = X0
  let i = 0
  while (x < X1) {
    const nx = Math.min(x + step, X1)
    const peak = 0.55 + 0.45 * Math.abs(Math.sin(i * 2.399 + phase))
    shape.quadraticCurveTo((x + nx) / 2, height * peak, nx, height * 0.08 * (i % 3))
    x = nx
    i++
  }
  shape.lineTo(X1, -1)
  shape.closePath()
  return new ShapeGeometry(shape, 8)
}

/** 灌木簇:3 球 merge → 1 geometry,4~5 个 Mesh 共享(每簇 1 draw call) */
function bushGeometry(): BufferGeometry {
  const parts = [
    new SphereGeometry(0.55, 12, 8).translate(-0.65, 0.4, 0),
    new SphereGeometry(0.7, 14, 10).translate(0.05, 0.62, 0),
    new SphereGeometry(0.5, 12, 8).translate(0.75, 0.35, 0),
  ]
  const merged = mergeGeometries(parts)!
  for (const p of parts) p.dispose()
  return merged
}

/**
 * 帆船双几何:深色件 = 梯形船体(龙骨窄/甲板宽)+ 桅杆 merge;奶白件 = 三角帆。
 * 单色版船体与帆同蓝灰、又卧在海面带里,漂移时读成「帆拖着一小片海水走」→
 * 双色 + 梯形轮廓才读得出是船;桅杆归深色,否则奶白桅对亮天际线整段消失。
 */
function boatGeometries(): { hull: BufferGeometry; sail: BufferGeometry } {
  const hullShape = new Shape()
  hullShape.moveTo(-0.55, 0)
  hullShape.lineTo(0.55, 0)
  hullShape.lineTo(0.8, 0.35)
  hullShape.lineTo(-0.8, 0.35)
  hullShape.closePath()
  const mast = new BoxGeometry(0.06, 1.5, 0.06).translate(0.1, 1.0, 0)
  const hullGeo = mergeGeometries([new ShapeGeometry(hullShape), mast])!
  mast.dispose()
  const sail = new Shape()
  sail.moveTo(0.16, 0.4)
  sail.lineTo(0.16, 1.4)
  sail.lineTo(1.0, 0.5)
  sail.closePath()
  return { hull: hullGeo, sail: new ShapeGeometry(sail) }
}

const CLOUD_WINDOW = 44 // 云在局部窗口内循环漂移,永不枯竭
const BOAT_WINDOW = 40 // 帆船漂移窗口(同云取模公式,速度更慢 = 远景感)
const BIRD_WINDOW = 60 // 鸟群巡航窗口(比视野宽,编队无缝出入画面)
// V 字编队槽位(头鸟在前,两翼逐级后上方),7 位 × 2 编队 = 14 只
const BIRD_SLOTS: readonly (readonly [number, number])[] = [
  [0, 0],
  [-1.8, 0.55],
  [1.8, 0.55],
  [-3.6, 1.1],
  [3.6, 1.1],
  [-5.4, 1.65],
  [5.4, 1.65],
]
const BIRD_FORMATIONS = [
  { cx: 8, cy: 10.6, speed: 0.9 },
  { cx: 30, cy: 12.4, speed: 0.7 },
] as const

export class World {
  private readonly layers: { group: Group; parallax: number }[] = []
  private readonly geometries: BufferGeometry[] = []
  private readonly clouds: { mesh: Mesh; baseX: number }[] = []
  private readonly skyMaterial: ShaderMaterial
  // M3 远景:海 shader 私有(援引 skyMaterial 先例,不入平表);boat/birds 每帧写矩阵
  // uniforms 持强类型引用(noUncheckedIndexedAccess 下 uniforms.x 判 possibly-undefined)
  private readonly seaUniforms: {
    uTime: { value: number }
    uSunX: { value: number }
    uDeep: { value: Color }
    uShallow: { value: Color }
    uGlint: { value: Color }
  }
  private readonly birdUniforms: { uMap: { value: Texture }; uTime: { value: number } }
  private readonly seaMaterial: ShaderMaterial
  private readonly birdMaterial: ShaderMaterial
  private readonly boat: Group
  private readonly birds: InstancedMesh
  private readonly dummy = new Object3D()

  constructor(scene: Scene) {
    // ── 天空:渐变 + 太阳盘 + 光晕,ShaderMaterial 直写 HDR(>1 触发 bloom)──
    this.skyMaterial = new ShaderMaterial({
      uniforms: {
        uTop: { value: new Color(0x2f6fd8) },
        uHorizon: { value: new Color(0xcfe6f7) },
        uSun: { value: new Color(0xfff2c0) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        uniform vec3 uSun;
        varying vec2 vUv;
        void main() {
          float t = smoothstep(0.18, 0.82, vUv.y);
          vec3 col = mix(uHorizon, uTop, t);
          // 60×30 平面 → uv 需 ×(2,1) 还原屏幕比例,太阳才是圆盘不是椭圆
          vec2 d = (vUv - vec2(0.68, 0.72)) * vec2(2.0, 1.0);
          float dist = length(d);
          float disk = smoothstep(0.07, 0.045, dist);
          float halo = pow(max(0.0, 1.0 - dist * 2.2), 4.0) * 0.3;
          col += uSun * (disk * 1.6 + halo);
          gl_FragColor = vec4(col, 1.0);
        }`,
      depthWrite: false,
    })
    const sky = new Group()
    const skyGeo = new PlaneGeometry(60, 30)
    this.geometries.push(skyGeo)
    const skyMesh = new Mesh(skyGeo, this.skyMaterial)
    skyMesh.position.set(0, 7.5, -28)
    skyMesh.renderOrder = -10
    skyMesh.frustumCulled = false
    sky.add(skyMesh)

    // ── 远山 / 近山:卡通剪影丘陵链 ──
    const farHills = new Group()
    const farGeo = hillGeometry(34, 7, 0)
    this.geometries.push(farGeo)
    const farMesh = new Mesh(farGeo, materials.hillFar)
    farMesh.position.z = -22
    farHills.add(farMesh)

    const nearHills = new Group()
    const nearGeo = hillGeometry(22, 4.5, 1.7)
    this.geometries.push(nearGeo)
    const nearMesh = new Mesh(nearGeo, materials.hillNear)
    nearMesh.position.z = -18
    nearHills.add(nearMesh)

    // ── 云:透明 CanvasTexture 面片,缓慢漂移 + 窗口内循环 ──
    const cloudLayer = new Group()
    const cloudGeo = new PlaneGeometry(6, 3)
    this.geometries.push(cloudGeo)
    for (let i = 0; i < 5; i++) {
      const mesh = new Mesh(cloudGeo, materials.cloud)
      mesh.position.set(0, 10.2 + (i % 3) * 1.4, -16)
      mesh.renderOrder = -5
      cloudLayer.add(mesh)
      this.clouds.push({ mesh, baseX: -14 + i * 9.5 })
    }

    // ── 灌木:贴地前景装饰,视差最强(离"相机"最近)──
    const bushLayer = new Group()
    const bushGeo = bushGeometry()
    this.geometries.push(bushGeo)
    for (const bx of [4, 34, 68, 102, 130]) {
      const mesh = new Mesh(bushGeo, materials.bush)
      mesh.position.set(bx, 0.95, -3)
      bushLayer.add(mesh)
    }

    // ── M3 远海:垂直渐变 + 地平线亮线 + 波光 + 太阳倒影柱,纯 shader ──
    // 不复用 materials.waterTop.map(其 offset 被 GrayBox 全局改写),波光全走 shader;
    // z=−20 插在远山(−22)与近山(−18)之间 → 从山谷缝隙露出「群山之间的远海」
    this.seaUniforms = {
      uTime: { value: 0 },
      uSunX: { value: 10.9 }, // 太阳屏幕位世界 x = camX + 10.8(天空 uv(0.68,·)),update 每帧写
      uDeep: { value: new Color(0x1c4f8f) },
      uShallow: { value: new Color(0x4f8fcf) },
      uGlint: { value: new Color(0xffe9b0) },
    }
    this.seaMaterial = new ShaderMaterial({
      uniforms: this.seaUniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying float vWorldX;
        void main() {
          vUv = uv;
          vWorldX = (modelMatrix * vec4(position, 1.0)).x;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uSunX;
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform vec3 uGlint;
        varying vec2 vUv;
        varying float vWorldX;
        void main() {
          float t = vUv.y; // 0 = 海底,1 = 地平线
          vec3 col = mix(uDeep, uShallow, smoothstep(0.0, 0.9, t));
          col += vec3(0.8) * smoothstep(0.965, 1.0, t); // 地平线亮线
          // 波光:双频 sin 乘积,三次幂只留亮峰 → 稀疏闪烁不糊成一片
          float w = sin(vWorldX * 1.4 + uTime * 1.1) * sin(vWorldX * 5.7 - uTime * 0.7);
          col += vec3(1.0) * pow(max(w, 0.0), 3.0) * 0.12 * (1.0 - t * 0.6);
          // 太阳倒影柱:高斯横向衰减,靠地平线更亮(glitter 与波光同相位)
          float gx = abs(vWorldX - uSunX);
          float glitter = exp(-gx * gx * 0.02) * (0.35 + 0.65 * pow(max(w, 0.0), 2.0));
          col += uGlint * glitter * 0.35 * smoothstep(0.1, 0.75, t);
          gl_FragColor = vec4(col, 1.0);
        }`,
      depthWrite: false,
    })
    const seaLayer = new Group()
    seaLayer.name = 'sea'
    const seaGeo = new PlaneGeometry(380, 6) // 宽 380 覆盖 camX 全域 + 视差余量
    this.geometries.push(seaGeo)
    const seaMesh = new Mesh(seaGeo, this.seaMaterial)
    seaMesh.position.set(0, 0.2, -20) // 顶缘 y=3.2,低于近山峰 4.5,只从缝隙露
    seaMesh.renderOrder = -8
    seaMesh.frustumCulled = false
    seaLayer.add(seaMesh)

    // 帆船:与海同组(视差 0.18),窗口取模慢漂 + 微起伏。
    // z=−19.5 在海面(−20)之前、近山(−18)之后;renderOrder −7 介于海面(−8)
    // 与山体(0)之间 → 船稳压海面。遮挡靠材质 depthWrite:false(见 MaterialLib):
    // 船比远山(−22)近,写深度则山体深度测试永远败北、浮在绿草地上层;
    // 不写深度后山体按绘制顺序(后画)盖船,船只从谷缝与海面上露出
    const boatGeo = boatGeometries()
    this.geometries.push(boatGeo.hull, boatGeo.sail)
    this.boat = new Group()
    this.boat.name = 'boat'
    const hullMesh = new Mesh(boatGeo.hull, materials.boatHull)
    const sailMesh = new Mesh(boatGeo.sail, materials.boatSail)
    hullMesh.renderOrder = -7
    sailMesh.renderOrder = -7
    this.boat.add(hullMesh, sailMesh)
    this.boat.position.set(8, 2.7, -19.5) // 船底坐海面带上,地平线(3.2)横穿船身上部
    seaLayer.add(this.boat)

    // ── M3 飞鸟:InstancedMesh + 私有 shader,巡航矩阵 CPU 写、翅扇走 GPU ──
    // aPhase 实例属性 → 顶点按 |uv.x−0.5| 缩 y:身体不动、翅尖上下 = 扇翅
    this.birdUniforms = { uMap: { value: makeBirdTexture() }, uTime: { value: 0 } }
    this.birdMaterial = new ShaderMaterial({
      uniforms: this.birdUniforms,
      vertexShader: /* glsl */ `
        attribute float aPhase;
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          float flap = 0.5 + 0.5 * sin(uTime * 9.0 + aPhase);
          p.y *= 0.7 + 0.45 * flap * smoothstep(0.12, 0.5, abs(uv.x - 0.5));
          vec4 mv = vec4(p, 1.0);
          #ifdef USE_INSTANCING
            mv = instanceMatrix * mv;
          #endif
          gl_Position = projectionMatrix * modelViewMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying vec2 vUv;
        void main() {
          vec4 t = texture2D(uMap, vUv);
          if (t.a < 0.04) discard;
          gl_FragColor = vec4(t.rgb, t.a);
        }`,
      transparent: true,
      depthWrite: false,
    })
    const birdLayer = new Group()
    birdLayer.name = 'birdLayer'
    const birdGeo = new PlaneGeometry(1.1, 0.55)
    birdGeo.setAttribute(
      'aPhase',
      new InstancedBufferAttribute(new Float32Array(14).map((_, i) => i * 1.7), 1),
    )
    this.geometries.push(birdGeo)
    this.birds = new InstancedMesh(birdGeo, this.birdMaterial, 14)
    this.birds.name = 'birds' // QA 按名断言 instanceMatrix.count === 14
    this.birds.position.z = -14
    this.birds.renderOrder = -4
    this.birds.frustumCulled = false
    birdLayer.add(this.birds)

    this.layers.push(
      { group: sky, parallax: 0 },
      { group: cloudLayer, parallax: 0.08 },
      { group: seaLayer, parallax: 0.18 },
      { group: farHills, parallax: 0.12 },
      { group: nearHills, parallax: 0.3 },
      { group: birdLayer, parallax: 0.15 },
      { group: bushLayer, parallax: 0.55 },
    )
    for (const l of this.layers) scene.add(l.group)
  }

  update(camX: number, time: number): void {
    for (const l of this.layers) l.group.position.x = camX * (1 - l.parallax)
    // 云:漂移 + 在视野局部窗口内取模循环(窗口中心 = camX * p)
    const center = camX * 0.08
    for (const c of this.clouds) {
      const lx = c.baseX + time * 0.15
      c.mesh.position.x = center + ((((lx - center + CLOUD_WINDOW / 2) % CLOUD_WINDOW) + CLOUD_WINDOW) % CLOUD_WINDOW) - CLOUD_WINDOW / 2
    }
    // ── M3 海:时间驱动波光;倒影柱对齐太阳屏幕位(世界 x = camX + 10.9)──
    this.seaUniforms.uTime.value = time
    this.seaUniforms.uSunX.value = camX + 10.9
    // 帆船:窗口取模慢漂(同云公式,窗口中心 = camX * p)+ 浮沉
    {
      const bcenter = camX * 0.18
      const lx = 8 + time * 0.3
      this.boat.position.x = bcenter + ((((lx - bcenter + BOAT_WINDOW / 2) % BOAT_WINDOW) + BOAT_WINDOW) % BOAT_WINDOW) - BOAT_WINDOW / 2
      this.boat.position.y = 2.7 + Math.sin(time * 1.3) * 0.05
    }
    // 鸟群:CPU 写巡航矩阵(取模 + 整体正弦升降),翅扇由 shader 按 aPhase 自算
    this.birdUniforms.uTime.value = time
    {
      const fcenter = camX * 0.15
      let i = 0
      for (const f of BIRD_FORMATIONS) {
        const lx = f.cx + time * f.speed
        const fx = fcenter + ((((lx - fcenter + BIRD_WINDOW / 2) % BIRD_WINDOW) + BIRD_WINDOW) % BIRD_WINDOW) - BIRD_WINDOW / 2
        for (const [dx, dy] of BIRD_SLOTS) {
          const phase = i * 1.7 // 与 aPhase 实例属性同序列 → 升降与扇翅同相
          this.dummy.position.set(fx + dx, f.cy + dy + Math.sin(time * 0.7 + phase) * 0.4, 0)
          this.dummy.rotation.z = Math.sin(time * 0.7 + phase) * 0.06
          this.dummy.updateMatrix()
          this.birds.setMatrixAt(i++, this.dummy.matrix)
        }
      }
      this.birds.instanceMatrix.needsUpdate = true
    }
  }

  dispose(): void {
    for (const l of this.layers) l.group.parent?.remove(l.group)
    for (const g of this.geometries) g.dispose()
    this.geometries.length = 0
    this.skyMaterial.dispose()
    this.seaMaterial.dispose()
    this.birdMaterial.dispose() // uMap(bird 贴图)已由 ProceduralTextures track() 统一释放
  }
}
