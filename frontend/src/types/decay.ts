/** 病害记录：某彩画层位上的一处病害现状 */
export type DecayType = '起甲' | '剥落' | '空鼓' | '粉化' | '龟裂'
export type Severity = '轻度' | '中度' | '重度'

export interface Decay {
  id: string
  layerId: string
  type: DecayType
  severity: Severity
  /** 病害面积（平方厘米） */
  areaCm2: number
  /** 病害成因初判 */
  causeGuess: string
  /**
   * 生效修复态（统计冗余）：仅当存在「人工判定已修复」结论时为 true。
   * v3 起工序完成不再回写此字段，避免施工侧覆盖档案台人工结论。
   */
  repaired: boolean
  repairedAt: number | null
  /**
   * 人工复核结论（档案台 / 时间线两处一致）：
   * true = 人工判定已修复；false = 人工判定未修复；null = 尚无结论（含已清除）。
   * 工序侧任何调整都不得改写本字段。
   */
  manualConclusion: boolean | null
  /** 人工复核结论的确认时间；清除结论时置 null */
  manualConclusionAt: number | null
  /**
   * v3 升级前由旧版「工序全部完成即回写」逻辑写入的修复标记，
   * 仅用于历史数据展示旧依据，状态判定不依赖它；新数据不带此字段。
   */
  legacyRepaired?: boolean
  createdAt: number
  updatedAt: number
}

export const DECAY_TYPES: DecayType[] = ['起甲', '剥落', '空鼓', '粉化', '龟裂']
export const SEVERITIES: Severity[] = ['轻度', '中度', '重度']

/** 病害档案台的组合筛选条件 */
export interface DecayFilterState {
  keyword: string
  halls: string[]
  elementPositions: string[]
  types: DecayType[]
  severities: Severity[]
  pigments: string[]
  onlyUnrepaired: boolean
}

export function createEmptyDecayFilter(): DecayFilterState {
  return {
    keyword: '',
    halls: [],
    elementPositions: [],
    types: [],
    severities: [],
    pigments: [],
    onlyUnrepaired: false
  }
}
