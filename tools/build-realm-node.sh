#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════════
# بناء الوحدة الأصلية لـ Realm على Node (linux-x64) من المصدر — للبيئات التي
# لا تستطيع تنزيل النسخة الجاهزة من static.realm.io (محجوبة في بعض السنبوركات).
#
# المخرجات: <المستودع>/tools/realm-prebuilds/linux-x64/realm.node
# ثم: cp tools/realm-prebuilds/linux-x64/realm.node node_modules/realm/prebuilds/node/realm.node
#
# المصادر (كلها من GitHub — لا تنزيل من نطاقات أخرى):
#   realm-js v20.2.0  (العلامة المطابقة للحزمة المنشورة realm@20.2.0)
#   realm-core cccb3ca9e26ec452a29f2f0d4050d1e38b8a3d43 (الـ submodule المثبَّت في العلامة)
#   openssl openssl-3.3.1 (الإصدار الذي يطلبه realm-core 14.14.0)
#
# ملاحظة تصميمية مهمة: النسخة المنشورة من realm@20.2.0 مبنية **بلا مزامنة/Atlas**
# (34 فئة في واجهة الربط). لذلك تُزال فئات المزامنة من مواصفة التوليد (spec) قبل
# التوليد، وإلا تعطّل تحميل الوحدة بخطأ injectInjectables.
# ═════════════════════════════════════════════════════════════════════════════
set -uo pipefail

W="${1:-/tmp/realmbuild}"
OUT="${2:-$(cd "$(dirname "$0")/.." && pwd)/tools/realm-prebuilds/linux-x64}"
CORE_SHA=cccb3ca9e26ec452a29f2f0d4050d1e38b8a3d43
NAPI="node-addon-api@^8"

echo "== مجلد العمل: $W =="
mkdir -p "$W" "$OUT"

# ── 1) أدوات البناء (cmake/ninja من PyPI — لا نظام تجميع حزم)
python3 -m pip install --break-system-packages --quiet cmake ninja 2>&1 | tail -2
cmake --version | head -1

# ── 2) المصدر
if [ ! -d "$W/rjs/.git" ]; then
  git clone --depth 1 --branch v20.2.0 https://github.com/realm/realm-js.git "$W/rjs" || exit 1
fi
CORE="$W/rjs/packages/realm/bindgen/vendor/realm-core"
if [ ! -d "$CORE/.git" ]; then
  rm -rf "$CORE"; mkdir -p "$CORE"; cd "$CORE" || exit 1
  git init -q . && git remote add origin https://github.com/realm/realm-core.git
  git fetch --depth 1 origin "$CORE_SHA" && git checkout -q FETCH_HEAD || exit 1
fi

# ── 3) OpenSSL 3.3.1 من المصدر (يطلبه realm-core على لينكس)
if [ ! -f "$W/ossl-install/include/openssl/ssl.h" ]; then
  rm -rf "$W/ossl"
  git clone --depth 1 --branch openssl-3.3.1 https://github.com/openssl/openssl.git "$W/ossl" || exit 1
  ( cd "$W/ossl" && CFLAGS="-O2 -fPIC" ./Configure --prefix="$W/ossl-install" --openssldir="$W/ossl-install" \
      no-shared no-tests no-docs no-apps >/dev/null && make -j2 build_sw >/dev/null && make install_dev >/dev/null ) || exit 1
fi
echo "== OpenSSL جاهز =="

# ── 4) تبعيات التوليد (npm)
mkdir -p "$W/naa" && ( cd "$W/naa" && [ -f package.json ] || npm init -y >/dev/null; npm i --silent $NAPI >/dev/null 2>&1 )
mkdir -p "$W/bdeps" && ( cd "$W/bdeps" && [ -f package.json ] || npm init -y >/dev/null
  npm i --silent @commander-js/extra-typings@^11.1.0 ajv@^8.11.0 chalk@^4.1.2 change-case@^4.1.2 \
    chevrotain@^10.4.0 commander@^11.1.0 debug@^4.3.4 typescript-json-schema@^0.55.0 yaml@^2.2.2 tsx@^4.6.2 >/dev/null 2>&1 )
