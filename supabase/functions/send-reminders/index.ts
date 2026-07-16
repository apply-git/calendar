// ============================================================================
// supabase/functions/send-reminders/index.ts
// ----------------------------------------------------------------------------
// 「計畫表」背景推播提醒 Edge Function（進階選用功能，Deno / Supabase Edge Runtime）。
//
// 用途：由 Supabase Dashboard 的 Cron（Integrations -> Cron，建議每 10 分鐘一次）
// 定期呼叫這個 Function。每次執行會：
//   1. 用 service_role 讀出 public.sync_state 全部使用者的整包備份 payload。
//   2. 對每個使用者的 payload.tasks，找出「今天會出現、有設提醒分鐘數、
//      提醒時刻（開始時間減提醒分鐘數）落在本次執行窗口內、尚未完成」的行程。
//   3. 對該使用者名下所有 push_subscriptions 裝置發送 Web Push 通知。
//   4. 用 public.push_sent_log 防止同一筆行程同一天被重複通知；
//      發送對象回應 404/410（訂閱已失效）時，順手刪掉該筆過期訂閱。
//
// 完整部署步驟（Dashboard 圖形介面建立 Function、設定 secrets、設定 Cron）
// 見 CLOUD_PUSH_SETUP.md。
//
// ---------------------------------------------------------------------------
// 【重要：關於發送推播用的實作方式，2026-07 查證後的決定】
// ---------------------------------------------------------------------------
// 這個檔案原本用 `npm:web-push`（Node.js 生態圈最主流的 Web Push 套件）。
// 查證後改成「完全不依賴任何第三方套件、只用 Deno/瀏覽器都內建的 Web Crypto
// API（crypto.subtle）手刻 RFC 8291（aes128gcm 訊息加密）+ RFC 8292（VAPID
// 簽章）」，原因：
//
//   1. `npm:web-push` 在 Deno 執行環境有實際記錄在案、非個案的解密失敗問題：
//      Deno 官方 issue（denoland/deno#23693「npm:web-push not working」）
//      討論串裡明確有使用者回報「在 Supabase Edge Function 用 web-push 時
//      收到推播但 Chrome/Brave 的 chrome://gcm-internals 顯示
//      AES-GCM decryption failed」，且討論串最後幾則留言顯示問題斷斷續續、
//      並未穩定修復。這代表就算 `npx -p typescript tsc --noEmit` 能過、
//      部署也成功，使用者仍可能「curl 測試顯示 sent:1 但手機收不到通知」，
//      而且是那種很難排查的沉默失敗（Push 服務回 201 成功、瀏覽器端解密
//      失敗才是真正掉單的地方，Edge Function 這邊完全看不到任何錯誤訊息）。
//      來源：https://github.com/denoland/deno/issues/23693
//
//   2. 找到的兩個替代套件都各有取捨，沒有一個是「直接可信任」的：
//      - `@block65/webcrypto-web-push`（npm，聲稱相容 Deno）：程式碼實際
//        用的是 `Content-Encoding: aesgcm`（2016 年的舊草案格式），不是
//        現行標準 RFC 8291/8188 的 `aes128gcm`。舊格式相容性風險更高，
//        不採用。
//      - `jsr:@negrel/webpush`：明確聲稱實作 RFC 8291/8292、且作者網誌
//        直接列出「Supabase Edge」為目標執行環境
//        （https://www.negrel.dev/blog/deno-web-push-notifications/），
//        但套件本身的金鑰格式是它自訂的 JWK 匯出格式，不是本專案（以及
//        `npx web-push generate-vapid-keys`）產生的標準 raw base64url
//        VAPID 金鑰格式，要接上還是得自己寫一段格式轉換；而且套件作者自己
//        在 README 註明「hasn't been reviewed by crypto experts and may be
//        insecure」。
//
//   3. 既然不管選哪個套件，最後都得自己動手處理金鑰格式或編碼細節，乾脆
//      直接依照官方標準文件手刻，全程只用 Deno/瀏覽器原生就有的
//      `crypto.subtle`（Web Crypto API，W3C 標準，Deno 完整支援，不是
//      `npm:web-push` 出包的那個 Node crypto 相容層），不吃到任何第三方
//      套件版本更新、npm/jsr 相容性風險：
//        - RFC 8291：https://www.rfc-editor.org/rfc/rfc8291（訊息加密）
//        - RFC 8188：https://www.rfc-editor.org/rfc/rfc8188（aes128gcm
//          內容編碼格式）
//        - RFC 8292：https://www.rfc-editor.org/rfc/rfc8292（VAPID JWT）
//      下方 `encryptWebPushPayload()` 的每一個中間值（ecdh_secret、
//      PRK_key、IKM、PRK、CEK、NONCE、最終密文）都已經對照 RFC 8291
//      Appendix A 附的官方測試向量、用 Node.js 的 Web Crypto API
//      （與 Deno 同一套 W3C 標準介面）逐一比對過，位元組對位元組完全一致；
//      VAPID JWT 簽章／驗章也做過 sign→verify 迴圈測試（Web Crypto 的
//      ECDSA 簽章輸出本來就是 JOSE/JWS 需要的 raw r‖s 64 bytes 格式，
//      不需要額外的 DER 轉換）。
//
//   4. 金鑰格式維持跟專案其他地方一致：VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
//      兩個 secrets 用的仍然是標準 raw base64url 格式（`npx web-push
//      generate-vapid-keys` 印出來的那兩串，跟 config.js 的
//      `webPushPublicKey` 是同一把公鑰），不需要额外轉換格式，
//      `CLOUD_PUSH_SETUP.md` 的金鑰產生步驟不必更動。
//
// 環境變數：
//   - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY：Supabase 對 Edge Function
//     自動注入，不需要自己設定。
//   - TZ：計算「今天」與提醒時刻用的時區，預設 'Asia/Taipei'（可用
//     Dashboard 的 secrets 設定頁覆蓋，一般不需要改）。
//   - VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT：Web Push 用的
//     VAPID 金鑰組，需要自己在 Dashboard 設定（VAPID_PUBLIC_KEY 要跟
//     config.js 的 webPushPublicKey 是同一把公鑰）。
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ---- 型別（跟 app.js 的行程物件對齊，只列出這個 Function 會用到的欄位） ----

