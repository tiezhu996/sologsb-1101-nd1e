/** 病害记录：某彩画层位上的一处病害现状 */
export type DecayType = '起甲' | '剥落' | '空鼓' | '粉化' | '龟裂'
export type Severity = '轻度' | '中度' | '重度'

/** 修复结论来源：人工结论 / 工序判定；历史数据为 null（缺少人工结论） */
export type RepairSource = 'manual' | 'steps'

export interface Decay {
  id: string
  layerId: string
  type: DecayType
  severity: Severity
  /** 病害面积（平方厘米） */
  areaCm2: number
  /** 病害成因初判 */
  causeGuess: string
  /** 有效修复结论：仅人工结论可置 true，工序回写不得覆盖 */
  repaired: boolean
  repairedAt: number | null
  /** 当前结论来源；null 表示历史数据缺少人工结论 */
  repairSource: RepairSource | null
  /** 人工结论时间；null 表示当前无人工结论 */
  manualConcludedAt: number | null
  /** 全部工序已完成、等待人工复核（工序回写只维护该标记，不改结论） */
  pendingReview: boolean
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
