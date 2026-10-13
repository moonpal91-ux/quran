/**
 * محوّل تخزين للمتصفح — **للمعاينة فقط** (Web preview harness).
 *
 * المرجع: 02-ARCHITECTURE.md (القسم 7): Realm ليست قاعدة بيانات متصفح؛ أي نسخة ويب
 * تستخدم مخزنًا متوافقًا مع المتصفح خلف الواجهات نفسها.
 *
 * ينفّذ المصغّر من واجهة Realm المستخدم في التطبيق (objects/filtered/create/
 * write/delete/close/exists) فوق localStorage لمعاينة الواجهة في المتصفح —
 * دون ادعاء أن نسخة الويب تخزن في Realm. التطبيق الموزَّع (Android/iOS)
 * يستخدم حزمة realm الأصلية دون أي تغيير.
 */

export interface BrowserObjectSchema {
  name: string;
  primaryKey?: string;
  properties: Record<string, string>;
}

export interface BrowserConfiguration {
  path?: string;
  schema?: BrowserObjectSchema[];
  schemaVersion?: number;
  onMigration?: (oldRealm: unknown, newRealm: unknown) => void;
}

interface StoreData {
  schemaVersion: number;
  tables: Record<string, Record<string, unknown>[]>;
}

const LS_KEY = 'quran-companion-preview-db';

type QueryableRow<T = Record<string, unknown>> = T & {
  filtered(query: string, ...args: unknown[]): QueryableRow<T>[];
};

function loadStore(schemaVersion: number): StoreData {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoreData;
        if (parsed && typeof parsed.tables === 'object' && parsed.schemaVersion === schemaVersion) {
          return parsed;
        }
      }
    }
  } catch {
    // بيانات تالفة → يبدأ جديد (بيانات معاينة فقط)
  }
  return { schemaVersion, tables: {} };
}

function persist(store: StoreData): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_KEY, JSON.stringify(store));
    }
  } catch (e) {
    console.warn('[preview-db] تعذر الحفظ في localStorage', e);
  }
}

/** يحول الحقول من نوع Date حسب المخطط (JSON يفقد نوع Date) */
function withDates(
  obj: Record<string, unknown>,
  schema: BrowserObjectSchema | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...obj };
  if (schema) {
    for (const [key, type] of Object.entries(schema.properties)) {
      if ((type === 'date' || type === 'date?') && typeof out[key] === 'string') {
        out[key] = new Date(out[key] as string);
      }
    }
  }
  return out;
}

/** صيغ الاستعلام المستخدمة في التطبيق: "field = $0" و "a = $0 AND b = $1" */
function matches(row: Record<string, unknown>, query: string, args: unknown[]): boolean {
  return query
    .split(' AND ')
    .every((clause) => {
      const m = clause.trim().match(/^(\w+)\s*=\s*\$(\d+)$/);
      if (!m) return true; // صيغة غير مدعومة في المعاينة — تُوثَّق ولا تُكسر
      const [, field, idx] = m;
      return row[field] === args[Number(idx)];
    });
}

function toStableString(value: unknown): string {
  return JSON.stringify(value, (_, v) => (v instanceof Date ? v.toISOString() : v));
}

class BrowserRealm {
  private store: StoreData;
  private schemaMap: Map<string, BrowserObjectSchema>;
  private version: number;
  private closedFlag = false;

