# Aggregator + Notion Collector 設計

## 目標

在 `aggregator/` 建立 WebSocket server + Notion collector，讓 HUD 的 Tasks 卡片能顯示今日 Notion 任務。

## 架構

```
Notion API ──(poll 60s)──> [aggregator/src/collectors/notion.ts]
                                      │
                                      ▼
                           [aggregator/src/server.ts]
                              WebSocket :9500
                                      │
                                      ▼
                           [src/App.tsx → TasksCard]
```

## Aggregator 核心

- **Runtime**: Node.js + TypeScript（與前端共用 tsconfig 風格）
- **WebSocket**: `ws` library, port 9500
- **Collector pattern**: 每個 collector export `start(broadcast)` + `stop()`
  - `broadcast(msg: AggregatorMessage)` 由 server 注入
  - collector 自行管理輪詢 interval
- **Config**: `.env` file（`NOTION_TOKEN`, `NOTION_DATABASE_ID`）

## Notion Collector 規格

- **API**: `POST https://api.notion.com/v1/databases/{db_id}/query`
- **Database ID**: `7f0a07d9d5544e818d32ea59356bbb2c`
- **Filter**: Assignee = Ethan (`a3ab0f13-21dc-4f04-8f9b-061b61edeede`), Status != Done
- **Sort**: 期限 ascending
- **Poll interval**: 60 seconds
- **Output**: `AggregatorMessage { type: 'tasks', data: TasksData }`

## TasksData 型別調整

```typescript
export interface TaskItem {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  done: boolean;
  deadline?: string;    // 新增：期限
  status?: string;      // 新增：Notion status 原文
  tags?: string[];      // 新增：Eng tags
}
```

## 前端 TasksCard 調整

- 顯示 deadline（若有）
- status 用不同亮度表示（In Progress > 亮, Not Started > 暗）
- 最多顯示 4 筆（G2 viewport 限制）

## 檔案清單

```
aggregator/
├── package.json
├── tsconfig.json
├── .env.example        # NOTION_TOKEN=ntn_xxx / NOTION_DATABASE_ID=7f0a...
├── src/
│   ├── server.ts       # WebSocket server + collector 載入
│   ├── config.ts       # dotenv + 型別化 config
│   ├── collectors/
│   │   ├── types.ts    # Collector interface
│   │   └── notion.ts   # Notion API polling
│   └── types.ts        # re-export from ../../src/types/dashboard
```

## 不做的事

- 不做 Notion OAuth（用 internal integration token）
- 不做寫回 Notion（只讀）
- 不做其他 collector（後續再加）
