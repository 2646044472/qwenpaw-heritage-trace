# 澳憶・千尋 / QwenPaw Heritage Trace

面向澳門老字號與街區文化的資料治理工作台。它把公開來源、訪談素材與實地記錄整理為可核驗、可授權、可持續更新的文化資產，並提供政府、商戶與旅客三種活化出口。

這個倉庫的預設入口是可直接給評委操作的六步比賽 Demo；另保留一個管理工作台和輕量服務端原型，作為後續能力展示。展示資料均為 Demo 資料，不能替代真實訪談、商戶授權或人工核驗。

## 目前能力

- 公開、免登入的六步評審流程：項目建立、初始診斷、補證資料、文化資產卡、G 端看板、G/B/C 活化輸出。
- G 端看板使用 Leaflet 與 OpenStreetMap 的真實可縮放地理底圖；目前三個標記為比賽演示點位，真實上線前需逐一取得商戶同意並核驗座標。
- 明確區分已實現的 Paw-Archivist / Paw-Verifier 核心，與為路演準備的互動原型。
- 管理端登入頁與伺服器端 Session Cookie，作為後續資料管理能力展示。
- 管理端提供五步操作路徑：來源整理、Qwen/Paw-Archivist 候選建檔、Paw-Verifier 人工核驗、街區互動地圖與 G/B/C 成品；未配置模型時可運行不寫入模型的引導草稿。
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

## 使用路徑

公開首頁是給評委與首次使用者的引導工作區，不需要登入即可完成一次不寫入伺服器的體驗：

1. 在「項目建立」選擇老店個案。
2. 在「初始診斷」確認現有資料與要補問的問題。
3. 在「補證資料」加入示範素材；所有新內容先停留在待核驗狀態。
4. 在「Qwen 建檔與人工核驗」生成帶來源編號的引導草稿，採納後送往 Verifier。
5. 在 G 端看板查看街區優先級，再預覽 G / B / C 對外成品。

公開引導模式不會把訪客輸入傳給模型，也不會寫入資料庫。當 Qwen 模型已由伺服器管理員正確配置後，管理端會顯示即時模型模式；真正的模型草稿只能在已登入的管理端生成、審計並採納。

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
├── frontend/                   # 與後端同機運行的瀏覽器介面
│   ├── index.html              # 公開、免登入的比賽 Demo 入口
│   ├── admin.html              # 管理工作台入口
│   ├── app.js / demo.js         # 管理端與公開 Demo 互動
│   ├── runtime-config.js        # 瀏覽器 API base；預設同源 /api
│   ├── styles.css / guide.html  # 視覺系統與公開操作流程頁
│   ├── assets/                  # 審核後的靜態素材
│   └── vendor/                  # 打包的 Leaflet，避免外部 CDN 依賴
├── backend/                    # 同機 Python 後端與本機協作環境
│   ├── server/app.py           # Dependency-free Python API + SQLite
│   ├── server/test_app.py       # Workflow contract tests
│   ├── Dockerfile / compose.yaml
│   └── .env.example            # 不含任何實際憑據的本機設定範例
├── deploy/
│   ├── qwenpaw.service         # systemd service template
│   ├── qwenpaw.env.example     # 服務端環境變數範例
│   └── nginx-all-in-one.conf.example # 同機前端與後端的 Nginx 範例
├── contracts/
│   ├── frontend-result.v1.schema.json # 前後端穩定資料契約
│   ├── frontend-result.v1.mock.json   # 前端 / 後端聯調樣本
│   └── README.md                       # 前後端共同資料契約
└── 澳憶千尋QwenPawHeritageTrace.docx # 產品 proposal
```

## 本地開發

### 前置條件

- Python 3.11+，目前程式以 Python 標準函式庫實作。
- Node.js 僅用於前端語法檢查，不是執行時必要條件。
- 前端與後端在同一台電腦運行；瀏覽器只請求同源 `/api/`。可直接由 Python 提供靜態檔，或選用本機 Nginx。

### GitHub 同步

GitHub 只同步版本化程式碼與文件。每台開發電腦都各自保存 `backend/.env`、`backend/.data/` 和任何模型憑據，這些檔案不進 Git。

```powershell
git pull --ff-only origin main
# 修改、測試後
git add frontend backend contracts deploy README.md AGENT.md
git commit -m "Describe the change"
git push origin main
```

### 建立初始密碼雜湊

後端不接受明文初始密碼。先在本機產生 scrypt 雜湊：

```powershell
python -c "from backend.server.app import password_hash; import getpass; print(password_hash(getpass.getpass('Initial password: ')))"
```

將輸出內容設定為 `QWENPAW_INITIAL_PASSWORD_HASH`。不要把它提交到 Git、貼到截圖或放在前端 JavaScript。

### 啟動 API

以下示例使用工作區內的暫存資料庫；請自行將 `<scrypt-hash>` 替換為上一步輸出。

```powershell
$env:QWENPAW_DB_PATH = "$PWD\backend\.data\qwenpaw.db"
$env:QWENPAW_HOST = "127.0.0.1"
$env:QWENPAW_PORT = "8000"
$env:QWENPAW_COOKIE_SECURE = "0"
$env:QWENPAW_INITIAL_USER = "admin"
$env:QWENPAW_INITIAL_PASSWORD_HASH = "<scrypt-hash>"
# 僅本機測試管理端時啟用；生產環境保持 0。
$env:QWENPAW_SERVE_STATIC = "1"
python backend\server\app.py
```

在另一個終端檢查：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/api/health
```

