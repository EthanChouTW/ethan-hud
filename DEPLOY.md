# Ethan HUD -- Even G2 部署指南

## 前置條件

- Node.js 22+
- Even Hub app (手機)已加入 Beta group
- aggregator `.env` 已設定 `NOTION_TOKEN`
- (選用) Google Calendar：已執行 ADC 登入（見下方 Calendar 設定）

## 步驟

### 0. Google Calendar 設定（首次）

Calendar collector 使用 Application Default Credentials (ADC)，不需要額外的 API key。
只需跑一次：

```bash
gcloud auth application-default login --scopes=https://www.googleapis.com/auth/calendar.readonly
```

瀏覽器會跳出 Google 登入，授權後憑證自動存在 `~/.config/gcloud/application_default_credentials.json`。

`.env` 加上（預設已開啟，設 `false` 可關閉）：

```
CALENDAR_ENABLED=true
```

如果不需要日曆功能，設 `CALENDAR_ENABLED=false` 或不執行上面的 gcloud 指令即可，aggregator 會自動跳過。

### 1. 啟動 aggregator

```bash
cd ~/ethan-hud/aggregator
npm run dev
```

WebSocket server 會跑在 `ws://localhost:9500`。

### 2. 啟動前端 dev server

另開 terminal:

```bash
cd ~/ethan-hud
npm run dev
```

Vite 會 listen 在 `0.0.0.0:5173`（LAN 可存取）。

### 3. QR sideload 到眼鏡測試

```bash
npm run qr
```

手機掃 QR code，Even Hub app 會載入 dev server 的頁面到 G2。
確認 WebSocket 連線正常、各 card 有資料。

### 4. 打包

```bash
npm run pack
```

會先 `npm run build` 再打包，產出 `ethan-hud.ehpk`（約 93 KB）在專案根目錄。

打包版跟 QR sideload 版有個關鍵差異：packed app 從本機 bundle 載入，
沒辦法從自己的網址推導出 Mac 在哪，所以 aggregator 位址必須在 build 時
寫死。這個值在 `.env.production` 的 `VITE_WS_URL`，目前指向 Tailscale IP。

Tailscale IP 變動時要更新：

```bash
tailscale ip -4    # 確認目前位址
# 更新 .env.production 的 VITE_WS_URL，再重新 npm run pack
```

### 5. 上傳到 Even Hub Portal

Portal 在 <https://hub.evenrealities.com>（CLI 也用這個 base URL）。
上傳 `ethan-hud.ehpk` 後發布到 Beta group — Beta 是自用範圍，不需人工審核。

CLI 有 `evenhub login`，但沒有 upload/publish 指令，發布走網頁介面。
