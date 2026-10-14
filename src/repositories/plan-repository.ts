/**
 * مستودع الخطط (المرحلة 7) — خطط القراءة والختمة والأذكار والمواظبة.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * القاعدة الحاكمة في هذه المرحلة: **لا تحديد يدوي للإنجاز** (01-6).
 * المستخدم لا يضغط «أنهيت اليوم»؛ التقدّم يُقرأ من السجلات الفعلية فقط:
 *
 *   • `DailyProgress.ayahsRead` — يكتبه متتبّع الجلسات عند إنهاء جلسة قراءة حقيقية
 *     (R5: مرة واحدة عند الإنهاء الفعلي، لا عند الفتح).
 *   • `DhikrProgress` — عدّادات الأذكار الفعلية يوميًا (المرحلة 5).
 *
 * وما لا يُسجَّل، لا يُحتسب: `pagesRead` يبقى صفرًا إلى أن يأتي نمط الصفحات،
 * فلذلك **لا تُبنى خطة على الصفحات** (موثّق في الأنواع وفي شاشة الخطط).
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * المرجع: 03-REALM-DATABASE-SCHEMA (ReadingPlan/DailyProgress/DhikrProgress)
 */
import { getOpenAppRealm } from '../database/realm/realm';
import type { GoalUnit, PlanProgress, PlanStatus, PlanType, ReadingPlan } from '../database/realm/types';

/** عدد آيات المصحف — من حزمة المحتوى المعتمدة (114 سورة / 6236 آية) */
export const TOTAL_AYAHS = 6236;
/** عدد أجزاء المصحف */
export const TOTAL_JUZ = 30;
/**
 * متوسط آيات الجزء = 6236 ÷ 30 ≈ 207.87.
 * تقريب موثّق: حدود الأجزاء ليست متساوية في عدد الآيات، ولا تُخزَّن تغطية
 * الآية-by-آية في قاعدة المستخدم (تُخزَّن أعداد فقط)، لذا تُقاس خطط الأجزاء
 * بهذا المتوسط ويُصرَّح بذلك للمستخدم في الشاشة.
 */
export const AYAHS_PER_JUZ = TOTAL_AYAHS / TOTAL_JUZ;

const DAY_MS = 24 * 60 * 60 * 1000;

/** خطة جديدة */
export interface CreatePlanInput {
  title: string;
  planType: PlanType;
  goalUnit: GoalUnit;
  goalValue: number;
  /** تاريخ البداية (افتراضيًا: اليوم) */
  startDate?: Date;
  /** تاريخ الهدف للانتهاء (إن وُجد) */
  targetEndDate?: Date | null;
  /** طول الخطة بالأيام — يُشتق منه targetEndDate إن لم يُمرَّر تاريخ */
  durationDays?: number;
}

export type UpdatePlanInput = Partial<
  Pick<CreatePlanInput, 'title' | 'planType' | 'goalUnit' | 'goalValue' | 'targetEndDate'>
>;

/** وحدات مسموحة في الخطط فعليًا (pages مستثناة — لا مصدر بيانات لها) */
export const PLAN_UNITS: GoalUnit[] = ['ayahs', 'juz', 'adhkar', 'days'];

export const PLAN_UNIT_LABELS: Record<string, string> = {
  ayahs: 'آية',
  juz: 'جزء',
  adhkar: 'ذكر',
  days: 'يوم مواظبة',
  pages: 'صفحة',
};

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  active: 'نشطة',
  paused: 'موقوفة',
  completed: 'مكتملة',
  archived: 'مؤرشفة',
};

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** بداية اليوم (00:00 محليًا) */
function startOfDay(d: Date): Date {
  const c = new Date(d.getTime());
  c.setHours(0, 0, 0, 0);
  return c;
}

/** عدد الأيام بين تاريخين بالتقويم (بلا كسور) — موجب أو صفر */
function diffDays(from: Date, to: Date): number {
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();
  return Math.max(0, Math.round((b - a) / DAY_MS));
}

function assertUnit(unit: GoalUnit): void {
  if (!PLAN_UNITS.includes(unit)) {
    throw new Error(`وحدة غير مدعومة في الخطط: ${unit} (المسموح: ${PLAN_UNITS.join(' / ')})`);
  }
}

