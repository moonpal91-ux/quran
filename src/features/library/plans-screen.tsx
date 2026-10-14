/**
 * شاشة الخطط (المرحلة 7) — ختمة القرآن، ورد القراءة، المواظبة على الأذكار.
 *
 * قواعد العرض (01-6 و03-SCHEMA):
 * - **لا تحديد يدوي للإنجاز**: لا زر «أنهيت اليوم». التقدّم يُقرأ من
 *   سجل القراءة الفعلي (DailyProgress) وعدّادات الأذكار الفعلية (DhikrProgress).
 * - لا خطة على «الصفحات»: `pagesRead` صفر دائمًا حتى يأتي نمط الصفحات —
 *   ويُقال ذلك للمستخدم صراحةً بدل تقديم خطة لا تُقاس.
 * - تقريب الأجزاء معلوم ومُصرَّح به (6236 ÷ 30 ≈ 207.9 آية/جزء).
 * - الأرقام كلها من الحزمة المعتمدة (6236 آية، 30 جزءًا) — لا قيم مُختلقة.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button, Card, EmptyState, Screen, SectionTitle } from '../../design-system/components';
import { useTheme } from '../../design-system/theme';
import { fontFamilies, fontSizes, radius, spacing, touchTarget } from '../../design-system/tokens';
import {
  AYAHS_PER_JUZ,
  PLAN_STATUS_LABELS,
  PLAN_UNITS,
  PLAN_UNIT_LABELS,
  TOTAL_AYAHS,
  TOTAL_JUZ,
  getPlanRepository,
  type CreatePlanInput,
} from '../../repositories/plan-repository';
import type { GoalUnit, PlanProgress, PlanStatus, PlanType, ReadingPlan } from '../../database/realm/types';

/** قوالب جاهزة — كلها بوحدات لها مصدر بيانات فعلي */
interface Preset {
  id: string;
  title: string;
  planType: PlanType;
  unit: GoalUnit;
  goal: number;
  days: number;
  hint: string;
}

const PRESETS: Preset[] = [
  {
    id: 'khatmah-30',
    title: 'ختمة في شهر',
    planType: 'khatmah',
    unit: 'ayahs',
    goal: TOTAL_AYAHS,
    days: 30,
    hint: `${TOTAL_AYAHS} آية في 30 يومًا`,
  },
  {
    id: 'khatmah-90',
    title: 'ختمة في ثلاثة أشهر',
    planType: 'khatmah',
    unit: 'ayahs',
    goal: TOTAL_AYAHS,
    days: 90,
    hint: `${TOTAL_AYAHS} آية في 90 يومًا`,
  },
  {
    id: 'juz-30',
    title: 'ختمة بالأجزاء',
    planType: 'khatmah',
    unit: 'juz',
    goal: TOTAL_JUZ,
    days: 30,
    hint: `${TOTAL_JUZ} جزءًا — جزء كل يوم`,
  },
  {
    id: 'wird',
    title: 'ورد قرآني يومي',
    planType: 'custom',
    unit: 'ayahs',
    goal: 20 * 30,
    days: 30,
    hint: '20 آية كل يوم لمدة شهر',
  },
  {
    id: 'memorize',
    title: 'حفظ سورة قصيرة',
    planType: 'memorization',
    unit: 'ayahs',
    goal: 20,
    days: 20,
    hint: 'آية كل يوم — مراجعة متكررة',
  },
  {
    id: 'adhkar',
    title: 'مواظبة الأذكار',
    planType: 'review',
    unit: 'days',
    goal: 30,
    days: 30,
    hint: 'يوم مواظبة واحد يُحتسب بذكر أو قراءة فعلية',
  },
];

function fmt(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString('ar-EG');
}

function fmtUnit(n: number, unit: GoalUnit): string {
  if (unit === 'juz') {
    const rounded = Math.round(n * 10) / 10;
    return rounded.toLocaleString('ar-EG');
  }
  return fmt(Math.round(n));
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });
  } catch {
    return '—';
  }
}

