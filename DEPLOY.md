# Ethan HUD -- Even G2 部署指南

## 前置條件

- Node.js 22+
- Even Hub app (手機)已加入 Beta group
- aggregator `.env` 已設定 `NOTION_TOKEN`

## 步驟

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
npm run build
npm run pack
```

產出 `.evenhub` 檔案在專案根目錄。

### 5. 上傳到 Even Hub Portal

1. 登入 [Even Hub Developer Portal](https://developer.evenrealities.com)
2. 上傳 `.evenhub` 檔案
3. 發布到 Beta group
4. 手機 Even Hub app 更新後即可使用
