import { DirectionalLight, HemisphereLight, Scene } from 'three'

/**
 * 三点式:暖太阳(唯一投影)+ 冷半球光补暗部 + 冷 rim 逆光描边(authoring-recipes:
 * rim separates the hero from the background)。只有玩法层投影;正交阴影视锥紧贴
 * 相机视野,随相机平移。投影灯 ≤2(technical-art 预算):这里只有 1 盏。
 */
export class Lighting {
  private readonly sun: DirectionalLight
  private readonly hemi: HemisphereLight
  private readonly rim: DirectionalLight

  constructor(scene: Scene) {
    this.sun = new DirectionalLight(0xfff2cc, 2.4)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.camera.left = -24
    this.sun.shadow.camera.right = 24
    this.sun.shadow.camera.top = 20
    this.sun.shadow.camera.bottom = -4
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 90
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.03

    this.hemi = new HemisphereLight(0x9fd0ff, 0x6f5a3a, 0.85)

    // rim:从后下方打冷色逆光,给马里奥/砖块边缘描亮边,与背景分离
    this.rim = new DirectionalLight(0xbfe0ff, 1.4)

    scene.add(this.sun, this.sun.target, this.hemi, this.rim, this.rim.target)
  }

  /** 灯光与阴影视锥跟随相机水平移动 */
  update(camX: number): void {
    this.sun.position.set(camX - 12, 26, 18)
    this.sun.target.position.set(camX, 1, 0)
    this.sun.target.updateMatrixWorld()
    this.rim.position.set(camX - 14, 12, -18)
    this.rim.target.position.set(camX, 3, 0)
    this.rim.target.updateMatrixWorld()
  }

  dispose(): void {
    this.sun.shadow.dispose()
  }
}
