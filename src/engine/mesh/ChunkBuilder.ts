import {
  BoxGeometry,
  ConeGeometry,
  InstancedMesh,
  Object3D,
  type BufferGeometry,
  type Material,
  type Scene,
} from 'three'
import { STYLE_ZONES, type TerrainStyle } from '@/game/constants'
import type { ParsedLevel } from '@/game/level/LevelParser'
import { TILE, type TileCode } from '@/game/level/tileMeta'
import { materials } from '../material/MaterialLib'

/**
 * 地形实例化构建(DESIGN §8.1):读 level.grid,每「瓦片类型 × 样式」一个
 * 全关卡 InstancedMesh → 全地形 ≈12 draw call(替代 M1 每段地面 2 draw)。
 * 样式带换材质不换几何:每样式独立实例网格,draw 数 = 类型×样式,仍 O(1)。
 * 静态一次性构建,不走 ViewRegistry(实体无此网格);随 GameEngine dispose。
 */

function styleAt(x: number): TerrainStyle {
  for (const z of STYLE_ZONES) if (x >= z.x0 && x < z.x1) return z.style
  return 'grass'
}

const STYLES: readonly TerrainStyle[] = ['grass', 'stone', 'snow']

export class ChunkBuilder {
  private readonly geometries: BufferGeometry[] = []
  private readonly meshes: InstancedMesh[] = []

  constructor(
    scene: Scene,
    level: ParsedLevel,
  ) {
    const { grid, width, height } = level
    const at = (x: number, y: number): TileCode =>
      x < 0 || x >= width || y < 0 || y >= height ? TILE.empty : (grid[x + y * width] as TileCode)

    // 收集:扁平 [x0,y0,x1,y1,...];按类型 × 样式分桶
    const dirt: Record<TerrainStyle, number[]> = { grass: [], stone: [], snow: [] }
    const cap: Record<TerrainStyle, number[]> = { grass: [], stone: [], snow: [] }
    const brick: number[] = []
    const stair: number[] = []
    const pipeBody: number[] = []
    const pipeRim: number[] = []
    const semisolid: number[] = []
    const spike: number[] = []

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        switch (at(x, y)) {
          case TILE.dirt: {
            const s = styleAt(x)
            dirt[s].push(x, y)
            if (at(x, y + 1) === TILE.empty) cap[s].push(x, y) // 顶面才铺盖(草/石/雪皮)
            break
          }
          case TILE.brick:
            brick.push(x, y)
            break
          case TILE.stair:
            stair.push(x, y)
            break
          case TILE.pipe:
            pipeBody.push(x, y)
            if (at(x, y + 1) !== TILE.pipe) pipeRim.push(x, y) // 管口加宽圈
            break
          case TILE.semisolid:
            semisolid.push(x, y)
            break
          case TILE.spike:
            spike.push(x, y)
            break
        }
      }
    }

    // 几何共享:1×1×1 单位盒服务 dirt/brick/stair/pipeBody(一次 dispose)
    const unitBox = new BoxGeometry(1, 1, 1)
    const capBox = new BoxGeometry(1, 0.22, 1)
    const rimBox = new BoxGeometry(1.25, 0.35, 1.25)
    const semiBox = new BoxGeometry(1, 0.28, 1)
    const spikeCone = new ConeGeometry(0.42, 0.9, 4)
    this.geometries.push(unitBox, capBox, rimBox, semiBox, spikeCone)

    const center = (d: Object3D, x: number, y: number): void => {
      d.position.set(x + 0.5, y + 0.5, 0)
      d.rotation.set(0, 0, 0)
    }
    const topCap = (d: Object3D, x: number, y: number): void => {
      d.position.set(x + 0.5, y + 1 - 0.11, 0)
      d.rotation.set(0, 0, 0)
    }

    const dirtMat: Record<TerrainStyle, Material> = {
      grass: materials.groundDirt,
      stone: materials.stoneDirt,
      snow: materials.snowDirt,
    }
    const capMat: Record<TerrainStyle, Material> = {
      grass: materials.grassTop,
      stone: materials.stoneTop,
      snow: materials.snowTop,
    }
    for (const s of STYLES) {
      this.add(scene, unitBox, dirtMat[s], dirt[s], center, false)
      this.add(scene, capBox, capMat[s], cap[s], topCap, false)
    }
    this.add(scene, unitBox, materials.brickBlock, brick, center, true)
    this.add(scene, unitBox, materials.stoneTop, stair, center, true)
    this.add(scene, unitBox, materials.pipeBody, pipeBody, center, true)
    this.add(
      scene,
      rimBox,
      materials.pipeRim,
      pipeRim,
      (d, x, y) => {
        // 圈顶必须与碰撞顶(y+1)齐平:高于碰撞顶会让站立的马里奥整条腿"插进"管口
        d.position.set(x + 0.5, y + 1 - 0.175, 0)
        d.rotation.set(0, 0, 0)
      },
      true,
    )
    this.add(
      scene,
      semiBox,
      materials.platformWood,
      semisolid,
      (d, x, y) => {
        d.position.set(x + 0.5, y + 1 - 0.14, 0)
        d.rotation.set(0, 0, 0)
      },
      true,
    )
    this.add(
      scene,
      spikeCone,
      materials.spikeMetal,
      spike,
      (d, x, y) => {
        d.position.set(x + 0.5, y + 0.45, 0)
        d.rotation.set(0, Math.PI / 4, 0) // 四棱锥转 45° → 相机正面三角刃
      },
      true,
    )
  }

  private add(
    scene: Scene,
    geo: BufferGeometry,
    mat: Material,
    cells: number[],
    place: (d: Object3D, x: number, y: number) => void,
    cast: boolean,
  ): void {
    if (cells.length === 0) return
    const n = cells.length / 2
    const im = new InstancedMesh(geo, mat, n)
    const dummy = new Object3D()
    for (let i = 0; i < n; i++) {
      place(dummy, cells[i * 2]!, cells[i * 2 + 1]!)
      dummy.updateMatrix()
      im.setMatrixAt(i, dummy.matrix)
    }
    im.instanceMatrix.needsUpdate = true
    im.receiveShadow = true
    im.castShadow = cast
    scene.add(im)
    this.meshes.push(im)
  }

  dispose(): void {
    for (const m of this.meshes) m.parent?.remove(m)
    this.meshes.length = 0
    for (const g of this.geometries) g.dispose()
    this.geometries.length = 0
  }
}