class PlanRepository {
  /** كل الخطط (الأحدث أولًا) */
  listPlans(status?: PlanStatus): ReadingPlan[] {
    const realm = getOpenAppRealm();
    const all = Array.from(realm.objects('ReadingPlan') as unknown as ReadingPlan[]);
    const rows = status ? all.filter((p) => p.status === status) : all;
    return rows
      .map((r) => ({ ...r }) as ReadingPlan)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  activePlans(): ReadingPlan[] {
    return this.listPlans('active');
  }

  getPlan(id: string): ReadingPlan | null {
    const realm = getOpenAppRealm();
    const row = realm.objects('ReadingPlan').filtered('id = $0', id)[0] as unknown as
      | ReadingPlan
      | undefined;
    return row ? ({ ...row } as ReadingPlan) : null;
  }

  /**
   * إنشاء خطة. **لا يقبل أي حقل إنجاز** — التقدّم يُقاس لاحقًا من السجلات،
   * ولا يُخزَّن مع الخطة (تطبيق صارم لقاعدة «لا تحديد يدوي»).
   */
  createPlan(input: CreatePlanInput): ReadingPlan {
    assertUnit(input.goalUnit);
    const title = input.title.trim();
    if (!title) throw new Error('عنوان الخطة مطلوب');
    if (!Number.isFinite(input.goalValue) || input.goalValue <= 0) {
      throw new Error('قيمة الهدف يجب أن تكون رقمًا أكبر من صفر');
    }
    const forbidden = Object.keys(input).filter((k) => /done|progress|completed/i.test(k));
    if (forbidden.length) {
      throw new Error(`لا يُحفظ إنجاز يدوي مع الخطة (حقول مرفوضة: ${forbidden.join(', ')})`);
    }
    const start = input.startDate ? startOfDay(input.startDate) : startOfDay(new Date());
    let end: Date | null = null;
    if (input.targetEndDate) {
      end = startOfDay(input.targetEndDate);
    } else if (input.durationDays && input.durationDays > 0) {
      end = new Date(start.getTime() + (Math.round(input.durationDays) - 1) * DAY_MS);
    }
    if (end && end.getTime() < start.getTime()) {
      throw new Error('تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية');
    }
    const now = new Date();
    const realm = getOpenAppRealm();
    const row = {
      id: `plan-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      planType: input.planType,
      startDate: start,
      targetEndDate: end,
      goalUnit: input.goalUnit,
      goalValue: Math.round(input.goalValue),
      status: 'active' as PlanStatus,
      createdAt: now,
      updatedAt: now,
    };
    realm.write(() => {
      realm.create('ReadingPlan', row);
    });
    return { ...row } as ReadingPlan;
  }

  updatePlan(id: string, patch: UpdatePlanInput): ReadingPlan | null {
    if (patch.goalUnit) assertUnit(patch.goalUnit);
    const realm = getOpenAppRealm();
    const row = realm.objects('ReadingPlan').filtered('id = $0', id)[0] as unknown as
      | (ReadingPlan & Record<string, unknown>)
      | undefined;
    if (!row) return null;
    realm.write(() => {
      for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined) {
          if (key === 'targetEndDate') {
            row[key] = value ? startOfDay(value as Date) : null;
          } else {
            row[key] = value;
          }
        }
      }
      if (patch.goalValue !== undefined) row.goalValue = Math.round(patch.goalValue);
      row.updatedAt = new Date();
    });
    return this.getPlan(id);
  }

  setStatus(id: string, status: PlanStatus): ReadingPlan | null {
    if (!this.getPlan(id)) return null;
    return this.applyStatus(id, status);
  }

  private applyStatus(id: string, status: PlanStatus): ReadingPlan | null {
    const realm = getOpenAppRealm();
    const row = realm.objects('ReadingPlan').filtered('id = $0', id)[0] as unknown as
      | (ReadingPlan & Record<string, unknown>)
      | undefined;
    if (!row) return null;
    realm.write(() => {
      row.status = status;
      row.updatedAt = new Date();
    });
    return this.getPlan(id);
  }

  deletePlan(id: string): boolean {
    const realm = getOpenAppRealm();
    const row = realm.objects('ReadingPlan').filtered('id = $0', id)[0] as unknown as
      | ReadingPlan
      | undefined;
    if (!row) return false;
    realm.write(() => {
      realm.delete(row);
    });
    return true;
  }

  // ─────────────────────────── الحساب (كله من السجلات الفعلية) ───────────────────────────

  /** إجمالي آيات مقروءة فعليًا في مجال زمني (من سجل التقدّم اليومي) */
  private ayahsInRange(from: Date, to: Date): number {
    const realm = getOpenAppRealm();
    const rows = realm
      .objects('DailyProgress')
      .filtered('date >= $0 && date <= $1', startOfDay(from), endOfDay(to)) as unknown as {
      ayahsRead: number;
    }[];
    let sum = 0;
    for (const r of rows) sum += Number(r.ayahsRead) || 0;
    return sum;
  }

  /** إجمالي أذكار مكتملة فعليًا في مجال زمني (مفاتيح الأيام: YYYY-MM-DD) */
  private adhkarInRange(from: Date, to: Date): number {
    const realm = getOpenAppRealm();
    const fromKey = dayKey(from);
    const toKey = dayKey(to);
    const rows = realm
      .objects('DhikrProgress')
      .filtered('dateKey >= $0 && dateKey <= $1', fromKey, toKey) as unknown as {
      countCompleted: number;
    }[];
    let sum = 0;
    for (const r of rows) sum += Number(r.countCompleted) || 0;
    return sum;
  }

  /** عدد الأيام التي فيها نشاط فعلي (قراءة أو ذكر) في المجال */
  private activeDaysInRange(from: Date, to: Date): number {
    const realm = getOpenAppRealm();
    const fromKey = dayKey(from);
    const toKey = dayKey(to);
    const days = new Set<string>();
    const progress = realm
      .objects('DailyProgress')
      .filtered('date >= $0 && date <= $1', startOfDay(from), endOfDay(to)) as unknown as {
      date: Date;
      ayahsRead: number;
    }[];
    for (const r of progress) {
      if ((Number(r.ayahsRead) || 0) > 0) days.add(dayKey(new Date(r.date)));
    }
    const dhikr = realm
      .objects('DhikrProgress')
      .filtered('dateKey >= $0 && dateKey <= $1', fromKey, toKey) as unknown as {
      dateKey: string;
      countCompleted: number;
    }[];
    for (const r of dhikr) {
      if ((Number(r.countCompleted) || 0) > 0) days.add(r.dateKey);
    }
    return days.size;
  }

  /** المنجَز فعليًا بوحدة الخطة */
  private doneInRange(plan: ReadingPlan, from: Date, to: Date): number {
    switch (plan.goalUnit) {
      case 'ayahs':
        return this.ayahsInRange(from, to);
      case 'juz':
        // أجزاء = الآيات المقروءة ÷ المتوسط (تقريب موثّق)
        return this.ayahsInRange(from, to) / AYAHS_PER_JUZ;
      case 'adhkar':
        return this.adhkarInRange(from, to);
      case 'days':
        return this.activeDaysInRange(from, to);
      default:
        return 0;
    }
  }

  /** الحصة اليومية: ceil(الهدف ÷ عدد أيام الخطة) */
  dailyTarget(plan: ReadingPlan): number {
    const totalDays = this.totalDays(plan);
    if (totalDays <= 0) return plan.goalValue;
    return Math.ceil(plan.goalValue / totalDays);
  }

  /** عدد أيام الخطة (30 يومًا افتراضًا إن لم يُحدَّد تاريخ انتهاء) */
  totalDays(plan: ReadingPlan): number {
    const start = startOfDay(new Date(plan.startDate));
    const end = plan.targetEndDate ? startOfDay(new Date(plan.targetEndDate)) : null;
    if (!end) return 30;
    return diffDays(start, end) + 1;
  }

  /**
   * تقدّم الخطة — مقيس بالكامل من السجلات الفعلية.
   * لا يُكتب شيء هنا: القراءة فقط.
   */
  progress(plan: ReadingPlan, now: Date = new Date()): PlanProgress {
    const start = startOfDay(new Date(plan.startDate));
    const end = plan.targetEndDate ? startOfDay(new Date(plan.targetEndDate)) : null;
    const today = startOfDay(now);
    const totalDays = this.totalDays(plan);
    const daysElapsed = Math.min(totalDays, diffDays(start, today) + 1);
    const daysLeft = Math.max(0, totalDays - daysElapsed);
    // المجال المحاسَب: من البداية إلى اليوم (لا نتجاوز تاريخ الانتهاء)
    const to = end && end.getTime() < today.getTime() ? end : today;
    const done = this.doneInRange(plan, start, to);
    const goal = plan.goalValue;
    const dailyTarget = this.dailyTarget(plan);
    const todayDone = this.doneInRange(plan, today, today);
    const expectedByToday = Math.min(goal, dailyTarget * daysElapsed);
    const remaining = Math.max(0, goal - done);
    const pacePerDay = daysLeft > 0 ? Math.ceil(remaining / daysLeft) : remaining;
    const finished = done >= goal;
    // تاريخ متوقع: بالمعدل الحالي (إن كان هناك إنجاز)
    let projectedEndDate: Date | null = null;
    const perDay = daysElapsed > 0 ? done / daysElapsed : 0;
    if (!finished && perDay > 0) {
      const daysNeeded = Math.ceil(remaining / perDay);
      projectedEndDate = new Date(today.getTime() + daysNeeded * DAY_MS);
    } else if (finished) {
      projectedEndDate = today;
    }
    return {
      planId: plan.id,
      unit: plan.goalUnit,
      goal,
      done,
      percent: goal > 0 ? Math.min(100, Math.round((done / goal) * 1000) / 10) : 0,
      totalDays,
      daysElapsed,
      daysLeft,
      dailyTarget,
      todayDone,
      expectedByToday,
      onTrack: done >= expectedByToday,
      remaining,
      pacePerDay,
      finished,
      projectedEndDate,
    };
  }

  /** تقدّم كل خطة نشطة (للشاشة الرئيسية وشاشة الخطط) */
  progressForPlans(plans: ReadingPlan[], now: Date = new Date()): Record<string, PlanProgress> {
    const out: Record<string, PlanProgress> = {};
    for (const p of plans) out[p.id] = this.progress(p, now);
    return out;
  }
}

/** نهاية اليوم (23:59:59.999) */
function endOfDay(d: Date): Date {
  const c = startOfDay(d);
  c.setHours(23, 59, 59, 999);
  return c;
}

let instance: PlanRepository | null = null;

export function getPlanRepository(): PlanRepository {
  if (!instance) {
    instance = new PlanRepository();
  }
  return instance;
}