export function PlansScreen() {
  const { tokens, fontScale } = useTheme();
  const repo = useMemo(() => getPlanRepository(), []);
  const [plans, setPlans] = useState<ReadingPlan[]>([]);
  const [progress, setProgress] = useState<Record<string, PlanProgress>>({});
  const [loading, setLoading] = useState(true);
  const [composer, setComposer] = useState(false);
  const [presetId, setPresetId] = useState<string>(PRESETS[0].id);
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState(String(TOTAL_AYAHS));
  const [days, setDays] = useState('30');
  const [unit, setUnit] = useState<GoalUnit>('ayahs');
  const [error, setError] = useState<string>('');

  const load = useCallback(() => {
    setLoading(true);
    try {
      const all = repo.listPlans();
      setPlans(all);
      setProgress(repo.progressForPlans(all));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    load();
  }, [load]);

  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
  const goalValue = Number(goal) || 0;
  const daysValue = Number(days) || 0;
  const previewDaily = goalValue > 0 && daysValue > 0 ? Math.ceil(goalValue / daysValue) : 0;

  const openComposer = (p: Preset) => {
    setPresetId(p.id);
    setUnit(p.unit);
    setGoal(String(p.goal));
    setDays(String(p.days));
    setTitle(p.title);
    setComposer(true);
  };

  const create = () => {
    const input: CreatePlanInput = {
      title: title.trim() || preset.title,
      planType: preset.planType,
      goalUnit: unit,
      goalValue,
      durationDays: daysValue,
    };
    try {
      repo.createPlan(input);
      setComposer(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const changeStatus = (id: string, status: PlanStatus) => {
    repo.setStatus(id, status);
    load();
  };

  const remove = (id: string) => {
    repo.deletePlan(id);
    load();
  };

  const active = plans.filter((p) => p.status === 'active' || p.status === 'paused');
  const archived = plans.filter((p) => p.status === 'archived' || p.status === 'completed');

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <Card>
          <SectionTitle>الخطط</SectionTitle>
          <Text style={[styles.muted, { color: tokens.muted }]}>
            خطط للقراءة والختمة والأذكار. التقدّم يُقرأ من سجلك الفعلي فقط — لا أزرار
            «أنهيت اليوم»، وما لم تُسجَّل قراءة أو ذكر لا يتقدّم شيء.
          </Text>
          <View style={{ height: spacing.sm }} />
          <Text style={[styles.muted, { color: tokens.muted }]}>
            الأجزاء تُقاس بمتوسط {Math.round(AYAHS_PER_JUZ)} آية للجزء (تقريب معلوم؛ حدود
            الأجزاء غير متساوية في عدد الآيات).
          </Text>
        </Card>

        <View style={{ height: spacing.md }} />

        <SectionTitle>ابدأ خطة</SectionTitle>
        <View style={styles.presetGrid}>
          {PRESETS.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              onPress={() => openComposer(p)}
              style={({ pressed }) => [
                styles.preset,
                {
                  backgroundColor: tokens.surface,
                  borderColor: tokens.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={[styles.presetTitle, { color: tokens.text }]}>{p.title}</Text>
              <Text style={[styles.presetHint, { color: tokens.muted }]}>{p.hint}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ height: spacing.lg }} />

        <SectionTitle>خططك ({active.length})</SectionTitle>
        {active.length === 0 ? (
          <Card>
            <EmptyState
              title="لا خطط بعد"
              subtitle="اختر قالبًا أعلاه — سيُحتسب إنجازك من قراءتك وأذكارك الفعلية، بلا إدخال يدوي."
            />
          </Card>
        ) : (
          active.map((plan) => {
            const pr = progress[plan.id];
            if (!pr) return null;
            const pct = Math.max(0, Math.min(100, pr.percent));
            return (
              <Card key={plan.id} style={{ marginBottom: spacing.sm }}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.planTitle, { color: tokens.text }]}>{plan.title}</Text>
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: pr.onTrack ? tokens.primary : tokens.accent,
                      },
                    ]}
                  >
                    <Text style={[styles.badgeText, { color: tokens.onPrimary }]}>
                      {pr.finished ? 'مكتملة' : pr.onTrack ? 'على المسار' : 'متأخرة'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.muted, { color: tokens.muted }]}>
                  الهدف: {fmt(pr.goal)} {PLAN_UNIT_LABELS[pr.unit] ?? pr.unit} · المدة:{' '}
                  {fmt(pr.totalDays)} يومًا
                </Text>
                <View style={{ height: spacing.sm }} />
                <View style={[styles.bar, { backgroundColor: tokens.border }]}>
                  <View
                    style={[
                      styles.fill,
                      { width: `${pct}%` as never, backgroundColor: tokens.primary },
                    ]}
                  />
                </View>
                <View style={{ height: spacing.sm }} />
                <Text style={[styles.muted, { color: tokens.muted }]}>
                  المنجَز فعليًا: {fmtUnit(pr.done, pr.unit)} من {fmt(pr.goal)} ({pct}%) · الباقي:{' '}
                  {fmtUnit(pr.remaining, pr.unit)}
                </Text>
                <Text style={[styles.muted, { color: tokens.muted }]}>
                  اليوم: {fmtUnit(pr.todayDone, pr.unit)} · حصة اليوم:{' '}
                  {fmtUnit(pr.dailyTarget, pr.unit)} · المتوقع حتى اليوم:{' '}
                  {fmtUnit(pr.expectedByToday, pr.unit)}
                </Text>
                <Text style={[styles.muted, { color: tokens.muted }]}>
                  {pr.daysLeft > 0
                    ? `المتبقي ${fmt(pr.daysLeft)} يومًا — يلزم ${fmtUnit(pr.pacePerDay, pr.unit)} يوميًا`
                    : 'انتهت مدة الخطة'}
                  {pr.projectedEndDate && !pr.finished
                    ? ` · الإنتهاء المتوقع بالمعدل الحالي: ${fmtDate(pr.projectedEndDate)}`
                    : ''}
                </Text>
                <View style={{ height: spacing.sm }} />
                <View style={styles.rowBetween}>
                  {plan.status === 'active' ? (
                    <Button
                      label="إيقاف مؤقت"
                      variant="outline"
                      onPress={() => changeStatus(plan.id, 'paused')}
                    />
                  ) : (
                    <Button label="استئناف" onPress={() => changeStatus(plan.id, 'active')} />
                  )}
                  <Button
                    label="أرشفة"
                    variant="outline"
                    onPress={() => changeStatus(plan.id, 'archived')}
                  />
                  <Button
                    label="حذف"
                    variant="ghost"
                    onPress={() => remove(plan.id)}
                  />
                </View>
              </Card>
            );
          })
        )}

        {archived.length > 0 && (
          <>
            <View style={{ height: spacing.lg }} />
            <SectionTitle>المؤرشفة ({archived.length})</SectionTitle>
            {archived.map((plan) => {
              const pr = progress[plan.id];
              return (
                <Card key={plan.id} style={{ marginBottom: spacing.sm }}>
                  <Text style={[styles.planTitle, { color: tokens.text }]}>{plan.title}</Text>
                  <Text style={[styles.muted, { color: tokens.muted }]}>
                    {PLAN_STATUS_LABELS[plan.status as PlanStatus] ?? plan.status}
                    {pr ? ` · ${fmtUnit(pr.done, pr.unit)} من ${fmt(pr.goal)}` : ''}
                  </Text>
                  <View style={{ height: spacing.sm }} />
                  <View style={styles.rowBetween}>
                    <Button
                      label="إعادة تنشيط"
                      variant="outline"
                      onPress={() => changeStatus(plan.id, 'active')}
                    />
                    <Button label="حذف" variant="ghost" onPress={() => remove(plan.id)} />
                  </View>
                </Card>
              );
            })}
          </>
        )}

        {error ? (
          <Text style={[styles.error, { color: tokens.error }]}>{error}</Text>
        ) : null}

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* ─────────── ملحق إنشاء خطة ─────────── */}
      <Modal visible={composer} transparent animationType="slide" onRequestClose={() => setComposer(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={[styles.sheet, { backgroundColor: tokens.background }]}>
            <ScrollView>
              <SectionTitle>خطة جديدة</SectionTitle>
              <Text style={[styles.muted, { color: tokens.muted }]}>{preset.hint}</Text>
              <View style={{ height: spacing.md }} />
              <Text style={[styles.label, { color: tokens.text }]}>العنوان</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={preset.title}
                placeholderTextColor={tokens.muted}
                style={[
                  styles.input,
                  { color: tokens.text, borderColor: tokens.border, backgroundColor: tokens.surface },
                ]}
              />
              <View style={{ height: spacing.md }} />
              <Text style={[styles.label, { color: tokens.text }]}>الوحدة</Text>
              <View style={styles.chips}>
                {PLAN_UNITS.map((u) => (
                  <Pressable
                    key={u}
                    onPress={() => setUnit(u)}
                    style={[
                      styles.chip,
                      {
                        borderColor: unit === u ? tokens.primary : tokens.border,
                        backgroundColor: unit === u ? tokens.primary : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: unit === u ? tokens.onPrimary : tokens.text },
                      ]}
                    >
                      {PLAN_UNIT_LABELS[u]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ height: spacing.md }} />
              <Text style={[styles.label, { color: tokens.text }]}>الهدف</Text>
              <TextInput
                value={goal}
                onChangeText={setGoal}
                keyboardType="numeric"
                style={[
                  styles.input,
                  { color: tokens.text, borderColor: tokens.border, backgroundColor: tokens.surface },
                ]}
              />
              <View style={{ height: spacing.md }} />
              <Text style={[styles.label, { color: tokens.text }]}>المدة (يومًا)</Text>
              <TextInput
                value={days}
                onChangeText={setDays}
                keyboardType="numeric"
                style={[
                  styles.input,
                  { color: tokens.text, borderColor: tokens.border, backgroundColor: tokens.surface },
                ]}
              />
              <View style={{ height: spacing.md }} />
              <Text style={[styles.muted, { color: tokens.muted }]}>
                الحصة اليومية: {previewDaily > 0 ? fmt(previewDaily) : '—'}{' '}
                {PLAN_UNIT_LABELS[unit]} يوميًا
              </Text>
              {error ? (
                <Text style={[styles.error, { color: tokens.error }]}>{error}</Text>
              ) : null}
              <View style={{ height: spacing.md }} />
              <View style={styles.rowBetween}>
                <Button label="إنشاء الخطة" onPress={create} disabled={goalValue <= 0 || daysValue <= 0} />
                <Button label="إلغاء" variant="outline" onPress={() => setComposer(false)} />
              </View>
              <View style={{ height: spacing.xl }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 200 },
  muted: { fontSize: fontSizes.sm, fontFamily: fontFamilies.ui, lineHeight: fontSizes.sm * 1.7 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  planTitle: { fontSize: fontSizes.lg, fontFamily: fontFamilies.uiMedium, flexShrink: 1 },
  badge: { borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: fontSizes.xs, fontFamily: fontFamilies.uiMedium },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  presetGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm },
  preset: {
    minWidth: '47%',
    flexGrow: 1,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.md,
    minHeight: touchTarget * 1.5,
  },
  presetTitle: { fontSize: fontSizes.md, fontFamily: fontFamilies.uiMedium, textAlign: 'right' },
  presetHint: { fontSize: fontSizes.xs, fontFamily: fontFamilies.ui, textAlign: 'right', marginTop: 4 },
  chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: touchTarget,
    justifyContent: 'center',
  },
  chipText: { fontSize: fontSizes.sm, fontFamily: fontFamilies.uiMedium },
  label: { fontSize: fontSizes.sm, fontFamily: fontFamilies.uiMedium, marginBottom: spacing.xs, textAlign: 'right' },
  input: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSizes.md,
    fontFamily: fontFamilies.ui,
    textAlign: 'right',
  },
  error: { fontSize: fontSizes.sm, fontFamily: fontFamilies.ui, marginTop: spacing.sm, textAlign: 'right' },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: spacing.lg,
    maxHeight: '88%',
  },
});