interface TaskLike {
  id: string;
  title?: string;
  category?: string;
  date: string; // YYYY-MM-DD，第一次出現的日期
  start?: string; // HH:MM
  repeat?: string; // 'none' | 'daily' | 'weekly' | 'monthly' | 'interval' | 'weekdays' | 'monthlyNth'
  repeatInterval?: number;
  repeatWeekday?: number;
  repeatNth?: number;
  excludedDates?: string[];
  completedDates?: string[];
  reminder?: number; // 分鐘數，< 0 代表不提醒（跟 app.js 的語意一致）
}

interface SyncStateRow {
  user_id: string;
  payload: { tasks?: TaskLike[] } | null;
}

interface PushSubscriptionJson {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

interface PushSubRow {
  endpoint: string;
  subscription: PushSubscriptionJson;
}

// ---- occursOnDate()：簡化移植自 app.js，只用 date-only（YYYY-MM-DD）字串比較 ----
// 刻意全部用 UTC 建構 Date 物件：這裡的「日期」只是行事曆上的一天（不含時區意義），
// 用 UTC 存純粹是為了避開伺服器所在時區造成的加減日誤差，跟實際提醒時刻的時區換算
// （zonedTimeToUtc）是分開兩件事。
//
// 【規則字串逐條比對來源】D:\計畫表\app.js 的 occursOnDate()（約第 2454 行起）：
// 'none' / 'daily' / 'weekly' / 'monthly' / 'interval' / 'weekdays' / 'monthlyNth'
// 七種字串與判斷邏輯（含 repeatInterval 預設 2、repeatNth 預設 1、repeatNth===-1
// 代表最後一週）皆與本檔案逐條核對一致。

function keyToUtcDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function daysInMonthUtc(date: Date): number {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

function nthWeekdayInMonthUtc(date: Date): number {
  return Math.ceil(date.getUTCDate() / 7);
}

function occursOnDate(task: TaskLike, dateKey: string): boolean {
  if (Array.isArray(task.excludedDates) && task.excludedDates.includes(dateKey)) return false;
  if (task.date === dateKey) return true;
  if (!task.repeat || task.repeat === 'none') return false;

  const base = keyToUtcDate(task.date);
  const target = keyToUtcDate(dateKey);
  if (target < base) return false;

  if (task.repeat === 'daily') return true;
  if (task.repeat === 'weekly') return base.getUTCDay() === target.getUTCDay();
  if (task.repeat === 'monthly') return base.getUTCDate() === target.getUTCDate();
  if (task.repeat === 'interval') {
    const interval = Math.max(1, Math.floor(Number(task.repeatInterval) || 2));
    const diffDays = Math.round((target.getTime() - base.getTime()) / 86400000);
    return diffDays % interval === 0;
  }
  if (task.repeat === 'weekdays') {
    const day = target.getUTCDay();
    return day >= 1 && day <= 5;
  }
  if (task.repeat === 'monthlyNth') {
    const weekday = Number.isFinite(Number(task.repeatWeekday)) ? Number(task.repeatWeekday) : base.getUTCDay();
    if (target.getUTCDay() !== weekday) return false;
    const nth = Number(task.repeatNth) || 1;
    if (nth === -1) return target.getUTCDate() + 7 > daysInMonthUtc(target);
    return nthWeekdayInMonthUtc(target) === nth;
  }
  return false;
}

// ---- 時區換算：把「某時區的某天某時刻」換算成正確的 UTC Date ----
// 用 Intl.DateTimeFormat 讀出指定時區在某個時間點的實際時鐘偏移量（分鐘），
// 兩段式換算可正確處理有日光節約時間的時區；Asia/Taipei 全年固定 +8，不受影響。

function timeZoneOffsetMinutes(timeZone: string, atUtc: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(atUtc);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const asUtcIfLocal = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return (asUtcIfLocal - atUtc.getTime()) / 60000;
}

function zonedTimeToUtc(dateKey: string, hm: string, timeZone: string): Date {
  const [y, mo, d] = dateKey.split('-').map(Number);
  const [h, mi] = hm.split(':').map(Number);
  const roughUtcMs = Date.UTC(y, mo - 1, d, h, mi, 0);
  const rough = new Date(roughUtcMs);
  const offsetMin = timeZoneOffsetMinutes(timeZone, rough);
  // local = UTC + offset  =>  UTC = local - offset
  return new Date(roughUtcMs - offsetMin * 60000);
}

function todayKeyInZone(timeZone: string, now: Date): string {
  // en-CA 的日期格式就是 YYYY-MM-DD，直接拿來當 dateKey 用。
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

// ---- 提醒視窗判斷：抽成單一純函式，方便獨立測試（見 _we_test.js 的移植版） ----
// 「提醒時刻（開始時間減提醒分鐘數）落在現在～現在+15分鐘」判斷。15 分鐘的窗口
// 搭配建議的 10 分鐘排程間隔，留一點緩衝避免排程延遲漏掉；真正防止重複通知靠的
// 是 push_sent_log，不是靠這個窗口大小。

function isReminderDue(task: TaskLike, now: Date, timeZone: string): boolean {
  if (!task.id || !task.start) return false;
  if (task.reminder === undefined || task.reminder === null || Number(task.reminder) < 0) return false;

  const todayKey = todayKeyInZone(timeZone, now);
  if (Array.isArray(task.completedDates) && task.completedDates.includes(todayKey)) return false;
  if (!occursOnDate(task, todayKey)) return false;

  const startAtUtc = zonedTimeToUtc(todayKey, task.start, timeZone);
  const remindAtUtc = new Date(startAtUtc.getTime() - Number(task.reminder || 0) * 60000);
  const windowEnd = new Date(now.getTime() + 15 * 60 * 1000);
  return remindAtUtc >= now && remindAtUtc <= windowEnd;
}

// ============================================================================
// Web Push 加密與發送：純手刻 RFC 8291（訊息加密）+ RFC 8188（aes128gcm 內容
// 編碼）+ RFC 8292（VAPID JWT），只用 Deno 內建的 Web Crypto API（crypto.subtle）
// 與 fetch，沒有任何第三方套件依賴。理由與查證來源見檔案最上方的說明。
// ============================================================================

// ---- base64url 編碼/解碼（跟 push.js 的 urlBase64ToUint8Array() 是同一套邏輯，
// 只是這裡在 Deno 端要雙向都用得到，所以補上編碼方向） ----

function base64UrlToBytes(base64url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

// TypeScript 5.7+ 把 Uint8Array 標成泛型 Uint8Array<ArrayBufferLike>，跟 DOM lib 的
// BufferSource（要求 ArrayBufferView<ArrayBuffer>）在型別層級對不起來，但執行期行為
// 完全不受影響（Deno/瀏覽器的 Web Crypto、fetch 本來就吃一般 Uint8Array）。這裡用一個
// 小工具函式統一轉型，避免每個呼叫點各自處理。
function asBufferSource(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource;
}

async function hmacSha256(keyBytes: Uint8Array, dataBytes: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', asBufferSource(keyBytes), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, asBufferSource(dataBytes));
  return new Uint8Array(sig);
}

// RFC 8291 + RFC 8188：把明文 payload 加密成 aes128gcm 格式的 HTTP body。
// 每一步變數命名對照 RFC 8291 Section 3.4 的偽代碼，已用官方 Appendix A 測試
// 向量逐位元組驗證過（驗證腳本與結果見查證回報，不隨程式碼留在專案內）。
async function encryptWebPushPayload(
  plaintext: Uint8Array,
  subscriptionKeys: { p256dh: string; auth: string }
): Promise<Uint8Array> {
  const uaPublicRaw = base64UrlToBytes(subscriptionKeys.p256dh); // 使用者裝置的 ECDH 公鑰（65 bytes，0x04 開頭）
  const authSecret = base64UrlToBytes(subscriptionKeys.auth); // 使用者裝置的驗證密鑰（16 bytes）

  const uaPublicKey = await crypto.subtle.importKey('raw', asBufferSource(uaPublicRaw), { name: 'ECDH', namedCurve: 'P-256' }, false, []);

  // 每次發送都產生一組新的臨時（ephemeral）ECDH 金鑰對，用完即丟。
  const localKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', localKeyPair.publicKey));

  const ecdhSecretBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: uaPublicKey }, localKeyPair.privateKey, 256);
  const ecdhSecret = new Uint8Array(ecdhSecretBits);

  const keyInfo = concatBytes(new TextEncoder().encode('WebPush: info'), new Uint8Array([0]), uaPublicRaw, asPublicRaw);

  // HKDF-Extract(salt=auth_secret, IKM=ecdh_secret)
  const prkKey = await hmacSha256(authSecret, ecdhSecret);
  // HKDF-Expand(PRK_key, key_info, 32) —— 輸出長度剛好等於一個 HMAC-SHA256 區塊，單次呼叫即可。
  const ikm = await hmacSha256(prkKey, concatBytes(keyInfo, new Uint8Array([1])));

  const salt = crypto.getRandomValues(new Uint8Array(16));
  // RFC 8188 的 HKDF-Extract(salt, IKM)
  const prk = await hmacSha256(salt, ikm);

  const cekInfo = concatBytes(new TextEncoder().encode('Content-Encoding: aes128gcm'), new Uint8Array([0]));
  const cek = (await hmacSha256(prk, concatBytes(cekInfo, new Uint8Array([1])))).slice(0, 16);

  const nonceInfo = concatBytes(new TextEncoder().encode('Content-Encoding: nonce'), new Uint8Array([0]));
  const nonce = (await hmacSha256(prk, concatBytes(nonceInfo, new Uint8Array([1])))).slice(0, 12);

  const cekKey = await crypto.subtle.importKey('raw', asBufferSource(cek), { name: 'AES-GCM' }, false, ['encrypt']);
  // 單一 record：補上結尾用的 padding delimiter 0x02（RFC 8188 規定最後一筆 record 用 0x02，
  // 本專案訊息很短，一筆 record 就夠，不需要額外補零 padding）。
  const paddedPlaintext = concatBytes(plaintext, new Uint8Array([2]));
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: asBufferSource(nonce) }, cekKey, asBufferSource(paddedPlaintext));
  const ciphertext = new Uint8Array(cipherBuf);

