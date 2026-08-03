# 澳憶・千尋 / QwenPaw Heritage Trace

面向澳門老字號與街區文化的資料治理工作台。它把公開來源、訪談素材與實地記錄整理為可核驗、可授權、可持續更新的文化資產，並提供政府、商戶與旅客三種活化出口。

這個倉庫的預設入口是可直接給評委操作的六步比賽 Demo；另保留一個管理工作台和輕量服務端原型，作為後續能力展示。展示資料均為 Demo 資料，不能替代真實訪談、商戶授權或人工核驗。

## 目前能力

- 公開、免登入的六步評審流程：項目建立、初始診斷、補證資料、文化資產卡、G 端看板、G/B/C 活化輸出。
- 明確區分已實現的 Paw-Archivist / Paw-Verifier 核心，與為路演準備的互動原型。
- 管理端登入頁與伺服器端 Session Cookie，作為後續資料管理能力展示。
- SQLite 儲存專案、核驗項目、Session 與審計事件。
- CSRF 驗證、登入失敗限速、登入/登出/資料變更審計記錄。
- Paw-Archivist AI 建檔草稿：只使用已輸入的來源，回傳來源編號與證據摘錄；人工採納後仍是待核驗資料。
- 專案建立、文化資料歸檔、核驗狀態切換與 G/B/C 活化展示。
- Nginx 反向代理與 systemd 服務草稿。
- 響應式中文工作台介面。

## 產品流程

```text
資料來源 / 訪談 / 圖片
          |
          v
      資料歸檔
          |
          v
      人工核驗
          |
          v
  公開版本與 G / B / C 活化
```

管理端的角色規劃：

| 角色 | 預期工作 |
| --- | --- |
| `admin` | 帳戶、角色、站點與全部資料管理 |
| `archivist` | 項目建立、來源整理、文化建檔 |
| `verifier` | 核驗來源、設定公開/內部狀態 |
| `publisher` | 僅從已核驗資料建立對外內容 |
| `viewer` | 查看內部資料，不可變更 |

> 注意：目前資料庫已有 `role` 欄位，前端也會顯示角色；但所有寫入 API 的角色授權仍需在上線前補齊並測試。不能把前端隱藏按鈕當作權限控制。

## 專案結構

```text
.
├── index.html                  # 公開、免登入的比賽 Demo 入口
├── demo.js                     # 六步評審流程與硬編碼 Demo 資料
├── admin.html                  # 後續管理工作台入口
├── app.js                      # 管理端互動與 API 呼叫
├── styles.css                  # 視覺系統與響應式樣式
├── assets/
│   └── heritage-cover.jpeg     # Demo 主視覺
├── server/
│   └── app.py                  # Dependency-free Python API + SQLite
├── deploy/
│   ├── qwenpaw.service         # systemd service template
│   ├── qwenpaw.env.example     # 服務端環境變數範例
│   └── nginx-qwenpaw-demo.conf # Nginx reverse proxy template
└── 澳憶千尋QwenPawHeritageTrace.docx # 產品 proposal
```

## 本地開發

### 前置條件

- Python 3.11+，目前程式以 Python 標準函式庫實作。
- Node.js 僅用於前端語法檢查，不是執行時必要條件。
- 生產環境須使用 Nginx 或 Caddy，把靜態檔案與 `/api/` 代理到同一個 HTTPS origin。

### 建立初始密碼雜湊

後端不接受明文初始密碼。先在本機產生 scrypt 雜湊：

```powershell
python -c "from server.app import password_hash; import getpass; print(password_hash(getpass.getpass('Initial password: ')))"
```

將輸出內容設定為 `QWENPAW_INITIAL_PASSWORD_HASH`。不要把它提交到 Git、貼到截圖或放在前端 JavaScript。

### 啟動 API

以下示例使用工作區內的暫存資料庫；請自行將 `<scrypt-hash>` 替換為上一步輸出。

```powershell
$env:QWENPAW_DB_PATH = "$PWD\.data\qwenpaw.db"
$env:QWENPAW_HOST = "127.0.0.1"
$env:QWENPAW_PORT = "8000"
$env:QWENPAW_COOKIE_SECURE = "0"
$env:QWENPAW_INITIAL_USER = "admin"
$env:QWENPAW_INITIAL_PASSWORD_HASH = "<scrypt-hash>"
python server\app.py
```

