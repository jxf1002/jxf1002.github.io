// echarts 4.9 的 npm 包不带类型（package.json 里连 main/types 都没有），只声明用到的 API
declare module "echarts" {
  export interface EChartsInstance {
    setOption(option: unknown, notMerge?: boolean): void
    getOption(): { series: Array<{ zoom?: number; center?: number[] }> }
    on(event: string, handler: () => void): void
    resize(): void
    dispose(): void
  }

  export function init(element: HTMLElement): EChartsInstance
  export function registerMap(name: string, geoJson: unknown): void
}