mkdir -p "$W/rjs/node_modules"
for p in "$W/naa"/node_modules/* "$W/bdeps"/node_modules/*; do
  n=$(basename "$p"); [ "$n" = ".package-lock.json" ] && continue
  ln -sfn "$p" "$W/rjs/node_modules/$n"
done
echo "== تبعيات التوليد جاهزة =="

# ── 5) تعطيل المُنسِّق (clang-format/trunk غير متاح — والتنسيق تجميلي)
FORMATTER="$CORE/bindgen/src/formatter.ts"
if ! grep -q REALM_BINDGEN_SKIP_FORMAT "$FORMATTER"; then
python3 - "$FORMATTER" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
old = '''export function executeCommand(cwd: string, command: string, ...args: string[]) {
  console.log(chalk.dim(command, ...args));'''
new = '''export function executeCommand(cwd: string, command: string, ...args: string[]) {
  // تعديل محلي لبيئة البناء المعزولة: لا مُنسِّق (clang-format/trunk) متاح — التنسيق تجميلي فقط.
  if (process.env.REALM_BINDGEN_SKIP_FORMAT) {
    console.log(chalk.dim(`(skipped formatter) ${command} ${args.join(" ")}`));
    return;
  }
  console.log(chalk.dim(command, ...args));'''
assert old in s, 'تغيّرت بصمة الملف — راجع السكربت'
open(p, 'w', encoding='utf-8').write(s.replace(old, new))
PY
fi

# ── 6) إزالة فئات المزامنة من مواصفة التوليد
#    (قابل للتكرار: يُعاد المواصفة إلى حالتها الأصلية قبل التعديل)
git -C "$CORE" checkout -q FETCH_HEAD -- bindgen/spec.yml
git -C "$W/rjs" checkout -q HEAD -- packages/realm/bindgen/js_spec.yml packages/realm/bindgen/js_opt_in_spec.yml

W="$W" python3 - <<'PY'
import re, os
W = os.environ['W']
CORE_SPEC = f"{W}/rjs/packages/realm/bindgen/vendor/realm-core/bindgen/spec.yml"
JS_SPEC   = f"{W}/rjs/packages/realm/bindgen/js_spec.yml"
OPT_IN    = f"{W}/rjs/packages/realm/bindgen/js_opt_in_spec.yml"

def ind(l): return len(l) - len(l.lstrip())
norm = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())
BLOCK = re.compile(r'^  \S')

def split_blocks(sec):
    """قسّم مقطعًا إلى كتل تبدأ بسطر بمسافتين (يشمل `Name: {}` بسطر واحد)."""
    out, i = [], 0
    while i < len(sec):
        if BLOCK.match(sec[i]):
            j = i + 1
            while j < len(sec) and not BLOCK.match(sec[j]): j += 1
            out.append(sec[i:j]); i = j
        else:
            out.append([sec[i]]); i += 1
    return out

# 6-1) فئات المزامنة من مواصفة core
CLASSES = """App AppCredentials AppSubscriptionToken AsyncOpenTask GenericNetworkTransport
GoogleAuthCode GoogleIdToken MutableSyncSubscriptionSet PushClient SSLVerifyCallback SyncManager
SyncSession SyncSubscriptionSet SyncUser User UserAPIKeyProviderClient UserProfile
UserSubscriptionToken UsernamePasswordProviderClient WatchStream""".split()
rm = {norm(c) for c in CLASSES}
lines = open(CORE_SPEC, encoding='utf-8').read().split('\n')
start = next(i for i, l in enumerate(lines) if l.rstrip() == 'classes:')
nxt = [i for i in range(start + 1, len(lines)) if re.match(r'^[a-z_]+:', lines[i])]
end = nxt[0] if nxt else len(lines)
head, sec, tail = lines[:start + 1], lines[start + 1:end], lines[end:]
out, dropped = [], []
for block in split_blocks(sec):
    m = re.match(r'^  ([A-Za-z_][A-Za-z0-9_]*):', block[0])
    if m and norm(m.group(1)) in rm:
        dropped.append(m.group(1)); continue
    out.extend(block)
open(CORE_SPEC, 'w', encoding='utf-8').write('\n'.join(head + out + tail))
print('فئات مزامنة محذوفة من spec.yml:', len(dropped), dropped)

# 6-2) WeakSyncSession من مواصفة js (خاص بالمزامنة)
s = open(JS_SPEC, encoding='utf-8').read()
if 'WeakSyncSession' in s:
    idx = s.find('\n  WeakSyncSession:')
    i = idx + 1                                  # بداية السطر المراد حذفه
    m = re.compile(r'\n  \S').search(s, i + 1)   # بداية كتلة المستوى الثاني التالية
    j = m.start() + 1 if m else len(s)
    s = s[:i] + s[j:]
    open(JS_SPEC, 'w', encoding='utf-8').write(s)
    print('WeakSyncSession محذوف من js_spec.yml:', 'WeakSyncSession' not in s)

# 6-3) سجلات/تعدادات المزامنة من قائمة الإدراج
DROP_RECORDS = {'UserIdentity','UserAPIKey','SyncConfig','SyncProxyConfig','SyncSubscription',
                'SyncClientTimeouts','SyncClientConfig','SyncError','AppConfig','DeviceInfo',
                'ResumptionDelayInfo','SaltedFileIdent','CompensatingWriteErrorInfo',
                'Request','Response'}
lines = open(OPT_IN, encoding='utf-8').read().split('\n')
out, i, removed = [], 0, []
while i < len(lines):
    l = lines[i]
    m = re.match(r'^\s{2}([A-Za-z_][A-Za-z0-9_]*):\s*$', l)
    if m and m.group(1) in DROP_RECORDS:
        removed.append(m.group(1)); i += 1
        while i < len(lines) and (not lines[i].strip() or ind(lines[i]) > 2): i += 1
        continue
    out.append(l); i += 1
open(OPT_IN, 'w', encoding='utf-8').write('\n'.join(out))
print('سجلات محذوفة من قائمة الإدراج:', len(removed))

# 6-4) إزالة الإشارات لنوعيات المزامنة داخل المواصفة (حقول/طرق/تعدادات)
FORBIDDEN = re.compile(r'\b(SyncConfig|SharedSyncSession|SyncSession|SyncSessionStopPolicy|SyncSessionState|'
    r'SyncSessionConnectionState|SyncError|SyncSubscriptionSet|MutableSyncSubscriptionSet|SyncSubscription|'
    r'SharedSyncUser|SyncUser|SharedApp|app::AppConfig|AppConfig|DeviceInfo|SharedGenericNetworkTransport|'
    r'GenericNetworkTransport|SSLVerifyCallback|SslVerifyCallback|SyncClientConfig|SyncClientTimeouts|'
    r'ResumptionDelayInfo|SharedUser|UserIdentity|UserAPIKey|CompensatingWriteErrorInfo|SaltedFileIdent|'
    r'SyncProxyConfig|SyncFileAction|AuthProvider|AppCacheMode|ClientResetMode|MetadataMode|HttpMethod|WatchStream)\b')
DROP_BLOCKS = {'UserIdentity','UserAPIKey','SyncProxyConfig','SyncConfig','SyncSubscription',
               'SyncClientTimeouts','SyncClientConfig','SyncError','Request','Response','DeviceInfo','AppConfig',
               'CompensatingWriteErrorInfo','SaltedFileIdent','ResumptionDelayInfo',
               'AuthProvider','AppCacheMode','ClientResetMode','MetadataMode','HttpMethod','SyncSessionStopPolicy',
               'SyncSessionState','SyncSessionConnectionState','SyncErrorAction','SyncFileAction','ProgressDirection',
               'SyncUserState','SyncSubscriptionSetState','WatchStreamState','ProxyType'}
lines = open(CORE_SPEC, encoding='utf-8').read().split('\n')
out, i, nb, ne = [], 0, 0, 0
while i < len(lines):
    l = lines[i]
    m = re.match(r'^\s{2}([A-Za-z_][A-Za-z0-9_]*):\s*$', l)
    if m and m.group(1) in DROP_BLOCKS:
        nb += 1; i += 1
        while i < len(lines) and (not lines[i].strip() or ind(lines[i]) > 2): i += 1
        continue
    cur = ind(l) if l.strip() else 10**6
    if cur >= 4 and FORBIDDEN.search(l) and not l.strip().startswith('#'):
        ne += 1; i += 1
        while i < len(lines) and (not lines[i].strip() or ind(lines[i]) > cur): i += 1
        continue
    out.append(l); i += 1
open(CORE_SPEC, 'w', encoding='utf-8').write('\n'.join(out))
print(f'كتل محذوفة من المواصفة: {nb} — إدخالات محذوفة: {ne}')
PY

# ── 6-5) مطابقة قائمة الإدراج مع المواصفة: حذف أي إدخال يطلب نوعًا لم يعد موجودًا
W="$W" python3 - <<'PYEOF'
import os, re
W = os.environ['W']
OPT_IN    = f"{W}/rjs/packages/realm/bindgen/js_opt_in_spec.yml"
JS_SPEC   = f"{W}/rjs/packages/realm/bindgen/js_spec.yml"
CORE_SPEC = f"{W}/rjs/packages/realm/bindgen/vendor/realm-core/bindgen/spec.yml"

def section_bounds(lines, name):
    s = next(i for i, l in enumerate(lines) if l.rstrip() == name + ':')
    e = next((i for i in range(s + 1, len(lines)) if re.match(r'^[a-zA-Z_]+:', lines[i])), len(lines))
    return s, e

def blocks(sec):
    out, i = [], 0
    while i < len(sec):
        if re.match(r'^  \S', sec[i]):
            j = i + 1
            while j < len(sec) and not re.match(r'^  \S', sec[j]): j += 1
            out.append(sec[i:j]); i = j
        else:
            out.append([sec[i]]); i += 1
    return out

def names(path, sec_name):
    lines = open(path, encoding='utf-8').read().split('\n')
    s, e = section_bounds(lines, sec_name)
    return {m.group(1) for b in blocks(lines[s + 1:e])
            if (m := re.match(r'^  ([A-Za-z_#][A-Za-z0-9_#]*):', b[0]))}

known = set()
for f in (CORE_SPEC, JS_SPEC):
    for sec in ('classes', 'records', 'interfaces', 'enums', 'typeAliases'):
        try: known |= names(f, sec)
        except StopIteration: pass

lines = open(OPT_IN, encoding='utf-8').read().split('\n')
total = 0
for section in ('classes', 'records'):
    try: s, e = section_bounds(lines, section)
    except StopIteration: continue
    head, sec, tail = lines[:s + 1], lines[s + 1:e], lines[e:]
    out, removed = [], []
    for b in blocks(sec):
        m = re.match(r'^  ([A-Za-z_#][A-Za-z0-9_#]*):', b[0])
        if m and m.group(1) not in known:
            removed.append(m.group(1)); continue
        out.extend(b)
    if removed:
        print(f'  {section}: حذف {len(removed)} إدخالًا غير موجود ->', removed)
        total += len(removed)
    lines = head + out + tail
open(OPT_IN, 'w', encoding='utf-8').write('\n'.join(lines))
print('إجمالي إدخالات الإدراج المحذوفة:', total)
PYEOF

# ── 6-5) تحقّق سريع: المواصفات ما تزال YAML صالحًا (يفشل مبكرًا بدل ~30 دقيقة بناء)
node -e '
const yaml = require(process.argv[1]);
const fs = require("fs");
let bad = 0;
for (const f of process.argv.slice(2)) {
  try {
    const d = yaml.parse(fs.readFileSync(f, "utf8"));
    console.log("  OK " + f.split("/").pop() + " classes=" + Object.keys(d.classes || {}).length);
  } catch (e) { bad++; console.log("  FAIL " + f + " :: " + e.message.split("\n")[0]); }
}
process.exit(bad ? 1 : 0);
' "$W/bdeps/node_modules/yaml" \
  "$W/rjs/packages/realm/bindgen/vendor/realm-core/bindgen/spec.yml" \
  "$W/rjs/packages/realm/bindgen/js_spec.yml" \
  "$W/rjs/packages/realm/bindgen/js_opt_in_spec.yml" || { echo "المواصفات تالفة؛ أعد تشغيل السكربت (يستعيدها من git)."; exit 1; }

# ── 7) حلقة إصلاح توليدية: يعالج أخطاء «no such type / Method / Field» تلقائيًا
W="$W" python3 - <<'PY'
import os, re, subprocess
W = os.environ['W']
CORE_SPEC = f"{W}/rjs/packages/realm/bindgen/vendor/realm-core/bindgen/spec.yml"
JS_SPEC   = f"{W}/rjs/packages/realm/bindgen/js_spec.yml"
OPT_IN    = f"{W}/rjs/packages/realm/bindgen/js_opt_in_spec.yml"
_tsx_bin = f"{W}/bdeps/node_modules/.bin/tsx"
_tsx_cli = f"{W}/bdeps/node_modules/tsx/dist/cli.mjs"
if os.path.exists(_tsx_bin):
    TSX = [_tsx_bin]
elif os.path.exists(_tsx_cli):
    TSX = ["node", _tsx_cli]          # npm قد لا ينشئ رابط .bin — نستخدم المدخل مباشرة
else:
    raise SystemExit("tsx غير مثبّت في bdeps — شغّل: npm install --prefix \"$W/bdeps\" tsx")
CWD = f"{W}/rjs/packages/realm/bindgen/vendor/realm-core/bindgen"
os.environ['REALM_BINDGEN_SKIP_FORMAT'] = '1'
cmd = TSX + ['realm-bindgen.ts', '--spec', 'spec.yml', '--spec', JS_SPEC, '--opt-in', OPT_IN,
       '--template', f"{W}/rjs/packages/realm/bindgen/src/templates/node.ts", '--output', f"{W}/bgtest"]
ind = lambda l: len(l) - len(l.lstrip())

def remove_entry(name, key):
    lines = open(OPT_IN, encoding='utf-8').read().split('\n')
    bi = next((i for i, l in enumerate(lines) if re.match(r'^\s{2}' + re.escape(key) + r':\s*$', l)), None)
    if bi is None: return 0
    ei = len(lines)
    for i in range(bi + 1, len(lines)):
        if re.match(r'^\s{2}[A-Za-z_#]', lines[i]) and not lines[i].startswith('   '): ei = i; break
    new, i, n = [], 0, 0
    while i < len(lines):
        l = lines[i]
        if bi <= i < ei and l.strip() == '- ' + name:
            n += 1; i += 1
            while i < len(lines) and (not lines[i].strip() or ind(lines[i]) > ind(l)): i += 1
            continue
        new.append(l); i += 1
    open(OPT_IN, 'w', encoding='utf-8').write('\n'.join(new)); return n

def remove_type_refs(t):
    n = 0
    for f in [CORE_SPEC, JS_SPEC, OPT_IN]:
        lines = open(f, encoding='utf-8').read().split('\n')
        pat = re.compile(r'\b' + re.escape(t) + r'\b')
        new, i = [], 0
        while i < len(lines):
            l = lines[i]
            if l.strip() and ind(l) >= 4 and pat.search(l) and not l.strip().startswith('#'):
                n += 1; i += 1
                while i < len(lines) and (not lines[i].strip() or ind(lines[i]) > ind(l)): i += 1
                continue
            new.append(l); i += 1
        open(f, 'w', encoding='utf-8').write('\n'.join(new))
    return n

for it in range(60):
    r = subprocess.run(cmd, cwd=CWD, capture_output=True, text=True, env=os.environ)
    out = r.stdout + r.stderr
    m1 = re.search(r"Method '([^']+)' does not exist on class '([^']+)'", out)
    m2 = re.search(r"Field '([^']+)' does not exist on record/struct '([^']+)'", out)
    m3 = re.search(r'no such type: ([A-Za-z0-9_:]+)', out)
    if m1: print(f'[{it}] method {m1.group(2)}.{m1.group(1)} → {remove_entry(m1.group(1), m1.group(2))}')
    elif m2: print(f'[{it}] field {m2.group(2)}.{m2.group(1)} → {remove_entry(m2.group(1), m2.group(2))}')
    elif m3: print(f'[{it}] type {m3.group(1)} → {remove_type_refs(m3.group(1))}')
    else:
        print('نتيجة التوليد:', r.returncode)
        if r.returncode != 0: print(out[-1500:])
        break
PY

# ── 8) التهيئة والبناء
mkdir -p "$W/rjs/packages/realm/build/node"
cd "$W/rjs/packages/realm/build/node" || exit 1
cmake -G Ninja ../../binding/node \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_JS_INC=/usr/local/include/node \
  -DREALM_USE_SYSTEM_OPENSSL=ON \
  -DOPENSSL_ROOT_DIR="$W/ossl-install" \
  -DOPENSSL_USE_STATIC_LIBS=TRUE || exit 1
REALM_BINDGEN_SKIP_FORMAT=1 cmake --build . --target realm-js-node -j 2 || exit 1

cp "$W/rjs/packages/realm/prebuilds/node/realm.node" "$OUT/realm.node"
echo "== تم =="
ls -la "$OUT/realm.node"
sha256sum "$OUT/realm.node"
