import {
  HalfFloatType,
  Scene,
  Vector2,
  WebGLRenderTarget,
  WebGLRenderer,
  type OrthographicCamera,
} from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

/** 内联暗角(shader-cookbook 配方):压四角聚拢视线,绝不压暗玩法通道 */
const VignetteShader = {
  uniforms: { tDiffuse: { value: null }, uStrength: { value: 0.5 }, uSize: { value: 0.72 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    uniform float uSize;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float d = distance(vUv, vec2(0.5));
      c.rgb *= mix(1.0, smoothstep(uSize, uSize - 0.45, d), uStrength);
      gl_FragColor = c;
    }`,
}

/**
 * 后期管线(DESIGN §10.2):EffectComposer + RenderPass + UnrealBloomPass
 * (阈值 0.85 只让太阳/问号砖等 HDR 高亮溢出,bloom 不做细节主源)+ 暗角
 * + OutputPass(ACES 色调映射 + sRGB,必须最后)。
 * HDR 中间缓冲 + MSAA 4x(WebGL2 render target samples)。
 */
export class PostFX {
  private readonly composer: EffectComposer
  private readonly bloom: UnrealBloomPass
  private readonly vignette: ShaderPass

  constructor(renderer: WebGLRenderer, scene: Scene, camera: OrthographicCamera, width: number, height: number) {
    const rt = new WebGLRenderTarget(width, height, { type: HalfFloatType, samples: 4 })
    this.composer = new EffectComposer(renderer, rt)
    this.composer.addPass(new RenderPass(scene, camera))
    this.bloom = new UnrealBloomPass(new Vector2(width, height), 0.45, 0.3, 0.85)
    this.composer.addPass(this.bloom)
    this.vignette = new ShaderPass(VignetteShader)
    this.composer.addPass(this.vignette)
    this.composer.addPass(new OutputPass())
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height)
  }

  render(): void {
    this.composer.render()
  }

  dispose(): void {
    this.bloom.dispose()
    this.vignette.dispose()
    this.composer.dispose()
  }
}
