// jsdom 不带类型，只声明测试里用到的部分（同 types/echarts.d.ts 的做法）
declare module "jsdom" {
  export class JSDOM {
    constructor(
      html?: string,
      options?: { url?: string; pretendToBeVisual?: boolean },
    )
    readonly window: Window & typeof globalThis
  }
}
