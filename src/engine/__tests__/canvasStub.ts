/**
 * jsdom 无 Canvas 2D 上下文(getContext('2d') 返回 null),而 MaterialLib
 * 在模块级生成程序化贴图 → 纯几何 spec import 模型链(MarioModel/GrayBox →
 * MaterialLib)会在求值期炸。装一个万能 Proxy 桩:方法全 no-op、属性读返回
 * 自身、数值强制为 0,足以让贴图绘制代码跑完,免引入原生 canvas 依赖。
 * 必须排在 GrayBox / skins 等 import 之前(ESM 按书写顺序求值)。
 */
const anyValue: unknown = new Proxy(function () {}, {
  get: (_t, prop) => {
    if (prop === Symbol.toPrimitive) return () => 0
    if (prop === 'valueOf') return () => 0
    if (prop === 'toString') return () => '0'
    return anyValue
  },
  apply: () => anyValue,
  set: () => true,
})

if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = ((kind: string): unknown =>
    kind === '2d' ? anyValue : null) as unknown as HTMLCanvasElement['getContext']
}
