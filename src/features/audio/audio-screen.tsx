/**
 * شاشة الاستماع — المرحلة 1: هيكل الشاشة فقط.
 * المشغل والتلاوات تُبنى في المرحلة 6 مع توثيق القارئ وشروط الاستخدام لكل ملف (05-4).
 */
import { Screen, EmptyState } from '../../design-system/components';

export function AudioScreen() {
  return (
    <Screen>
      <EmptyState
        title="الاستماع"
        subtitle="التلاوات والمرخّص لها للتنزيل تُستورد في المرحلة 6 مع توثيق القارئ ومصدر الملف وشروط الاستخدام."
        stage="يُبنى في المرحلة 6"
      />
    </Screen>
  );
}