公開評審 Demo 不需要 API 或登入，直接開啟 `frontend/index.html` 即可展示。設定 `QWENPAW_SERVE_STATIC=1` 後，可在本機以 `http://127.0.0.1:8000/admin.html` 同源測試管理端；後端會從 `frontend/` 讀取白名單靜態資源。若需要 Nginx，使用 `deploy/nginx-all-in-one.conf.example`，它把同機的 `/api/` 代理到 `127.0.0.1:8000`。

### 同學電腦與 Docker

跨平台開發不依賴 Windows 路徑或本機已安裝的 QwenPaw Desktop。已安裝 Docker Desktop 的 Windows/macOS 電腦，以及 Ubuntu/Debian，都可用相同容器啟動：

1. 複製 `backend/.env.example` 為本機 `backend/.env`，只在該檔填入使用者自己產生的 `QWENPAW_INITIAL_PASSWORD_HASH`。
2. 執行 `docker compose -f backend/compose.yaml up --build`。
3. 開啟 `http://127.0.0.1:8000/admin.html`，容器資料保存在具名 volume，不會進 Git。

Compose 的端口只綁定 `127.0.0.1`，方便本機協作測試；它不是雲端公開部署設定。沒有 Docker 時，Windows PowerShell 使用上一節命令；Linux/macOS 將相同變數以 `export QWENPAW_DB_PATH="$PWD/backend/.data/qwenpaw.db"` 等方式設定後執行 `python3 backend/server/app.py`。未設定 `QWENPAW_DB_PATH` 時，後端會使用 `backend/.data/qwenpaw.db`，因此全新 clone 不會嘗試寫入 `/var/lib`。

QwenPaw Desktop 是每位使用者自己的 Agent 工具。若要在 Desktop 內使用 Coding Plan，請在它的「Settings → Models」選擇 `Aliyun Coding Plan (China)`、完成測試連線並選擇模型；這個個人設定不會也不應被 Docker、Git 或專案 `.env` 讀取。

### Workflow Contract

管理端只消費 Coordinator 產生的 `frontend_result`。Archivist 的候選資料使用 `extraction_status: extracted|unknown`，不宣告核驗成功；Verifier 的最終狀態只允許 `supported`、`partially_supported`、`unsupported`、`unverifiable`，來源衝突、時間脈絡、引文與授權問題則放在 `risk_flags`。`source_ids` 是候選引用，`source_ids_checked` 是本次核對集合，`valid_source_ids` 與 `invalid_source_ids` 必須互斥且完整覆蓋核對集合；`citation_status`、核驗狀態與最終 `reason` 不得互相矛盾，也不得保留自我修正過程。

Coordinator 會驗證 claim/source ID、枚舉一致性、必要 workflow/asset-card 區段、issue 引用與 claim 數量，並根據 claims 確定性計算 summary 與 review queue。資料不完整時會重試一次；仍失敗則記錄 `completed_with_errors`，不會標為完成。發布 API 同樣使用此 contract 的 `publication.safe_to_publish` 作為服務端闸门。

Schema 與可直接用於聯調的樣本位於 `contracts/`。前端只讀取 `GET /api/projects/<id>/frontend-result` 回應中的 `frontend_result` 欄位，不能從原始 Agent 文字、聊天紀錄或前端自行統計來推導核驗或發布狀態。

## API 概覽