在另一個終端檢查：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/api/health
```

公開評審 Demo 不需要 API 或登入，直接開啟 `index.html` 即可展示。`admin.html` 的 `app.js` 才會以同源 `/api/` 呼叫後端；本地完整測試管理端時，需要一個把 `/api/` 代理到 `127.0.0.1:8000` 的反向代理。生產環境使用 `deploy/nginx-qwenpaw-demo.conf` 作為起點。

## API 概覽

| Route | Method | Authentication | 用途 |
| --- | --- | --- | --- |
| `/api/health` | `GET` | 無 | 健康檢查 |
| `/api/session` | `GET` | 選用 | 讀取目前登入狀態與 CSRF token |
| `/api/login` | `POST` | 無 | 建立 Session，含 IP 限速 |
| `/api/logout` | `POST` | Session + CSRF | 結束 Session |
| `/api/projects` | `GET` / `POST` | Session；POST 需 CSRF | 專案列表與建立 |
| `/api/claims` | `GET` / `POST` | Session；POST 需 CSRF | 核驗項目查詢與建立 |
| `/api/claims/<id>` | `PATCH` | Session + CSRF | 更新核驗公開狀態 |
| `/api/projects/<id>/archive` | `POST` | Session + CSRF | 產生內部資產檔案 |
| `/api/ai/status` | `GET` | Session | 僅回傳模型是否已配置，不回傳 Key |
| `/api/projects/<id>/ai-drafts` | `POST` | Archivist/Admin + CSRF | 以現有來源產生短期 AI 建檔草稿 |
| `/api/projects/<id>/ai-drafts/<draft_id>/accept` | `POST` | Archivist/Admin + CSRF | 將選取草稿加入待核驗清單 |

服務端 Session 為不透明隨機 token，其雜湊才會存入資料庫。Cookie 必須使用 `HttpOnly`、`Secure` 和 `SameSite`；`Secure` 僅能在本地 HTTP 開發時暫時關閉。

## 生產部署

這個網站計畫部署於同時運行 Minecraft 的伺服器。比賽期間可先部署純靜態、免登入的 `index.html` + `demo.js`；管理端與 API 應在安全巡檢、TLS、帳戶與角色權限完成後再開放。部署前必須先完成唯讀巡檢，確認現有服務、RAM、磁碟、監聽端口、Linux 防火牆和雲端安全組。不得把網站安裝到 Minecraft 目錄、tmux session 或遊戲帳戶中。

建議目錄與服務分離：

```text
/srv/qwenpaw-demo/releases/<timestamp>/
/srv/qwenpaw-demo/current -> releases/<timestamp>/
/var/lib/qwenpaw/qwenpaw.db
/etc/qwenpaw/qwenpaw.env        # 0600, root-readable only
```

生產啟用前的必要條件：

1. 使用正式域名與有效 TLS 憑證。
2. `QWENPAW_COOKIE_SECURE=1`。
3. API 僅監聽 `127.0.0.1:8000`，不對外公開。
4. 反向代理僅公開 `80/443`；不得公開 `8000`、`5173` 或其他開發端口。
5. SSH 僅開放給管理者固定 IP；Minecraft 端口維持既有政策。
6. 比賽 Demo 的 `/` 可公開；`admin.html`、管理 API、上傳與審計路由使用 IP allowlist、VPN 或 identity-aware proxy 作為額外門檻。
7. 初始管理員透過受控 CLI/環境檔建立；沒有公開註冊與預設密碼。
8. 以新 release 目錄上傳與驗證，再切換 `current` 軟連結，保留上一版以便回滾。

### AI 模型設定

AI Key 只可寫在伺服器的 `/etc/qwenpaw/qwenpaw.env`，檔案權限為 `0600`；不可放進 `.env.example`、前端、資料庫欄位或 Git。現時服務端採用 OpenAI-compatible `/chat/completions` 介面，QwenPaw 文件列出的中國阿里雲 Coding Plan base URL 是 `https://coding.dashscope.aliyuncs.com/v1`。模型名稱需以該 Key 的 `/models` 回應為準。

草稿流程固定為：已有來源 → LLM 結構化草稿 → 人工選擇採納 → `pending` 核驗項目 → Verifier 決定是否可公開。模型錯誤、無來源、非 JSON 回應或沒有來源編號時，都不會寫入資料庫。

`deploy/nginx-qwenpaw-demo.conf` 目前是反向代理草稿，仍需改為正式域名與 HTTPS server block 後才能上線。配置中的 CDN CSP 例外也應在發布前移除，改用本地字型和圖標資產。

## 安全原則

- 不要把訪談原稿、個人資料、未授權照片、私鑰、密碼、Session token 或 API token 放入前端、Git 或部署壓縮包。
- 公開站與管理端分離。公開站只能展示核驗且授權的內容。
- 管理端不開放自助註冊；採用強密碼、MFA、登入限速與伺服器端 RBAC。
- 每次登入、資料建立、核驗狀態變更、發布與帳戶管理都必須有審計記錄。
- 真實檔案上傳需採用 MIME/signature 驗證、檔名重寫、大小限制、隔離儲存與惡意檔掃描；目前 Demo 尚未提供上傳端點。
- 不要用前端路由、localStorage 或 CSS 隱藏來實作安全控制。

更完整的共享伺服器與管理登入規範位於 `C:\Users\bankey\Desktop\file\cloud\readme.md`。

## 驗證

```powershell
node --check app.js
python -m py_compile server\app.py
```

對 API 進行變更後，至少測試：未登入拒絕、CSRF 拒絕、登入限速、角色拒絕、Session 到期、登出失效，以及審計日誌寫入。
