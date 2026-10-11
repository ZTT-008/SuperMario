/**
 * 手感参数表(DESIGN 附录 A)—— 唯一调参入口,调参不改逻辑代码。
 * 单位:瓦片/秒(t/s)、瓦片/秒²。
 */
export interface PhysicsConfig {
  walkMax: number
  runMax: number
  accelWalk: number
  accelRun: number
  skidDecel: number
  friction: number
  jumpVel: number
  gravityHold: number
  gravityFall: number
  maxFall: number
  stompBounce: number
  coyoteTime: number
  jumpBufferTime: number
  flagSlideSpeed: number
  goombaSpeed: number
  koopaSpeed: number
  shellSpeed: number
  invincibleTime: number
  transformTime: number
  batSpeed: number
  birdDiveSpeed: number
  birdDiveWindow: number
  paratroopaFlySpeed: number
  platformSpeed: number
}

export const DEFAULT_PHYSICS: PhysicsConfig = {
  walkMax: 4.2,
  runMax: 6.4,
  accelWalk: 12,
  accelRun: 14,
  skidDecel: 20, // 反向输入急停/转身(原版灵魂手感)
  friction: 10,
  jumpVel: 16.5, // 顶点 = v²/2g_hold ≈ 4.26 瓦片(验收 #3)
  gravityHold: 32, // 上升期按住跳键(可变跳高核心)
  gravityFall: 64, // 下落期或提前松键
  maxFall: 20,
  stompBounce: 8, // 踩敌弹跳(按住跳 +10,M3 接线)
  coyoteTime: 0.1,
  jumpBufferTime: 0.1,
  flagSlideSpeed: 6,
  goombaSpeed: 3.2, // 敌潮难度 2.2 → 3.2(每步 0.053 瓦片 ≪ 1,无穿透前提仍成立)
  koopaSpeed: 2.2,
  shellSpeed: 8,
  invincibleTime: 1, // 敌潮难度 2 → 1(重生点距最近出生点 15 瓦片,≈4.7s 才逼近)
  transformTime: 0.5,
  // ── 空中敌与移动浮台(M2)──
  batSpeed: 2.4, // 蝙蝠水平往返(每步 0.04 ≪ 1,免扫掠前提成立)
  birdDiveSpeed: 7, // 俯冲鸟定向速度(x:y ≈ 0.55:1,斜冲)
  birdDiveWindow: 3, // 马里奥进入栖息点水平窗(±瓦片)即触发俯冲
  paratroopaFlySpeed: 2.6, // 飞怪高空巡逻速度
  platformSpeed: 2, // 移动浮台巡航速度(携带位移 = 台 Δx,确定性)
}