  // aes128gcm 內容編碼標頭（RFC 8188 Section 2.1）：salt(16) + rs(4, big-endian) + idlen(1) + keyid(idlen)
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);
  const header = concatBytes(salt, recordSize, new Uint8Array([asPublicRaw.length]), asPublicRaw);

  return concatBytes(header, ciphertext);
}

// RFC 8292：簽發 VAPID JWT（ES256 / JWS Compact Serialization）。
// vapidPublicKeyB64 / vapidPrivateKeyB64 是標準 raw base64url 格式（跟
// `npx web-push generate-vapid-keys` 印出來的格式一致），內部才轉成
// crypto.subtle 簽章需要的 JWK 格式。
async function signVapidJwt(audience: string, subject: string, vapidPublicKeyB64: string, vapidPrivateKeyB64: string): Promise<string> {
  const publicRaw = base64UrlToBytes(vapidPublicKeyB64); // 65 bytes，0x04 開頭的未壓縮 EC 座標點
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: bytesToBase64Url(publicRaw.slice(1, 33)),
    y: bytesToBase64Url(publicRaw.slice(33, 65)),
    d: vapidPrivateKeyB64,
    ext: true,
  };
  const signKey = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);

  const header = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const nowSec = Math.floor(Date.now() / 1000);
  // RFC 8292 規定 exp 最多不能超過現在起 24 小時；這裡用 12 小時，留足夠緩衝但不貼近上限。
  const body = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify({ aud: audience, exp: nowSec + 12 * 3600, sub: subject }))
  );
  const signingInput = `${header}.${body}`;

  // Web Crypto 的 ECDSA 簽章輸出本來就是 JOSE/JWS 要求的 raw r‖s（P-256 為 64 bytes），
  // 不需要額外從 DER 格式轉換。
  const signatureBuf = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signKey, new TextEncoder().encode(signingInput));
  const signature = bytesToBase64Url(new Uint8Array(signatureBuf));

  return `${signingInput}.${signature}`;
}

