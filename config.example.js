// ============================================================================
// config.example.js — 雲端同步設定「範例」檔
// ----------------------------------------------------------------------------
// 這個檔案本身不會被 index.html 載入，只是範例／備份。
// 真正生效的設定檔是同資料夾的 config.js，請照下面步驟操作：
//
//   1. 到 https://supabase.com 免費建立一個專案。
//   2. 在 Supabase 專案的 SQL Editor 執行本專案的 schema.sql，建立 sync_state 表與 RLS 規則。
//   3. Authentication → Providers 開啟 Google，並設定 Authentication → URL Configuration
//      的 Redirect URLs（完整步驟見 CLOUD_SETUP.md）。
//   4. Project Settings → API，複製「Project URL」與「anon public」金鑰，
//      貼到下面兩個欄位，然後把整段內容複製貼到 config.js（覆蓋 config.js 裡的空值）。
//   5. 存檔後用瀏覽器重新整理 index.html，工具列會出現「☁️ 雲端同步」按鈕可用。
//
// 注意：anon public 金鑰依 Supabase 設計本來就可以公開內嵌在前端程式碼中，
// 資料安全是靠 schema.sql 內的 RLS（Row Level Security）規則保護——
// 只有登入本人才能讀寫自己帳號那一列資料。絕對不要把 service_role 金鑰
// 放進這個純前端專案。
// ============================================================================

window.CALENDAR_SYNC_CONFIG = {
  supabaseUrl: '', // 例如 'https://xxxxxxxxxxxx.supabase.co'
  supabaseAnonKey: '', // 例如 'eyJhbGciOi...'（anon / public 金鑰）
};
