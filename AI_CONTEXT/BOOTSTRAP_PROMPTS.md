# 開機提示詞（Bootstrap Prompts）

開新 session 時貼進去的第一則訊息，讓 Claude Code / Codex 把交接鏈讀完再動工。
兩份內容刻意一致，只差引用的規則檔名，確保兩個 CLI 拿到同一份認知。

工作目錄一律 `d:\計畫表`。

---

## Claude Code

Claude Code 會自動載入 `CLAUDE.md`，這則的作用是強制它把整條交接鏈讀完並回報。

```text
先不要動任何檔案。依序讀完以下再回報：

1. CLAUDE.md（紅線與「存檔／推送／存新版」觸發短語）
2. AI_CONTEXT/GENERATIONS.md（001/002 世代完整架構、目前現況、未來規劃）
3. AI_CONTEXT/PROJECT_BRIEF.md（事實清單：路徑、部署、Supabase、localStorage keys）
4. AI_CONTEXT/NOTES.md（踩坑鐵則，全部都要看）
5. AI_CONTEXT/RECENT_CHANGES.md（最近三筆即可）
6. ROADMAP.md（只看「第五波」與其後段落）

讀完用繁體中文回報這五項，每項兩三句，不要貼原文：
- 這是什麼專案、技術棧、正式站與部署方式
- 目前程式架構（哪幾個檔、各自負責什麼、載入順序為何重要）
- 已完工到哪、最近一次改動是什麼
- 有哪些紅線我一定會踩到（挑最關鍵的五條）
- 下一步預計要做什麼

回報完停下來等我指示，不要主動開始施工。

另外三件事先記住：
- 我說「存檔」＝更新交接檔＋commit，不 push 不部署；「推送」才 push；「存新版」是建世代快照且會 push。定義以 CLAUDE.md 為準。
- 你沒有對外網路，git push 一律由我在本機執行，你只要給我命令列。
- 已推送的 commit 絕不 amend、絕不 force push，要改就疊新 commit。
```

---

## Codex

Codex 讀 `AGENTS.md`（與 `CLAUDE.md` 同步維護，紅線一致）。

```text
先不要動任何檔案。依序讀完以下再回報：

1. AGENTS.md（紅線與「存檔／推送／存新版」觸發短語）
2. AI_CONTEXT/GENERATIONS.md（001/002 世代完整架構、目前現況、未來規劃）
3. AI_CONTEXT/PROJECT_BRIEF.md（事實清單：路徑、部署、Supabase、localStorage keys）
4. AI_CONTEXT/NOTES.md（踩坑鐵則，全部都要看）
5. AI_CONTEXT/RECENT_CHANGES.md（最近三筆即可）
6. ROADMAP.md（只看「第五波」與其後段落）

讀完用繁體中文回報這五項，每項兩三句，不要貼原文：
- 這是什麼專案、技術棧、正式站與部署方式
- 目前程式架構（哪幾個檔、各自負責什麼、載入順序為何重要）
- 已完工到哪、最近一次改動是什麼
- 有哪些紅線我一定會踩到（挑最關鍵的五條）
- 下一步預計要做什麼

回報完停下來等我指示，不要主動開始施工。

另外三件事先記住：
- 我說「存檔」＝更新交接檔＋commit，不 push 不部署；「推送」才 push；「存新版」是建世代快照且會 push。定義以 AGENTS.md 為準。
- git push 一律由我在本機執行，你只要給我命令列。
- 已推送的 commit 絕不 amend、絕不 force push，要改就疊新 commit。
```

---

## 維護說明

- 這兩份**必須保持一致**（除了規則檔名與最後一條的引用來源）。改動任一份時另一份同步改。
- 交接檔清單若有增減（例如未來新增 `AI_CONTEXT/PROJECT_MAP.md`），兩份的編號清單都要更新。
