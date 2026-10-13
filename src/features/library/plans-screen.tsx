/**
 * شاشة الخطط — المرحلة 1: حالة فارغة صادقة.
 * خطط القراءة والختمة تُبنى في المرحلتين 3 و6.
 */
import { Screen, EmptyState } from '../../design-system/components';

export function PlansScreen() {
  return (
    <Screen>
      <EmptyState
        title="الخطط"
        subtitle="خطط الختمة والأهداف اليومية تُبنى في المراحل 3 و6 مع احتساب الإنجاز الفعلي فقط."
        stage="يُبنى في المرحلتين 3 و6"
      />
    </Screen>
  );
}
