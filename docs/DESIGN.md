# 超级马里奥 1-1(three.js + Vue3)设计文档

> 版本:v1.1 · 日期:2026-10-11 · 状态:已评审(修订)
> 定位:「原汁原味二维玩法 × 现代 3D 画风」的 Super Mario Bros. World 1-1 复刻
> v1.1 修订:渲染层 API 由 Babylon.js 命名更正为 three.js 真实 API(`three` + `three/addons`);跳跃初速对齐验收 #3;新增页面可见性/失焦/WebGL context lost 处理与颜色管理管线;新增程序化贴图与低多边形预算(§10.5);版权不再作为约束(BGM 可忠实翻奏)

---

## 目录

1. [项目概述与范围](#1-项目概述与范围)
2. [需求分析](#2-需求分析)
3. [玩法设计](#3-玩法设计)
4. [技术选型与理由](#4-技术选型与理由)
5. [总体架构](#5-总体架构)
6. [游戏循环](#6-游戏循环)
7. [物理与碰撞方案](#7-物理与碰撞方案)
8. [关卡设计(World 1-1)](#8-关卡设计world-1-1)
9. [实体系统](#9-实体系统)
10. [渲染与美术方案](#10-渲染与美术方案)
11. [音效方案](#11-音效方案)
12. [UI 设计](#12-ui-设计)
13. [项目结构与测试策略](#13-项目结构与测试策略)
14. [里程碑拆分](#14-里程碑拆分)
15. [验收标准](#15-验收标准)
16. [风险与备选方案](#16-风险与备选方案)
- [附录 A:手感参数表](#附录-a手感参数表)
- [附录 B:1-1 ASCII 地图](#附录-b1-1-ascii-地图)
- [附录 C:事件与接口清单](#附录-c事件与接口清单)

---

## 1. 项目概述与范围

### 1.1 背景与目标

用 **three.js + Vue3** 开发一款浏览器端 2D 平台跳跃游戏,玩法**原汁原味**复刻初代《超级马里奥兄弟》World 1-1:横版卷轴、跑跳、顶砖、踩敌、吃蘑菇变大、火焰花、金币、水管、旗杆通关。

视觉上不采用像素风,而是**现代 3D 感觉**:全部对象用 3D 网格程序化建模,以 PBR 材质、柔和阴影、泛光后期渲染;但相机采用**正交(Orthographic)侧视相机**,玩法严格限制在 XY 平面 —— 即「视觉是 3D 的,玩法是纯 2D 的」。

### 1.2 范围(In Scope)

- 经典 World 1-1 单关完整通关流程。
- 马里奥三种能力形态:小 / 超级 / 火焰(火焰花可发射火球)。
- 敌人:栗子仔(Goomba)、库巴龟(Koopa Troopa,含龟壳踢飞连锁)。
- 交互:问号砖/砖块顶击、金币收集、蘑菇/火焰花道具、单向平台、水管、坑、楼梯、旗杆滑降 + 城堡结算。
- HUD 五要素(分数/金币/时间/生命/世界)与开始、暂停、死亡、通关、Game Over 界面流程。
- 键盘操作为主,触屏虚拟按键为辅。
- 程序化 8-bit 风格音效;BGM 为可选加分项。

### 1.3 非目标(Out of Scope)

- 不做多人、不做关卡编辑器、不做关卡选择地图、不做 2-1 及以后关卡。
- 不做存档/云同步、不做手柄支持(可后续扩展)。
- 不还原地下关(BGM 切换等)、不做无敌星(架构预留,见 §3.4)。
- 不使用外部 3D 模型、贴图与音频文件(全部运行时程序化生成,见 §10、§11)。

---

## 2. 需求分析

### 2.1 功能需求

| 编号 | 需求 | 优先级 |
|---|---|---|
| F1 | 马里奥跑/走/跳/急转身/下蹲,可变跳跃高度,手感接近原版 | P0 |
| F2 | 1-1 关卡地形:地面、砖块、问号砖、水管、坑、楼梯、旗杆 | P0 |
| F3 | 顶砖:小状态顶起、超级/火焰碎砖、问号砖弹道具 | P0 |
| F4 | 能力变化:吃蘑菇变大、吃火焰花变火焰、发射火球、受击回小 | P0 |
| F5 | 敌人:Goomba 巡逻、Koopa 踩→龟壳→踢飞→连锁击杀 | P0 |
| F6 | 踩敌弹跳(按住跳键弹更高)、侧碰受伤、掉坑死亡 | P0 |
| F7 | 金币:实体金币 + 问号砖金币,100 金币 +1 命 | P0 |
| F8 | 相机水平卷轴跟随(死区),背景视差层 | P0 |
| F9 | HUD:分数、金币数、WORLD 1-1、TIME 倒计时、生命数 | P0 |
| F10 | 界面流程:开始 → 游玩 → 暂停 → 死亡扣命 → 通关结算 → Game Over | P0 |
| F11 | 旗杆:触碰滑降、按高度给分、走进城堡通关 | P0 |
| F12 | 8-bit 音效:跳跃/顶砖/金币/踩敌/受伤/拾取/死亡/通关 | P1 |
| F13 | 触屏虚拟按键 | P2 |
| F14 | BGM(1-1 主题程序化音序) | P2 |

### 2.2 非功能需求

| 编号 | 需求 |
|---|---|
| N1 | 桌面中端机 Chrome 稳定 60fps;draw call < 100,场景多边形 < 5 万 |
| N2 | 零外部资源(无模型/贴图/音频文件),首屏加载 < 2s |
| N3 | 物理与关卡层为纯 TypeScript,可在 Vitest 中无浏览器运行单元测试 |
| N4 | 玩法真相层(`game/`)不依赖 three.js(ESLint 强制),渲染可整体替换 |
| N5 | 兼容近两年 Chrome / Edge / Firefox / Safari(WebGL2) |
| N6 | 手感参数集中在单一配置文件,调参不改逻辑代码 |

---

## 3. 玩法设计

### 3.1 核心机制

- 世界以**瓦片**为基本尺度(16×16 逻辑像素 = 1 世界单位),关卡宽 211 瓦片、高 15 瓦片,与原版 3360×240px ÷ 16 一致。
- 马里奥只有 2D 自由度(X 移动、Y 跳跃/坠落),Z 轴仅用于渲染层次。
- 卷轴单向向右(不可回头越过相机左边界),还原原版行为。

### 3.2 马里奥能力层与状态机

**能力层**:`small / super / fire`

- 受击一律降回 `small`(忠实 SMB1,而非 SMB3 的逐级降级),随后 2 秒无敌闪烁。
- 火焰形态可发射最多 2 枚火球,火球落地弹跳、碰敌即灭、可穿砖。
- 形态切换有 0.5s 变身/受伤动画(缩放+闪烁),期间免疫伤害。

**行为态**(枚举状态机):

```
idle → walk ⇄ skid(反向输入急停转身)
     → jump(上升)→ fall(下落)→ idle/walk(落地)
     → crouch(仅 super/fire,下蹲)
     → damage(受伤动画)→ 恢复
     → dead(死亡:上抛跳出屏幕)
     → flagSlide(旗杆滑降)→ win(走进城堡)
```

### 3.3 敌人行为

| 敌人 | 行为 |
|---|---|
| Goomba | 恒速 2.2 t/s 向左;撞墙/瓦片转向;不检测边缘(会走下台阶);踩死→压扁 0.3s 消失;侧碰伤马里奥 |
| Koopa | 恒速 2.2 t/s;被踩→变**龟壳**(静止);马里奥碰静止壳→**踢飞**(8 t/s 水平);飞行壳击杀其他敌人(连锁加分翻倍)且反弹伤马里奥;壳静止 4s 复活走动 |
| 翻转死亡 | 被踩/被壳击中的敌人上抛(vy=+8)再坠落,飞出屏幕回收 |

### 3.4 交互规则

- **顶砖**:头撞可顶瓦片 → 砖碎裂(超级/火焰)或顶起(小);问号砖弹内容物后变 `u`(已用);站在该砖顶面的敌人被震翻死亡。
- **道具**:超级蘑菇水平匀速移动(撞墙转向、遇台阶下落);火焰花原地从砖中升起(1s 升起动画,期间不可拾取);1UP 蘑菇(隐藏砖,可选)。
- **金币**:实体金币旋转动画,重叠即拾取;问号砖顶出金币向上弹跳后消失计分。
- **旗杆**:触碰判定区 → 按抓住的高度获得 100~5000 分 → 滑降 → 落地 → 向右走进城堡 → 时间分结算 → 通关。
- **死亡**:掉坑 / 被敌侧碰(小状态)→ 死亡动画 → 生命 −1 → 从出生点或检查点重开(1-1 无检查点,从起点重开);生命耗尽 → Game Over。
- **无敌星**:预留 —— 仅加一个 `invincible` 计时标志与敌人接触分支,不动架构,本期不实现。

---

## 4. 技术选型与理由

| 项 | 选型 | 版本(2026-10-11 `npm view` + 实装核实) | 理由 |
|---|---|---|---|
| 构建 | Vite | ^8.2(实装 8.3.4) | 官方 Vue 模板默认,ESM 快启动;与 three 的 ESM 兼容良好 |
| 框架 | Vue | ^3.5(实装 3.5.43) | 仅做壳层/HUD,Composition API 足够 |
| 语言 | TypeScript | ~6.0(模板锁 6.0;latest 7.0 暂不追) | 严格模式;物理/关卡纯 TS 便于单测 |
| 渲染 | `three` + `three/addons` + `@types/three` | `~0.186`(实装 0.186.1,锁 minor) | three 本身即 ESM 且可 tree-shaking,**无需 scoped 包**;后期(`EffectComposer`/`UnrealBloomPass`)、天空(`Sky`)、几何合并(`mergeGeometries`)全部来自官方 `three/addons` 入口,零第三方渲染依赖 |
| 状态 | 不用 Pinia,轻量 composable store | — | 见下 |
| 测试 | Vitest | ^4(模板默认 4.1;latest 5.x 暂不追) | 只对 `physics/`、`level/` 纯逻辑层写单测 |
| 脚手架 | `npm create vue@latest`(Vite+TS+ESLint) | 3.24.0 | 不手写配置 |

> **注(TypeScript)**:create-vue 3.24 实装 `typescript ~6.0.0` + `vue-tsc 3.3`,M0 已验证 `type-check`/`build` 全绿。TS 7.0(原生编译器)已是 latest,升级属后续可评估项,不影响架构。

> **注(v1.0 渲染选型勘误)**:v1.0 把渲染层写成 `@threejs/core`/`@threejs/materials` 及 `MeshBuilder`/`DefaultRenderingPipeline`/`ShadowGenerator`/`runRenderLoop` 等 API —— 那是 **Babylon.js** 的包与 API,three.js 并不存在。v1.1 已全部更正为 three.js 真实 API(见 §6、§10、§16);三层架构与边界不变。

**不用 Pinia**:全局共享状态只有 HUD 快照(分数/金币/时间/生命)与界面阶段,单页面、无跨路由共享;真正的「真相源」在引擎侧纯 TS 对象里,Vue 侧只是低频镜像(金币/分数是离散事件,计时器约 0.4s 才跳一格)。一个 `useGameSession()` composable(reactive 快照 + 事件订阅)约 40 行,比引入 Pinia 依赖与样板更干净。团队若偏好 Pinia 完全可行,属风格选择而非架构分歧。

**不用 Havok 物理**:平台跳跃需要的是「手感」而非「真实」—— 可变跳高、急转身、踩敌弹跳等都用参数直接表达最可控;Havok 连续物理调马里奥手感事倍功半,且 WASM 包体大。

**不用 Howler / 音频文件**:8-bit 音效本质是方波/噪声 + 包络,WebAudio 原生 ~100 行解决,零依赖零加载(见 §11)。

**不用 glTF 模型**:单关卡、实体少,程序化建模即可达成「圆润现代」目标,免模型管线/加载器/贴图资产/CORS 问题;改造型 = 改参数。ViewRegistry 边界(§5)保证后期可无痛替换为 glTF。

---

## 5. 总体架构

### 5.1 三层职责边界(最重要约束)

```
┌─ ui/(Vue)────────── 只做:壳层、HUD、菜单、暂停/死亡/通关界面、触屏按钮
│        ↑ 低频事件快照(仅 HUD/阶段变化时发,非每帧)
├─ game/(纯 TS)───── 玩法真相:实体、物理、关卡、输入、音频、游戏状态机
│        ↓ 每帧读取实体 transform
└─ engine/(three)── 只做:Engine/Scene/相机/灯光/后期/网格工厂/ViewRegistry/FX
```

三条硬性规则:

1. **`game/` 禁止 import `three` 与 `three/addons`**(ESLint `no-restricted-imports` 第一天就锁死,patterns 同时拉黑 `@threejs/*` 防止再次引入错包;后期无法低成本补救)。实体只持有纯数据(pos/vel/aabb/state);渲染由 engine 层 `ViewRegistry` 每帧把实体 transform 同步到网格。收益:物理与关卡可在 Vitest 中无浏览器运行;对象池、剔除都在 engine 层,game 层无感知。
2. **Vue 不参与每帧逻辑**。引擎→UI 只发离散事件(`hud:coin`、`hud:score`、`phase:change`、`mario:state`);UI→引擎只调命令方法(`start/pause/resume/restart`)。
3. **游戏核心不读 Vue reactive 对象**,避免每帧响应式代理开销与双向耦合。

### 5.2 引擎对 Vue 的唯一接口

```ts
// game/Game.ts —— Vue 唯一认识的类
class Game {
  constructor(canvas: HTMLCanvasElement, hooks: GameHooks);
  start(): void; pause(): void; resume(): void; restart(): void; dispose(): void;
}
interface GameHooks {
  onPhase(p: 'ready'|'playing'|'paused'|'dying'|'clear'|'gameover'): void;
  onHud(s: { score: number; coins: number; time: number; lives: number;
             mario: 'small'|'super'|'fire' }): void;   // 仅变化时触发
}
```

### 5.3 目录结构

```
src/
  main.ts  App.vue
  engine/
    GameEngine.ts        # WebGLRenderer/Scene/rAF 主循环生命周期、resize、dispose
    CameraRig.ts         # 正交相机跟随(死区/钳制/视口宽高比)
    Lighting.ts          # 方向光+阴影生成器+半球环境光
    PostFX.ts            # EffectComposer + UnrealBloomPass + OutputPass(泛光/色调映射/sRGB)
    ViewRegistry.ts      # 实体类型→网格绑定/回收,每帧 transform 同步+插值
    fx/Particles.ts      # 砖块碎片、金币闪光、得分飘字(对象池)
    mesh/                # 程序化网格工厂
      MarioMesh.ts  EnemyMesh.ts  TileMeshes.ts  PipeMesh.ts
      PropMeshes.ts(山丘/灌木/云/旗杆/城堡)  ChunkBuilder.ts(瓦片分块实例化)
    material/MaterialLib.ts  # PBR 材质库+程序化环境贴图(PMREM)+程序化 CanvasTexture
  game/                  # 纯 TS,零 three 依赖
    Game.ts              # 总编排 + 游戏阶段状态机
    FixedStepLoop.ts     # 固定步累加器(被 GameEngine 的渲染循环调用)
    input/InputManager.ts  # 键盘/触屏→InputState,边沿检测、跳跃缓冲
    physics/
      AABB.ts  TileResolver.ts   # 分轴扫掠解析
      PhysicsConfig.ts           # 手感参数表(唯一调参入口)
    level/
      Level1_1.ts        # ASCII 地图 + 实体出生点数据
      LevelParser.ts     # ASCII → TileMap + EntitySpawn[]
      TileMap.ts  TileRules.ts   # 瓦片类型/碰撞层/可击打规则
    entities/
      Entity.ts  MovableEntity.ts
      Mario.ts  Goomba.ts  Koopa.ts
      MushroomItem.ts  FireFlowerItem.ts  Coin.ts  Flagpole.ts
    audio/
      AudioEngine.ts     # WebAudio 上下文、手势解锁、总线
      Sfx.ts             # 程序化 8-bit 音效
      Bgm.ts             # 可选:1-1 主题音序器
    events/TypedEventBus.ts
    types.ts  constants.ts
  ui/
    composables/useGameSession.ts   # 桥接:订阅引擎事件→reactive 快照
    components/
      GameCanvas.vue  HudBar.vue  StartScreen.vue  PauseOverlay.vue
      DeathOverlay.vue  LevelClear.vue  TouchControls.vue
```

---

## 6. 游戏循环

- **驱动方式**:three 没有内置渲染循环 —— 全游戏**只手写一个 `requestAnimationFrame` 主循环**,帧时间取 `THREE.Clock` 的 delta,在循环内做「固定步物理 + 渲染」,物理与渲染共用同一帧时钟,不存在双循环打架。
- **固定步**:`dt = 1/60`;累加器 `acc += min(realDt, 0.1)`(钳制防卡顿雪崩);`while (acc >= dt) { input.sample(); world.step(dt); acc -= dt; }`,**单帧最多 5 步**,超出丢弃 —— 慢机器降物理频率而非螺旋卡死。
- **渲染插值**:每个 MovableEntity 保存 `prevPos/curPos`,ViewRegistry 用 `alpha = acc/dt` 做 `lerp(prev, cur, alpha)` 写网格位置 —— 固定步+插值是「原汁原味手感 + 高刷屏丝滑」的标准答案。此机制须在 M0 就搭好,后补会侵入所有实体。
- **输入采样**:键盘事件只更新原始位图;每个固定步开始时生成 `InputState` 快照(含 `jumpPressed` 边沿),保证同一步内所有实体看到同一输入,且测试可注入:

```ts
interface InputState {
  left: boolean; right: boolean; run: boolean; crouch: boolean;
  jumpHeld: boolean; jumpPressed: boolean;   // 每固定步采样的边沿
}
```

- **计时器**:游戏内倒计时按固定步计数(原版每 ~24 帧减 1,即约 0.4s/格),与真实秒解耦,忠实还原紧迫感。
- **页面可见性与焦点**:`document.visibilitychange` 隐藏时自动 `playing → paused`(防止后台偷时间、物理追帧);`window.blur` 清空输入位图,避免切回页面时「按键卡住」。

---

## 7. 物理与碰撞方案

### 7.1 坐标系与单位

- 世界单位:**1 瓦片 = 1 单位**;X 向右、Y 向上;实体以 AABB(轴对齐包围盒)+ 中心点位置表达。
- 碰撞盒:马里奥小 `0.8×0.95`、超级/火焰 `0.8×1.9`;Goomba `0.9×0.9`;Koopa `0.9×1.3`、龟壳 `0.9×0.8`。

### 7.2 碰撞解析:分轴 AABB(不做连续扫掠)

1. **X 位移** → 与重叠瓦片求交钳制(命中则 `vx=0`);
2. **Y 位移** → 向下命中置 `onGround`,向上命中触发「顶砖」。

**无需连续扫掠的理由**:最大水平速度 6.4 t/s × 1/60 ≈ 0.11 瓦片/步,坠落上限 20 t/s ≈ 0.33 瓦片/步,均远小于 1 瓦片,不会穿透;`maxFall` 钳到 < 60 瓦片/步即安全前提。

### 7.3 特殊碰撞

- **单向平台(semisolid)**:仅当 `vy < 0` 且 `prevBottom >= platformTop` 时解析 Y;X 方向永不与 semisolid 交互。
- **从下方顶砖**:头部命中「可顶瓦片」→ 瓦片进入 bump 动画(上移 0.25 瓦片、0.18s 缓回落,**期间该瓦片对实体不碰撞**防卡头);砖块:超级/火焰→碎裂(碎片粒子+得分),小→仅顶起;问号砖→弹出内容物变 `u`。站在该砖顶面的敌人被顶击翻转死亡。
- **敌人掉落**:敌人无水平摩擦,走出边缘直接下落;翻转死亡时 `vy=+8` 上抛再坠落,飞出屏幕回收。

### 7.4 手感参数(核心决策,完整表见附录 A)

所有参数集中在 `game/physics/PhysicsConfig.ts`,是唯一调参入口:

```ts
interface PhysicsConfig {
  walkMax; runMax; accelWalk; accelRun; skidDecel; friction;
  jumpVel; gravityHold; gravityFall; maxFall;
  stompBounce; coyoteTime; jumpBufferTime; flagSlideSpeed;
}
```

设计要点:**可变跳高完全由「按住跳键 = 低重力 gravityHold 32,松开/下落 = 双倍重力 gravityFall 64」实现**,不需要跳跃时长计数器 —— 最简且手感最好。急转身(skidDecel 20)是原版灵魂手感,必须实现。另加现代修正 coyote time / jump buffer 各 0.1s(约 6 帧),降低「差一点」的挫败感。

---

## 8. 关卡设计(World 1-1)

### 8.1 数据表示:ASCII 地形 + TS 实体表

- **地形用 ASCII 字符图**:15 行 × 211 列。ASCII 肉眼可读、可直接对照原版地图 diff、解析器 30 行搞定;JSON 反而难写难校对。
- **实体(敌人/金币/道具/旗杆)用 TS 数组**(带类型检查、可注释),坐标为瓦片坐标。金币虽视觉像瓦片,也作为实体对象(需旋转动画、拾取判定、对象池)。
- 解析后地形存 `Uint8Array(211×15)` 网格 + 每类瓦片元数据表(碰撞层 solid/semisolid/none;交互:可顶/可碎/内容物)。

字符图例:`#` 地面,`X` 砖块,`?` 问号砖,`u` 已用砖,`P` 水管体(水管按对象记录高度更干净,图中仅为可读性),`=` 单向平台,`^` 楼梯实心块,`.` 空。

```ts
interface LevelDef {
  width: 211; height: 15; rows: string[];   // ASCII
  playerSpawn: Vec2; flagX: number; entities: EntitySpawn[];
}
```

### 8.2 1-1 分段蓝图(基准坐标,实现时按 ASCII 图微调)

| 段 | 瓦片 x | 内容 |
|---|---|---|
| 起始平地 | 0–14 | 马里奥出生 x≈3;背景山丘/灌木 |
| 首个问号砖 | 16 | 内含**超级蘑菇**(首次能力升级) |
| 五连砖组 | 20–24 | 砖/?/砖/?/砖(两个 `?` 内含金币);上排 x=22 处 `?`(行 5)内含**火焰花**;隐藏 1UP 砖(可选) |
| 首波栗子仔 | ~22–40 | 2–3 只 Goomba 自右向左走入 |
| 四水管区 | 28(h2)/38(h3)/46(h4)/57(h4) | 高度递增,顶面均为实心可站立 |
| 第一坑 | 69–70 | 2 瓦片宽,跑跳可过 |
| 金币砖区 | 78–87 | 双行砖+? 金币砖;第二坑在其间(84–85) |
| 库巴带 | ~95–110 | Goomba 若干 + x≈107 一只 Koopa(踩→龟壳→踢飞) |
| 高台砖区 | 121–133 | 悬空砖排(121–124、126–129,125 处缺口)+ 单向平台段(130–133,展示 semisolid;1-1 原版无 semisolid,此段为展示性元素) |
| 三连坑 | 138–139 / 142–144 / 147–148 | 2–4 瓦片宽,本关难度峰值 |
| 楼梯 | 152–155(上 4 级)、163–166(上 4 级) | 实心块阶梯,末端助跑跳 |
| 旗杆 | 198 | 触碰→滑降→走进城堡(x≈202–206)→通关结算 |

### 8.3 实体流式激活

- 敌人/道具按「流式激活窗口」管理:`x < camX + 1.5 屏` 时激活,`x < camX − 1 屏` 时停用并回收(对象池)。既还原原版「屏幕外才生成/活动」的行为,又天然限制活跃实体数(全程 < 20)。
- 砖块内容物(蘑菇/花/金币)在「被顶击」瞬间才实例化,不属于关卡静态实体表。

---

## 9. 实体系统

**决策:浅继承树 + 实体内部小型状态机 + 局部对象池**(不用 ECS/全组合)。

```
Entity(id, pos, prevPos, vel, size, active, onGround)
  └─ MovableEntity(固定步积分 + TileResolver 调用)
       ├─ Mario        ├─ Goomba   ├─ Koopa(含 shell 态)
       ├─ MushroomItem ├─ FireFlowerItem ├─ Coin(静态拾取)
       └─ Flagpole(触发区+滑降脚本)
```

- **理由**:实体种类固定且仅 ~8 种,继承深度 3 层;组合优先(ECS)在此规模是纯开销。行为差异集中在各自 `update(dt, ctx)` + 枚举状态机(如 Koopa:`walk | shell | shellKilled | flip`)。
- **对象池**用在三处高频小对象:金币闪光、砖块碎片、得分飘字(均在 `engine/fx`,game 层只发「事件」)。
- **依赖注入**:`WorldContext` 注入给实体(tileMap、敌人列表、事件总线、音频句柄)—— 实体不 `new` 依赖,方便测试。

---

## 10. 渲染与美术方案

### 10.1 总路线:全程序化低多边形圆润现代风,零外部资源

- 建模手法:three 内置几何(`SphereGeometry`/`CapsuleGeometry`/`BoxGeometry`/`CylinderGeometry`/`TorusGeometry`)拼父子层级 —— 马里奥(球头+胶囊身+盒帽+环鼻)、Goomba(扁球+半球帽)、Koopa(胶囊壳+球头)、砖块(倒角盒)。**低多边形预算**:球 ≤16×12 段、胶囊 ≤8 段,圆润感靠材质与光影而非顶点数。静态装饰用 `BufferGeometryUtils.mergeGeometries` 合并降 draw call;**不引入 CSG 依赖**(拼装足够)。
- 瓦片渲染:每种瓦片一个源网格 + **InstancedMesh**,按 16 瓦片分 chunk 建实例,使 three 自动视锥剔除按 chunk 生效。

### 10.2 材质与光照(「现代感」的来源)

- **材质**:`MeshStandardMaterial`(`metalness=0`、`roughness 0.4–0.8`);金币/问号砖加少量 `emissive`。
- **环境反射**:程序化渐变等距柱状 `DataTexture`(天顶蓝→地平线暖→地面灰,64×32 足够)经 **`PMREMGenerator`** 预滤波后赋给 `scene.environment` —— three 的 PBR 按 roughness 采样 IBL 必须经 PMREM,裸 CubeTexture 得不到柔和反射;全程无 HDR 文件。
- **天空**:`three/addons/objects/Sky.js` 的 `Sky`(纯 shader 大气,无资源)。
- **光照**:1 个 `DirectionalLight`(太阳,`castShadow`)+ `renderer.shadowMap`(`PCFSoftShadowMap`、mapSize 2048、阴影视锥紧贴相机视野)+ `HemisphereLight` 补暗部;只有玩法层投影,背景层不投。
- **后期**:`EffectComposer` + `RenderPass` + `UnrealBloomPass`(强度 0.3–0.5、阈值 0.8,金币/道具发光感,**半分辨率渲染目标**省填充率)+ `OutputPass`(色调映射 + sRGB 转换);可选暗角用小型 `ShaderPass`。
- **颜色管线(固定)**:`outputColorSpace = SRGBColorSpace` + `ACESFilmicToneMapping` —— three r152+ 默认开启色彩管理,不要关闭;这是「现代感」的地基,后期再接任何效果都必须走这条管线。

### 10.3 正交相机与视差(「玩法 2D、视觉 3D」的核心手段)

- `OrthographicCamera`:半高 7.5 瓦片(竖向可见 15 瓦片,忠实原版构图),半宽按视口宽高比推;零旋转,Z≈−30。
- **跟随规则**:水平死区 ±1.5 瓦片(区内相机不动,出区平滑跟随),钳制 `[0, 211 − halfW]`;垂直固定(关卡仅 15 高)。
- **视差层**:背景山丘/灌木/云放不同 Z 层,按 0.3 / 0.5 视差系数随相机移动 —— 制造 3D 纵深但玩法纯 2D 的现代感。

### 10.4 性能

- 全部重复瓦片/金币/碎片走 InstancedMesh;预期 draw call < 100、多边形 < 5 万,60fps 桌面毫无压力。
- three 自动逐网格视锥剔除 + chunk 分块让实例化网格也受益;实体用 §8.3 流式激活;离屏 > 1 屏的实例 `.visible = false`。
- **DPR 钳制**:`renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))` 限制有效 DPR ≤ 1.5(高 DPI 屏保帧率)。

### 10.5 程序化贴图(仍零外部文件)

- 砖面/问号砖图案/金币/城堡表面用运行时生成的 `CanvasTexture`(128–256px,一次绘制、全局复用),同一张画布兼作 `roughnessMap`/`metalnessMap` 灰度来源。
- 收益:细节由贴图承载,几何保持低多边形+纯色即可,顶点数与建模复杂度双降;「零外部资源」不变(贴图是运行时生成,无文件加载)。
- 得分飘字用 **DOM 覆盖层**(Vue 层,离散事件驱动)而非 3D 文字,零字体/纹理成本且更锐利。

---

## 11. 音效方案

**决策:WebAudio 程序化合成,不引入 Howler。** 8-bit 音效本质是方波/噪声 + 包络,WebAudio 原生 ~100 行解决,零依赖、零加载。

- `AudioEngine`:懒建 AudioContext,由「开始游戏」按钮手势解锁(遵守自动播放策略);master/compose 增益总线。
- `Sfx`:每种音效一个纯函数 —— 跳跃(方波上滑 400→900Hz / 0.18s)、金币(B5→E6 两音)、顶砖(短噪声)、踩敌、受伤、拾取道具、死亡(下行琶音)、通关。
- `Bgm`(可选 P2):一张音符表 + 方波主音 / 三角波贝斯 / 噪声鼓的简单音序器,循环 1-1 主题。
- 所有音效调用发生在 game 层事件(如 `sfx.coin`),AudioEngine 订阅 —— game 层仍不依赖 WebAudio 之外的浏览器 API(可 mock)。
- 程序化合成意味着 BGM 是「翻奏合成」而非采样;本期版权不作约束,1-1 主题可忠实还原(如不需要可整体关闭 BGM,仅留 SFX)。

---

## 12. UI 设计

### 12.1 HUD(原版布局)

```
MARIO      1-1        WORLD     TIME
 000000    ×00        1-1       400
```

顶部一行五要素:分数(6 位补零)、金币数、世界号、倒计时(≤100 变红+加速音效提示)、生命数(右上角 ×N)。字体用 CSS 等宽字体 + 描边,不引入字体文件。

### 12.2 界面状态机

```
ready ──start──▶ playing ⇄ paused
                  │dying(死亡动画 2s)──▶ playing(扣命)
                  │生命耗尽 ──▶ gameover
                  └─旗杆通关──▶ clear(时间分结算)──▶ ready/重玩
```

> `visibilitychange`(页面隐藏)自动 `playing → paused`;回前台停留在暂停界面,等玩家手动恢复(见 §6)。

### 12.3 组件清单

| 组件 | 职责 |
|---|---|
| `GameCanvas.vue` | 全屏 canvas,挂载/销毁 `Game` 实例 |
| `HudBar.vue` | 五要素 HUD,读 `useGameSession()` 快照 |
| `StartScreen.vue` | 标题 + 开始按钮(兼作音频解锁手势) |
| `PauseOverlay.vue` | 暂停菜单(继续/重开) |
| `DeathOverlay.vue` | 死亡提示(短暂) |
| `LevelClear.vue` | 通关结算(分数/金币/剩余时间) |
| `TouchControls.vue` | 可选:虚拟方向键 + B(跳)/ A(跑),只产出同一 `InputState`,不改 game 层 |

**输入键位**:方向键/WASD 移动、Space/Z 跳、Shift/X 跑、Enter/P 暂停、R 重开。

---

## 13. 项目结构与测试策略

目录结构见 §5.3。补充规范:

- **命名**:文件 PascalCase(类)/camelCase(工具);类型与类同名;事件名 `domain:action` 小写冒号分隔。
- **ESLint 依赖规则**(第一天就配):
  - `game/**` 禁止 import `three`、`three/addons/*`、`vue`(并拉黑 `@threejs/*` 防再次引入错包);
  - `engine/**` 禁止 import `vue`;
  - `ui/**` 禁止 import `three`;UI 壳层只经公共入口(`game/Game`、`game/types`、`engine/GameEngine`)组合,装配点在 `useGameSession()`。
- **测试(Vitest)**:只测纯逻辑层 ——
  - `physics/`:AABB 解析(贴墙、落地、顶砖、单向平台边界)、手感积分(固定步下速度收敛);另把「跳跃顶点高度 / 最远越坑宽度」由手感参数表算出,写成黄金回归断言(纯函数,无需渲染,防调参悄悄破坏验收 #3);
  - `level/`:ASCII 解析器(尺寸校验、图例全覆盖、实体坐标落在合法瓦片);
  - 实体状态机:Koopa 踩→壳→踢→连锁、马里奥受击降级时序。
- 渲染层不做自动化测试,靠 M6 起的人工目检。

---

## 14. 里程碑拆分

| 里程碑 | 内容 | 完成定义(DoD) |
|---|---|---|
| **M0** | 脚手架(create-vue + `three` + ESLint 依赖规则)、Engine 生命周期(单一 rAF 循环)、正交相机、灯光/后期跑通、`FixedStepLoop` + `ViewRegistry` 插值骨架 | 空白灰盒场景 60fps;resize 正确;dispose 无泄漏 |
| **M1** | 灰盒物理与马里奥手感:TileResolver、PhysicsConfig、InputManager、马里奥状态机(走/跑/跳/急转身/下蹲) | 在测试地形上盲测可识别「马里奥手感」;physics 单测通过 |
| **M2** | 关卡加载与瓦片渲染:LevelParser、1-1 ASCII 图、ChunkBuilder 实例化、背景视差层 | 1-1 完整地形正确显示,相机跟随正确 |
| **M3** | 敌人与交互:Goomba/Koopa、踩敌弹跳、顶砖/问号砖/金币、道具(蘑菇/火焰花)、能力变化 | 1-1 全部交互规则按 §3 生效 |
| **M4** | 死亡与通关:掉坑/受伤死亡流程、生命数、旗杆滑降、城堡结算、Game Over | 可从出生点完整通关 1-1 |
| **M5** | HUD 与界面流程:五要素 HUD、开始/暂停/死亡/通关/Game Over | 界面状态机闭环;暂停恢复不破坏物理 |
| **M6** | 美术打磨 + 音效:程序化造型精修、材质/阴影/泛光调优、Sfx 全套、(可选 BGM) | 截图级「现代 3D」观感;音效全套,BGM 可忠实翻奏主题 |
| **M7** | 性能与验收:DPR 钳制、剔除核查、(可选触屏)、按 §15 逐项验收 | 验收标准全绿 |

> 实施阶段最重要的三个提醒:①**先做 M1 灰盒手感再谈美术** —— 手感不对时任何渲染工作都会返工;②`game/` 零 three 依赖第一天用 ESLint 锁死;③ViewRegistry 插值同步在 M0 搭好。

---

## 15. 验收标准

1. 桌面中端机 Chrome 全程 60fps(DevTools 帧率曲线无掉帧毛刺)。
2. 从出生点完整通关 1-1(旗杆滑降 + 城堡结算)。
3. 助跑可稳定越过 4 瓦片宽的坑;原地跳可上 4 砖高台。
4. 可变跳高、急转身、踩敌弹跳可被熟悉原版的测试者**盲测识别为「马里奥」**。
5. 受击降级 + 无敌闪烁、龟壳连锁击杀、顶砖出道具全部正确。
6. HUD 五要素与暂停/死亡/通关流程闭环;时间耗尽按原版规则死亡。
7. `physics/` + `level/` 单测通过;`game/` 层 ESLint 依赖规则零违例。
8. 首屏加载 < 2s(零外部资源);WebGL2 不支持时显示降级提示页。
9. 视觉:截图对比下具备「圆润、柔和光影、发光道具」的现代 3D 观感,而非像素风。

---

## 16. 风险与备选方案

| 风险 | 概率 | 应对 |
|---|---|---|
| three 按月发布(r1xx),addons 入口偶有变动 | 中 | 锁 `~0.18x` 小版本;后期/天空/合并工具全用官方 `three/addons`,无第三方渲染依赖需要对齐 |
| WebGL 上下文丢失 / 驱动差异 | 低 | 监听 `webglcontextlost` 重建引擎:`game/` 状态独立于渲染器,重建成本低;WebGL2 不支持时显示降级提示页 |
| WebGPU 趋势(three 的 WebGPURenderer/TSL) | — | 本期锁 WebGL2 保兼容;§5 分层边界已隔离渲染器,后续可只换 engine 层 |
| TS7 + vue-tsc 工具链兼容 | 低 | 回退 `typescript@~5.9`,不影响架构 |
| 程序化造型达不到预期观感 | 中 | ViewRegistry 边界允许只替换 mesh 工厂为 glTF 加载,玩法层不动(退路) |
| 自研物理手感调不出「马里奥味」 | 低 | 参数表已按原版换算给出起点;M1 灰盒阶段集中调参 |
| BGM 版权 | — | 本期不考虑:程序化音序器可忠实翻奏 1-1 主题;需要时整体关闭即可 |
| 高 DPI 屏性能 | 低 | DPR 钳制 ≤1.5 |

---

## 附录 A:手感参数表

单位:瓦片/秒(t/s)、瓦片/秒²。集中存放于 `game/physics/PhysicsConfig.ts`。

| 参数 | 值 | 说明 |
|---|---|---|
| walkMax / runMax | 4.2 / 6.4 | 走/跑极限速度(≈原版 1.1/1.7 px/f 换算) |
| accelWalk / accelRun | 12 / 14 | 地面加速度 |
| skidDecel | 20 | 反向输入急停/转身(原版灵魂手感) |
| friction | 10 | 松键自然减速 |
| jumpVel | 16.5 | 起跳初速(小/超/火一致;火焰花不改变弹道);顶点 = v²/2g_hold ≈ **4.26 瓦片**,支撑验收 #3「原地跳上 4 砖高台」;全速滞空 ≈ 0.88s × 6.4 t/s ≈ **5.6 瓦片**,稳越 4 瓦片坑 |
| gravityHold | 32 | 上升期按住跳键的重力(可变跳高核心) |
| gravityFall | 64 | 下落期或提前松键的重力(早停) |
| maxFall | 20 | 终端速度 |
| stompBounce | +8(按住跳 +10) | 踩敌弹跳 |
| coyoteTime / jumpBufferTime | 0.1s / 0.1s | 现代修正,各约 6 帧 |
| flagSlideSpeed | 6 | 旗杆滑降速度 |
| goombaSpeed / koopaSpeed | 2.2 | 敌人巡逻速度 |
| shellSpeed | 8 | 踢飞龟壳速度 |
| invincibleTime | 2s | 受击后无敌时长 |
| transformTime | 0.5s | 变身/受伤动画时长 |

> 可选「更原味」增强:原版的起跳初速随水平速度变化(站跳 < 跑跳)。本期简化为定值 `jumpVel`;若要更原味,按 `|vx|` 在 walkMax→runMax 间对 `jumpVelMin≈14.5 → jumpVelMax=16.5` 线性插值即可,只改 `Mario.ts` 一行。

## 附录 B:1-1 ASCII 地图

15 行 × 211 列,行 0 为顶、行 14 为底;地面占行 13–14。x 坐标从 0 起算(每行恰 211 字符)。图例见 §8.1;`|` 为旗杆杆身(实体),`o`(行 2)为杆顶球;金币/敌人为实体不在图中;山丘/灌木/云/城堡为 Z 层装饰道具,不在图中。坑位于 x 69–70、84–85、138–139、142–144、147–148。

```
行  0: (211 个 '.')
行  1: (211 个 '.')
行  2: 198×'.' + 'o' + 12×'.'
行  3: 198×'.' + '|' + 12×'.'
行  4: 121×'.' + 'XXXX' + '.' + 'XXXX' + 68×'.' + '|' + 12×'.'
行  5: 22×'.' + '?' + 57×'.' + 'XX?XX' + 113×'.' + '|' + 12×'.'
行  6: 198×'.' + '|' + 12×'.'
行  7: 198×'.' + '|' + 12×'.'
行  8: 130×'.' + '====' + 64×'.' + '|' + 12×'.'
行  9: 16×'.' + '?' + 3×'.' + 'X?X?X' + 21×'.' + 'PP' + 9×'.' + 'PP' + 19×'.' + 'XX?XXXX?XX' + 67×'.' + '^' + 10×'.' + '^' + 31×'.' + '|' + 12×'.'
行 10: 38×'.' + 'PP' + 6×'.' + 'PP' + 9×'.' + 'PP' + 95×'.' + '^^' + 9×'.' + '^^' + 31×'.' + '|' + 12×'.'
行 11: 28×'.' + 'PP' + 8×'.' + 'PP' + 6×'.' + 'PP' + 9×'.' + 'PP' + 94×'.' + '^^^' + 8×'.' + '^^^' + 31×'.' + '|' + 12×'.'
行 12: 28×'.' + 'PP' + 8×'.' + 'PP' + 6×'.' + 'PP' + 9×'.' + 'PP' + 93×'.' + '^' + 10×'.' + '^' + 34×'.' + '|' + 12×'.'
行 13: 69×'#' + '..' + 13×'#' + '..' + 52×'#' + '..' + 2×'#' + '...' + 2×'#' + '..' + 62×'#'
行 14: (同行 13)
```

> 实现时 `Level1_1.ts` 中以展开的 211 字符串数组存储(非 RLE);上表为紧凑规格,解析器单测须校验每行长度 = 211、图例字符全覆盖。对照 §8.2 蓝图:行 9 的 `?`(x=16)含超级蘑菇;五连砖组 x=20–24(行 9),其上 `?`(x=22,行 5)含火焰花;金币砖区 x=78–87(行 9)+ 上排 x=80–84(行 5);悬空砖 x=121–124、126–129(行 4,x=125 处缺口);单向平台 x=130–133(行 8);楼梯 x=152–155、163–166;旗杆 x=198。

## 附录 C:事件与接口清单

**引擎 → UI(经 `GameHooks` / `useGameSession`)**

| 事件 | 载荷 | 时机 |
|---|---|---|
| `phase:change` | `'ready'\|'playing'\|'paused'\|'dying'\|'clear'\|'gameover'` | 阶段切换 |
| `hud:score` / `hud:coin` / `hud:time` / `hud:lives` | number | 仅变化时 |
| `mario:state` | `'small'\|'super'\|'fire'` | 能力变化 |
| `sfx:*` | 音效名(内部总线,AudioEngine 订阅) | 玩法事件 |

**UI → 引擎(命令方法)**:`start()` / `pause()` / `resume()` / `restart()` / `dispose()`。

**关键接口签名**

```ts
// game/input
interface InputState { left; right; run; crouch; jumpHeld; jumpPressed: boolean }

// game/physics —— 全部以瓦片单位/秒表达
interface PhysicsConfig { walkMax; runMax; accelWalk; accelRun; skidDecel;
  friction; jumpVel; gravityHold; gravityFall; maxFall;
  stompBounce; coyoteTime; jumpBufferTime }

// game/level
interface LevelDef { width: 211; height: 15; rows: string[];
  playerSpawn: Vec2; flagX: number; entities: EntitySpawn[] }

// engine/ViewRegistry —— 每帧渲染同步(含插值)
interface ViewState { prevPos: Vec2; pos: Vec2; state: string }
```
