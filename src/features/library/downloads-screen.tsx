/**
 * شاشة التنزيلات — المرحلة 1: حالة فارغة صادقة.
 * تنزيل المحتوى المرخّص يُبنى في المرحلة 6 مع احترام الرخص (05-4).
 */
import { Screen, EmptyState } from '../../design-system/components';

export function DownloadsScreen() {
  return (
    <Screen>
      <EmptyState
        title="التنزيلات"
        subtitle="تنزيل المحتوى المرخّص للعمل دون اتصال يُبنى في المرحلة 6، ولا يُنزّل أي ملف لا تسمح رخصته بذلك."
        stage="يُبنى في المرحلة 6"
      />
    </Screen>
  );
}
