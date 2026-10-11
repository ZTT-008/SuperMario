import { ACESFilmicToneMapping, Clock, PCFSoftShadowMap, Scene, WebGLRenderer } from 'three'
import type { Game } from '@/game/Game'
import { MAX_FRAME_DT } from '@/game/constants'
import { CameraRig } from './CameraRig'
import { Lighting } from './Lighting'
import { PostFX } from './PostFX'
import { ViewRegistry } from './ViewRegistry'
import { World } from './World'
import { Decorations } from './Decorations'
import { ChunkBuilder } from './mesh/ChunkBuilder'
import { GrayBox } from './mesh/GrayBox'
import type { SkinId } from './mesh/skins'
import { disposeSkinMaterials } from './mesh/skins'
import { applyProceduralEnvironment, disposeMaterials } from './material/MaterialLib'

/**
 * 渲染层生命周期(DESIGN §5.3):WebGLRenderer/Scene/单一 rAF 主循环、
 * resize、dispose。循环内只做:game.frame(固定步物理)→ 相机跟随 →
 * ViewRegistry 插值同步 → 后期渲染。物理与渲染共用同一帧时钟。
 */
export class GameEngine {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly rig = new CameraRig()
  private readonly lighting: Lighting
  private readonly postfx: PostFX
  private readonly views: ViewRegistry
  private readonly grayBox: GrayBox
  private readonly chunkBuilder: ChunkBuilder
  private readonly world: World
  private readonly decorations: Decorations
  private readonly clock = new Clock()
  private readonly observer: ResizeObserver
  private raf = 0
  private disposed = false
  private elapsed = 0
  private frameCount = 0

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly game: Game,
  ) {
    this.renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)) // DPR 钳制
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFSoftShadowMap
    this.renderer.toneMapping = ACESFilmicToneMapping // 颜色管线固定(§10.2)
    this.renderer.toneMappingExposure = 1.15 // ACES 压饱和,曝光补偿提卡通鲜度
    // EffectComposer 多 pass 会让 info 每 pass 自动重置(只剩最后一个 quad);
    // 关自动重置、帧首手动 reset → info = 整帧真实累计(shadow+bloom+output)
    this.renderer.info.autoReset = false
    // 天空由 World 的渐变 ShaderMaterial 铺满视野,不设 scene.background(省一次清屏填充)
    applyProceduralEnvironment(this.renderer, this.scene)
    this.scene.environmentIntensity = 0.8 // 环境反射只补柔和底光,不冲淡配色

    this.lighting = new Lighting(this.scene)
    const { w, h } = this.viewportSize()
    this.renderer.setSize(w, h, false)
    this.rig.updateViewport(w, h)
    this.postfx = new PostFX(this.renderer, this.scene, this.rig.camera, w, h)

    this.views = new ViewRegistry(this.scene)
    this.grayBox = new GrayBox(this.views, this.game.entities, this.scene)
    this.chunkBuilder = new ChunkBuilder(this.scene, this.game.level)
    this.world = new World(this.scene)
    this.decorations = new Decorations(this.scene)
    this.lighting.update(this.rig.centerX)

    if (import.meta.env.DEV) {
      // 渲染诊断入口(visual-scorecard 要求实测):console 里直接查 renderer.info
      ;(window as unknown as Record<string, unknown>).__renderer = this.renderer
      // QA 脚本入口:直接操作实体 + 检查场景图可见性
      ;(window as unknown as Record<string, unknown>).__THREE_GAME__ = {
        game: this.game,
        scene: this.scene,
        setSkin: (id: SkinId) => this.setSkin(id), // 冒烟脚本切皮肤入口
      }
      // threejs-qa inspector 的预算钩子:getter 保证截图时刻读到最新一帧数据
      Object.defineProperty(window, '__THREE_GAME_DIAGNOSTICS__', {
        configurable: true,
        // inspector 读 diagnostics.renderer.{calls,triangles,geometries,textures}
        get: () => {
          const info = this.renderer.info
          return {
            renderer: {
              calls: info.render.calls,
              triangles: info.render.triangles,
              geometries: info.memory.geometries,
              textures: info.memory.textures,
            },
          }
        },
      })
    }

    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(this.canvas)
    this.raf = requestAnimationFrame(this.tick)
  }

  /** 皮肤 MOD:UI 命令入口 → GrayBox 换马里奥模型(game 层无感知,跨 restart 保持) */
  setSkin(id: SkinId): void {
    this.grayBox.setSkin(id)
  }

  private readonly tick = (): void => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.tick)
    const dt = Math.min(this.clock.getDelta(), MAX_FRAME_DT)
    const alpha = this.game.frame(dt)
    const mario = this.game.entities.find((e) => e.kind === 'mario')
    if (mario) this.rig.follow(mario.pos.x, dt)
    this.views.sync(alpha)
    this.lighting.update(this.rig.centerX)
    this.elapsed += dt
    this.world.update(this.rig.centerX, this.elapsed)
    this.decorations.update(this.elapsed)
    this.grayBox.update(dt, this.elapsed)
    this.renderer.info.reset() // 本帧起点
    this.postfx.render()

    if (import.meta.env.DEV && ++this.frameCount % 300 === 0) {
      const info = this.renderer.info
      console.info(
        `[render] calls=${info.render.calls} tris=${info.render.triangles} ` +
          `geo=${info.memory.geometries} tex=${info.memory.textures} progs=${info.programs?.length ?? 0}`,
      )
    }
  }

  private viewportSize(): { w: number; h: number } {
    return {
      w: Math.max(this.canvas.clientWidth, 1),
      h: Math.max(this.canvas.clientHeight, 1),
    }
  }

  private resize(): void {
    const { w, h } = this.viewportSize()
    this.renderer.setSize(w, h, false)
    this.rig.updateViewport(w, h)
    this.postfx.setSize(w, h)
  }

  /** DoD:dispose 无泄漏 —— 停循环、摘监听、释放全部 GPU 资源 */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.observer.disconnect()
    this.world.dispose()
    this.decorations.dispose()
    this.chunkBuilder.dispose()
    this.grayBox.dispose()
    this.views.dispose()
    this.postfx.dispose()
    this.lighting.dispose()
    disposeMaterials()
    disposeSkinMaterials()
    this.scene.environment?.dispose()
    this.renderer.dispose()
  }
}
