import type { Decay } from '@/types/decay'
import type { RepairState, RepairStep } from '@/types/repair'

/**
 * 病害复核状态：档案台与修复时间线两处共用同一判定。
 *
 * 优先级：
 * 1. 人工结论（manualConclusion 非 null）永远优先，工序侧任何调整都不能覆盖；
 * 2. 无人工结论时，再按全部工序是否完成判定 —— 全部完成只到「待复核」，不自动算已修复；
 * 3. 清除人工结论后回到第 2 条重新判定。
 */
export type DecayReviewStatus =
  | 'manual-repaired'
  | 'manual-unrepaired'
  | 'pending-review'
  | 'in-progress'
  | 'no-steps'

export interface StepProgress {
  done: number
  total: number
  /** 完成率：未完成工序仍计入分母 */
  percent: number
}

export interface DecayReviewInfo {
  status: DecayReviewStatus
  /** 状态短标签，供 el-tag 展示 */
  label: string
  /** el-tag 语义色 */
  tagType: 'success' | 'danger' | 'warning' | 'info'
  /** 结论 / 判定依据：数据是怎么来的 */
  basis: string
  /** 数据缺口：还缺什么才能进入下一状态 */
  gap: string
  /** 人工结论确认时间（可能为 null） */
  manualAt: number | null
  progress: StepProgress
}

export function stepProgress(steps: RepairStep[]): StepProgress {
  const total = steps.length
  const done = steps.filter((step) => step.state === '已完成').length
  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100)
  }
}

/**
 * 依据病害记录与该病害的全部工序计算复核状态、依据与缺口。
 * 纯函数，不触碰数据库，供两个页面与统计共用。
 */
export function resolveDecayReview(decay: Decay, steps: RepairStep[]): DecayReviewInfo {
  const progress = stepProgress(steps)
  const manual = decay.manualConclusion ?? null
  const manualAt = decay.manualConclusionAt ?? null

  if (manual === true) {
    return {
      status: 'manual-repaired',
      label: '已修复',
      tagType: 'success',
      basis: `人工复核结论：已修复（${formatTime(manualAt)}确认）`,
      gap:
        progress.total === 0
          ? '已有修复结论但未挂接修复工序，缺施工记录留档'
          : progress.done === progress.total
            ? '人工结论与工序进度一致，可归档'
            : `人工已判修复，但 ${progress.total - progress.done} 道工序尚未完成，结论不受工序影响`,
      manualAt,
      progress
    }
  }

  if (manual === false) {
    return {
      status: 'manual-unrepaired',
      label: '未修复',
      tagType: 'danger',
      basis: `人工复核结论：未修复（${formatTime(manualAt)}确认）`,
      gap:
        progress.total === 0
          ? '已有人工未修复结论，尚未安排修复工序'
          : progress.done === progress.total
            ? '工序已全部完成，可重新人工复核后清除或改写结论'
            : `尚有 ${progress.total - progress.done} 道工序未完成，工序调整不会改变人工结论`,
      manualAt,
      progress
    }
  }

  // 以下均为「无人工结论」：按工序完成度判定
  if (progress.total === 0) {
    const legacy = legacyNote(decay)
    return {
      status: 'no-steps',
      label: '未修复',
      tagType: 'info',
      basis: `无人工复核结论，且未挂接任何修复工序${legacy}`,
      gap: '缺人工结论；需先安排修复工序并在完工后人工复核',
      manualAt,
      progress
    }
  }

  if (progress.done === progress.total) {
    const legacy = legacyNote(decay)
    return {
      status: 'pending-review',
      label: '待复核',
      tagType: 'warning',
      basis: `无人工复核结论；${progress.total} 道工序已全部完成，等待人工复核${legacy}`,
      gap: '工序完工不等于修复，需在档案台或时间线人工确认修复结论',
      manualAt,
      progress
    }
  }

  const running = steps.filter((step) => step.state === '进行中').length
  return {
    status: 'in-progress',
    label: '未修复',
    tagType: 'info',
    basis: `无人工复核结论；工序完成 ${progress.done}/${progress.total}（${progress.percent}%）`,
    gap: `${progress.total - progress.done} 道工序未完成${running > 0 ? `（其中 ${running} 道进行中）` : ''}，完工后仍需人工复核`,
    manualAt,
    progress
  }
}

/** 历史数据缺人工结论时，补充旧版回写来源说明 */
function legacyNote(decay: Decay): string {
  return decay.legacyRepaired === true ? '；旧版曾按工序完工自动记为已修复，现须重新人工复核' : ''
}

export function formatTime(ts: number | null): string {
  if (!ts) return '时间未知'
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return '时间未知'
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`
}

/** 供 UI 概览统计使用：是否为生效已修复 / 待复核 */
export function isEffectivelyRepaired(decay: Decay): boolean {
  return decay.manualConclusion === true
}

export function isPendingReview(decay: Decay, steps: RepairStep[]): boolean {
  return resolveDecayReview(decay, steps).status === 'pending-review'
}

/** 工序状态的兜底，供导入旧备份时使用 */
export function normalizeStepState(value: unknown): RepairState {
  return value === '已完成' || value === '进行中' ? value : '未开始'
}

/**
 * 把任意版本（v1/v2/v3）的病害记录归一化为当前结构。
 * 关键规则：旧数据没有人工结论字段，manualConclusion 一律置 null；
 * 旧版回写留下的 repaired=true 保留到 legacyRepaired 仅作展示，
 * 生效 repaired 以人工结论为准，确保升级后旧数据仍可读且统计口径一致。
 */
export function normalizeDecay(raw: Partial<Decay> & { id: string }): Decay {
  const hasManual = typeof raw.manualConclusion === 'boolean'
  const manualConclusion: boolean | null = hasManual ? (raw.manualConclusion as boolean) : null
  const manualConclusionAt =
    typeof raw.manualConclusionAt === 'number' && raw.manualConclusionAt > 0
      ? raw.manualConclusionAt
      : null
  const now = Date.now()
  // 旧数据缺人工结论时，旧版回写留下的 repaired=true 转入 legacyRepaired 留档
  const inheritedLegacy =
    typeof raw.legacyRepaired === 'boolean'
      ? raw.legacyRepaired
      : !hasManual && raw.repaired === true
        ? true
        : undefined
  return {
    id: raw.id,
    layerId: typeof raw.layerId === 'string' ? raw.layerId : '',
    type: raw.type ?? '起甲',
    severity: raw.severity ?? '轻度',
    areaCm2: typeof raw.areaCm2 === 'number' ? raw.areaCm2 : 0,
    causeGuess: typeof raw.causeGuess === 'string' ? raw.causeGuess : '',
    repaired: manualConclusion === true,
    repairedAt: manualConclusion === true ? manualConclusionAt ?? raw.updatedAt ?? now : null,
    manualConclusion,
    manualConclusionAt,
    ...(inheritedLegacy !== undefined ? { legacyRepaired: inheritedLegacy } : {}),
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : raw.updatedAt ?? now,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : raw.createdAt ?? now
  }
}