  static exists(_path?: string): boolean {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem(LS_KEY) !== null;
    } catch {
      return false;
    }
  }

  /** يطابق الواجهة الثابتة المستخدمة: Realm.open(config) → Promise */
  static open(config: BrowserConfiguration): Promise<BrowserRealm> {
    return Promise.resolve(new BrowserRealm(config));
  }

  constructor(config: BrowserConfiguration) {
    const version = config.schemaVersion ?? 1;
    this.store = loadStore(version);
    this.version = version;
    this.schemaMap = new Map((config.schema ?? []).map((s) => [s.name, s]));
    this.normalizeDates();
  }

  /** بعد قراءة JSON، حقول date تعود كسلاسل — نحولها إلى Date (مطابقة لسلوك Realm) */
  private normalizeDates(): void {
    for (const [type, table] of Object.entries(this.store.tables)) {
      const schema = this.schemaMap.get(type);
      if (!schema) continue;
      for (const row of table) {
        for (const [key, type2] of Object.entries(schema.properties)) {
          if ((type2 === 'date' || type2 === 'date?') && typeof row[key] === 'string') {
            row[key] = new Date(row[key] as string);
          }
        }
      }
    }
  }

  get schemaVersion(): number {
    return this.version;
  }

  get isClosed(): boolean {
    return this.closedFlag;
  }

  get schema(): BrowserObjectSchema[] {
    return [...this.schemaMap.values()];
  }

  /**
   * يعيد الصفوف **مرجعًا حيًا** داخل المخزن — مطابقة لسلوك Realm (objects()
   * مرجع حي، والتعديل داخل write يُحفظ). أي نسخ هنا كان يكسر المستودعات
   * المكتوبة على هذه الدلالية (كما اكتشفت المعاينة مع updateSettings).
   */
  objects<T = Record<string, unknown>>(type: string): QueryableRow<T>[] {
    this.assertOpen();
    const rows = (this.store.tables[type] ?? []) as T[];
    return this.asQueryable(rows);
  }

  private asQueryable<T>(rows: T[]): QueryableRow<T>[] {
    const self = this;
    const wrapped = rows as QueryableRow<T>[];
    return Object.assign(wrapped, {
      filtered(query: string, ...args: unknown[]): QueryableRow<T>[] {
        const filtered = (wrapped as T[]).filter((r) =>
          matches(r as unknown as Record<string, unknown>, query, args),
        );
        return self.asQueryable(filtered);
      },
    });
  }

  create(type: string, values: Record<string, unknown>): Record<string, unknown> {
    this.assertOpen();
    const schema = this.schemaMap.get(type);
    if (!schema) {
      throw new Error(`نوع غير معروف في مخطط المعاينة: ${type}`);
    }
    const pk = schema.primaryKey;
    if (pk && values[pk] !== undefined) {
      const table = this.store.tables[type] ?? [];
      if (table.some((r) => r[pk] === values[pk])) {
        throw new Error(`مفتاح أساسي مكرر: ${type}.${pk} = ${String(values[pk])}`);
      }
    }
    if (!this.store.tables[type]) {
      this.store.tables[type] = [];
    }
    // الصف نفسه هو المرجع الذي يُعاد ويُعدَّل لاحقًا (دلالية Realm الحية)
    const row = withDates({ ...values }, schema);
    this.store.tables[type].push(row);
    persist(this.store);
    return row;
  }

  write(fn: () => void): void {
    this.assertOpen();
    fn();
    persist(this.store);
  }

  delete(subject: unknown): void {
    this.assertOpen();
    const obj = subject as Record<string, unknown>;
    for (const [type, table] of Object.entries(this.store.tables)) {
      const schema = this.schemaMap.get(type);
      const pk = schema?.primaryKey;
      const idx = table.findIndex((r) => {
        if (pk && obj[pk] !== undefined && r[pk] === obj[pk]) return true;
        // مطابقة عميقة معيارية (تُطبع المفاتيح مرتبة وتُعزل التواريخ)
        const norm = (x: Record<string, unknown>) => {
          const keys = Object.keys(x).sort();
          return toStableString(Object.fromEntries(keys.map((k) => [k, x[k]])));
        };
        return norm(r) === norm(obj);
      });
      if (idx >= 0) {
        table.splice(idx, 1);
        persist(this.store);
        return;
      }
    }
  }

  close(): void {
    persist(this.store);
    this.closedFlag = true;
  }

  private assertOpen(): void {
    if (this.closedFlag) {
      throw new Error('قاعدة المعاينة مغلقة');
    }
  }
}

export default BrowserRealm;