// 對單一裝置訂閱發送一則 Web Push 通知，回傳原始 fetch Response 讓呼叫端自行
// 判斷狀態碼（404/410 代表訂閱已失效）。
async function sendWebPush(
  subscription: PushSubscriptionJson,
  vapidPublicKeyB64: string,
  vapidPrivateKeyB64: string,
  vapidSubject: string,
  payload: unknown
): Promise<Response> {
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const body = await encryptWebPushPayload(payloadBytes, subscription.keys);
  const audience = new URL(subscription.endpoint).origin;
  const jwt = await signVapidJwt(audience, vapidSubject, vapidPublicKeyB64, vapidPrivateKeyB64);

  return fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      // TTL：Push 服務在使用者裝置離線時願意保留訊息多久（秒）。行程提醒有時效性，
      // 1 小時作為「裝置短暫離線也還來得及收到」與「不要遞送過期太久的提醒」之間的折衷。
      TTL: '3600',
      Authorization: `vapid t=${jwt}, k=${vapidPublicKeyB64}`,
    },
    body: asBufferSource(body),
  });
}

// ---- 主流程 ----

Deno.serve(async (req: Request) => {
  try {
    const tz = Deno.env.get('TZ') || 'Asia/Taipei';
    const now = new Date();
    const todayKey = todayKeyInZone(tz, now);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 環境變數（理論上 Supabase 會自動注入）');
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:example@example.com';
    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('缺少 VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY，請先在 Dashboard 設定（見 CLOUD_PUSH_SETUP.md）');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: stateRows, error: stateError } = await supabase
      .from('sync_state')
      .select('user_id, payload');
    if (stateError) throw stateError;

    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const row of (stateRows ?? []) as SyncStateRow[]) {
      const userId = row.user_id;
      const tasks: TaskLike[] = Array.isArray(row.payload?.tasks) ? (row.payload!.tasks as TaskLike[]) : [];
      if (!tasks.length) continue;

      // 篩出這個使用者今天要發送提醒的行程。
      const dueTasks = tasks.filter((task) => isReminderDue(task, now, tz));
      if (!dueTasks.length) continue;

      // 這個使用者名下所有訂閱裝置，一次撈出來給底下每筆行程共用。
      const { data: subs, error: subsError } = await supabase
        .from('push_subscriptions')
        .select('endpoint, subscription')
        .eq('user_id', userId);
      if (subsError) {
        console.error('[send-reminders] 讀取訂閱清單失敗', userId, subsError);
        continue;
      }
      const subscriptions = (subs ?? []) as PushSubRow[];
      if (!subscriptions.length) continue;

      for (const task of dueTasks) {
        // 防重複：先嘗試佔位 insert，主鍵 (user_id, task_id, fire_date) 衝突就代表
        // 今天已經發送過（可能是排程間隔重疊掃到同一筆），直接跳過不重複發送。
        const { error: claimError } = await supabase
          .from('push_sent_log')
          .insert({ user_id: userId, task_id: task.id, fire_date: todayKey });
        if (claimError) {
          skippedCount += 1;
          continue;
        }

        const notificationPayload = {
          title: `行程提醒：${task.title || '（未命名行程）'}`,
          body: Number(task.reminder) > 0 ? `${task.reminder} 分鐘後開始｜${task.category || ''}` : `現在開始｜${task.category || ''}`,
          url: './',
        };

        let anySent = false;
        for (const sub of subscriptions) {
          try {
            const res = await sendWebPush(sub.subscription, vapidPublicKey, vapidPrivateKey, vapidSubject, notificationPayload);
            if (res.status === 404 || res.status === 410) {
              // 訂閱已過期或使用者已在瀏覽器端取消：清掉這筆過期訂閱，避免下次繼續白費力氣重試。
              await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
            } else if (!res.ok) {
              const bodyText = await res.text().catch(() => '');
              console.error('[send-reminders] 發送推播失敗', userId, task.id, sub.endpoint, res.status, bodyText);
            } else {
              anySent = true;
            }
          } catch (err) {
            console.error('[send-reminders] 發送推播例外', userId, task.id, sub.endpoint, err);
          }
        }

        if (anySent) {
          sentCount += 1;
        } else {
          failedCount += 1;
          // 全部訂閱都發送失敗（例如暫時性網路問題）：把剛剛佔位的紀錄刪掉，
          // 讓這筆提醒還在窗口內時，下次排程執行還能重試，不會因為佔位失敗就永遠發不出去。
          await supabase
            .from('push_sent_log')
            .delete()
            .eq('user_id', userId)
            .eq('task_id', task.id)
            .eq('fire_date', todayKey);
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, todayKey, sent: sentCount, skipped: skippedCount, failed: failedCount }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[send-reminders] 執行失敗', err);
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
