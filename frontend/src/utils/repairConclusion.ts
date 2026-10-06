import type { Decay, RepairSource } from '@/types/decay'
import type { RepairStep } from '@/types/repair'

/** 某条病害的工序进度：未完成工序仍计入总数（完成率分母） */
export interface StepProgress {
  total: number
  done: number
  /** 未完成工序名称（按 seq 排序） */
  unfinishedNames: string[]
}

/** 汇总工序进度，供判定与展示共用 */
export function summarizeSteps(steps: RepairStep[]): StepProgress {
  const sorted = [...steps].sort((a, b) => a.seq - b.seq)
  return {
    total: sorted.length,
    done: sorted.filter((step) => step.state === '已完成').length,
    unfinishedNames: sorted.filter((step) => step.state !== '已完成').map((step) => step.name)
  }
}

/** 工序侧判定结果：全部完成只给「待复核」，不直接判已修复 */
export interface StepOutcome {
  repaired: boolean
  repairedAt: number | null
  pendingReview: boolean
  repairSource: RepairSource | null
}

/** 按全部工序是否完成判定：无工序 → 无结论来源；全部完成 → 待复核 */
export function deriveFromSteps(progress: StepProgress): StepOutcome {
  if (progress.total === 0) {
    return { repaired: false, repairedAt: null, pendingReview: false, repairSource: null }
  }
  return {
    repaired: false,
    repairedAt: null,
    pendingReview: progress.unfinishedNames.length === 0,
    repairSource: 'steps'
  }
}

/** 档案台 / 工序时间线共用的结论展示：状态 + 依据 + 缺口 */
export interface RepairConclusionInfo {
  state: '已修复' | '待复核' | '未修复'
  tagType: 'success' | 'warning' | 'info'
  /** 判定依据（人工结论 / 工序进度 / 历史数据） */
  basis: string
  /** 当前缺口（缺人工复核、缺工序等） */
  gap: string
}

/** 生成结论展示：人工结论优先；历史已修复但缺少结论来源的单独标注 */
export function describeRepairConclusion(
  decay: Pick<Decay, 'repaired' | 'repairSource' | 'manualConcludedAt'>,
  progress: StepProgress
): RepairConclusionInfo {
  if (decay.repairSource === 'manual') {
    const when = decay.manualConcludedAt ? `（${formatDateTime(decay.manualConcludedAt)}）` : ''
    return {
      state: decay.repaired ? '已修复' : '未修复',
      tagType: decay.repaired ? 'success' : 'info',
      basis: `人工结论${when}：标记${decay.repaired ? '已修复' : '未修复'}`,
      gap: stepGapText(progress, '工序已全部完成，人工结论优先')
    }
  }
  if (decay.repaired) {
    return {
      state: '已修复',
      tagType: 'success',
      basis: '历史记录已标记修复，缺少人工结论来源',
      gap: '待人工复核确认；清除结论后按工序完成度重新判定'
    }
  }
  if (progress.total === 0) {
    return {
      state: '未修复',
      tagType: 'info',
      basis: '无工序记录，缺少人工结论',
      gap: '尚未编排修复工序'
    }
  }
  if (progress.unfinishedNames.length === 0) {
    return {
      state: '待复核',
      tagType: 'warning',
      basis: `全部 ${progress.total} 道工序已完成`,
      gap: '缺少人工复核结论'
    }
  }
  return {
    state: '未修复',
    tagType: 'info',
    basis: `工序完成 ${progress.done}/${progress.total}`,
    gap: stepGapText(progress, '')
  }
}

/** 未完成工序的缺口描述：未完成工序计入完成率分母 */
function stepGapText(progress: StepProgress, allDoneText: string): string {
  if (progress.total === 0) return '尚无工序记录'
  if (progress.unfinishedNames.length === 0) return allDoneText
  return `工序 ${progress.done}/${progress.total}，未完成：${progress.unfinishedNames.join('、')}（计入完成率分母）`
}

/** 时间戳 → YYYY-MM-DD HH:mm，用于人工结论时间回显 */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
