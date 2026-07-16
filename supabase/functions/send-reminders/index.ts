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
// 完整部署步驟（安裝 CLI、設定 secrets、設定 Cron）見 CLOUD_PUSH_SETUP.md。
//
// 環境變數：
//   - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY：Supabase 對 Edge Function
//     自動注入，不需要自己設定。
//   - TZ：計算「今天」與提醒時刻用的時區，預設 'Asia/Taipei'（可用
//     supabase secrets set TZ=... 覆蓋，一般不需要改）。
//   - VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT：Web Push 用的
//     VAPID 金鑰組，需要自己用 supabase secrets set 設定
//     （VAPID_PUBLIC_KEY 要跟 config.js 的 webPushPublicKey 是同一把公鑰）。
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

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

interface PushSubRow {
  endpoint: string;
  subscription: Record<string, unknown>;
}

// ---- occursOnDate()：簡化移植自 app.js，只用 date-only（YYYY-MM-DD）字串比較 ----
// 刻意全部用 UTC 建構 Date 物件：這裡的「日期」只是行事曆上的一天（不含時區意義），
// 用 UTC 存純粹是為了避開伺服器所在時區造成的加減日誤差，跟實際提醒時刻的時區換算
// （zonedTimeToUtc）是分開兩件事。

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

// ---- 主流程 ----

Deno.serve(async (req: Request) => {
  try {
    const tz = Deno.env.get('TZ') || 'Asia/Taipei';
    const now = new Date();
    const todayKey = todayKeyInZone(tz, now);
    // 提醒時刻（開始時間減提醒分鐘數）落在「現在～現在+15分鐘」內就視為這次要發送。
    // 15 分鐘的窗口搭配建議的 10 分鐘排程間隔，留一點緩衝避免排程延遲漏掉；
    // 真正防止重複通知靠的是 push_sent_log，不是靠這個窗口大小。
    const windowEnd = new Date(now.getTime() + 15 * 60 * 1000);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 環境變數（理論上 Supabase 會自動注入）');
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:example@example.com';
    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('缺少 VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY，請先用 supabase secrets set 設定（見 CLOUD_PUSH_SETUP.md）');
    }
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

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
      const dueTasks = tasks.filter((task) => {
        if (!task.id || !task.start) return false;
        if (task.reminder === undefined || task.reminder === null || Number(task.reminder) < 0) return false;
        if (Array.isArray(task.completedDates) && task.completedDates.includes(todayKey)) return false;
        if (!occursOnDate(task, todayKey)) return false;

        const startAtUtc = zonedTimeToUtc(todayKey, task.start, tz);
        const remindAtUtc = new Date(startAtUtc.getTime() - Number(task.reminder || 0) * 60000);
        return remindAtUtc >= now && remindAtUtc <= windowEnd;
      });
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

        const notificationPayload = JSON.stringify({
          title: `行程提醒：${task.title || '（未命名行程）'}`,
          body: Number(task.reminder) > 0 ? `${task.reminder} 分鐘後開始｜${task.category || ''}` : `現在開始｜${task.category || ''}`,
          url: './',
        });

        let anySent = false;
        for (const sub of subscriptions) {
          try {
            await webpush.sendNotification(sub.subscription as never, notificationPayload);
            anySent = true;
          } catch (err) {
            const statusCode = (err as { statusCode?: number })?.statusCode;
            if (statusCode === 404 || statusCode === 410) {
              // 訂閱已過期或使用者已在瀏覽器端取消：清掉這筆過期訂閱，避免下次繼續白費力氣重試。
              await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
            } else {
              console.error('[send-reminders] 發送推播失敗', userId, task.id, sub.endpoint, err);
            }
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