| Route | Method | Authentication | 用途 |
| --- | --- | --- | --- |
| `/api/health` | `GET` | 無 | 健康檢查 |
| `/api/session` | `GET` | 選用 | 讀取目前登入狀態與 CSRF token |
| `/api/login` | `POST` | 無 | 建立 Session，含 IP 限速 |
| `/api/logout` | `POST` | Session + CSRF | 結束 Session |
| `/api/projects` | `GET` / `POST` | Session；POST 需 CSRF | 專案列表與建立 |
| `/api/claims` | `GET` / `POST` | Session；POST 需 CSRF | 核驗項目查詢與建立 |
| `/api/claims/<id>` | `PATCH` | Verifier/Admin + CSRF | 寫入最終核驗結論、來源、風險與公開邊界 |
| `/api/projects/<id>/archive` | `POST` | Session + CSRF | 產生內部資產檔案 |
| `/api/ai/status` | `GET` | Session | 僅回傳模型是否已配置，不回傳 Key |
| `/api/projects/<id>/ai-drafts` | `POST` | Archivist/Admin + CSRF | 以現有來源產生短期 AI 建檔草稿 |
| `/api/projects/<id>/ai-drafts/<draft_id>/accept` | `POST` | Archivist/Admin + CSRF | 將選取草稿加入待核驗清單 |
| `/api/projects/<id>/workflow` | `POST` | Archivist/Verifier/Admin + CSRF | 驗證下游輸出並產生 stable contract |
| `/api/projects/<id>/frontend-result` | `GET` | Session | 讀取最後一次 `frontend_result` |

服務端 Session 為不透明隨機 token，其雜湊才會存入資料庫。Cookie 必須使用 `HttpOnly`、`Secure` 和 `SameSite`；`Secure` 僅能在本地 HTTP 開發時暫時關閉。

## 單機運行

目前不部署雲伺服器。GitHub 用於同步程式碼；前端、API、SQLite、Session、審計與可選 Qwen-Paw/LLM 適配器都在同一台電腦上運行。

```text
Browser -> frontend/ + /api -> local Python API -> local SQLite + optional server-side LLM
```

`frontend/runtime-config.js` 固定使用 `apiBase: '/api'`。使用 `QWENPAW_SERVE_STATIC=1` 時，Python 後端直接提供前端；使用 Nginx 時，採用 [deploy/nginx-all-in-one.conf.example](deploy/nginx-all-in-one.conf.example)。完整資料契約見 [contracts/README.md](contracts/README.md)。

若在自己的 Linux 電腦以 systemd 運行，建議目錄與服務分離：

```text
/srv/qwenpaw/releases/<timestamp>/
/srv/qwenpaw/app -> releases/<timestamp>/
/var/lib/qwenpaw/qwenpaw.db
/etc/qwenpaw/qwenpaw.env        # 0600, root-readable only
```

本機運行的必要條件：

1. API 預設只監聽 `127.0.0.1:8000`，不對 LAN 或網際網路公開。
2. 本機 HTTP 開發設定 `QWENPAW_COOKIE_SECURE=0`；若日後自行公開網站，才必須改為 HTTPS 與 `1`。
3. 初始管理員只透過本機環境檔建立；沒有公開註冊與預設密碼。
4. 以 GitHub commit 作為協作與回滾單位；不要同步 `.env`、資料庫、日誌或任何 token。

### AI 模型設定

AI Key 只可寫在本機 `backend/.env` 或本機受限環境變數；不可放進 `.env.example`、前端、資料庫欄位或 Git。服務端採用 OpenAI-compatible `/chat/completions` 介面，應使用允許後端服務的 Model Studio 或相容供應商憑據；Coding Plan 專用 Key 僅供互動式編程工具使用，不得作為本服務的部署後端憑據。中國大陸 Model Studio 相容端點可使用 `https://dashscope.aliyuncs.com/compatible-mode/v1`，模型名稱需以該服務帳戶的 `/models` 回應為準。

草稿流程固定為：已有來源 → LLM 結構化草稿 → 人工選擇採納 → `pending` 核驗項目 → Verifier 決定是否可公開。模型錯誤、無來源、非 JSON 回應或沒有來源編號時，都不會寫入資料庫。

`deploy/nginx-all-in-one.conf.example` 是同機 Nginx 範例；一般本機開發不必啟用它。它不依賴外部字型 CDN；地圖瓦片仍需網路存取，正式發布應評估合規的瓦片供應商與使用限制。

## 安全原則

- 不要把訪談原稿、個人資料、未授權照片、私鑰、密碼、Session token 或 API token 放入前端、Git 或部署壓縮包。
- 公開站與管理端分離。公開站只能展示核驗且授權的內容。
- 管理端不開放自助註冊；採用強密碼、MFA、登入限速與伺服器端 RBAC。
- 每次登入、資料建立、核驗狀態變更、發布與帳戶管理都必須有審計記錄。
- 真實檔案上傳需採用 MIME/signature 驗證、檔名重寫、大小限制、隔離儲存與惡意檔掃描；目前 Demo 尚未提供上傳端點。
- 不要用前端路由、localStorage 或 CSS 隱藏來實作安全控制。

## 驗證

```powershell
node --check frontend\app.js
node --check frontend\demo.js
python -m py_compile backend\server\app.py
python -m unittest -v backend\server\test_app.py
git diff --check
```

對 API 進行變更後，至少測試：未登入拒絕、CSRF 拒絕、登入限速、角色拒絕、Session 到期、登出失效，以及審計日誌寫入。
