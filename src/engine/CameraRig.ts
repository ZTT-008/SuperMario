import { OrthographicCamera } from 'three'
import { CAM_DEADZONE, CAM_HALF_H, LEVEL_W } from '@/game/constants'

/**
 * 正交侧视相机(DESIGN §10.3):半高 7.5 瓦片(竖向可见 15),半宽按视口
 * 宽高比推;水平死区跟随 + 钳制 [halfW, LEVEL_W − halfW];垂直固定。
 * 相机置于 z=+30 看向 −z,背景视差层放更小 z(M2)。
 */
export class CameraRig {
  readonly camera: OrthographicCamera
  halfW = 10
  centerX = CAM_HALF_H // 初始对准出生点附近

  constructor() {
    this.camera = new OrthographicCamera(-this.halfW, this.halfW, CAM_HALF_H, -CAM_HALF_H, 0.1, 200)
    this.applyFrustum()
  }

  updateViewport(width: number, height: number): void {
    this.halfW = CAM_HALF_H * (width / height)
    this.applyFrustum()
  }

  /** 死区跟随:区内不动,出区平滑逼近(平滑系数按帧时间归一) */
  follow(targetX: number, dt: number): void {
    const delta = targetX - this.centerX
    const excess = Math.abs(delta) - CAM_DEADZONE
    if (excess > 0) {
      const t = Math.min(1, dt * 10)
      this.centerX += Math.sign(delta) * excess * t
    }
    this.centerX = Math.min(Math.max(this.centerX, this.halfW), LEVEL_W - this.halfW)
    this.camera.position.x = this.centerX
    this.camera.lookAt(this.centerX, CAM_HALF_H, 0)
  }

  private applyFrustum(): void {
    this.camera.left = -this.halfW
    this.camera.right = this.halfW
    this.camera.top = CAM_HALF_H
    this.camera.bottom = -CAM_HALF_H
    this.camera.position.set(this.centerX, CAM_HALF_H, 30)
    this.camera.lookAt(this.centerX, CAM_HALF_H, 0)
    this.camera.updateProjectionMatrix()
  }
}
