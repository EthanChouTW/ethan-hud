import type { Collector } from './types.js';
import type { AggregatorMessage, TaskDetail, TaskItem, TasksData } from '../types.js';
import { config } from '../config.js';

const POLL_INTERVAL_MS = 60_000;
const RANGE_DAYS_BEFORE = 2;
const RANGE_DAYS_AFTER = 2;

const STATUS_PROGRESSION: Record<string, string> = {
  '未開始': '進行中',
  '進行中': '完成',
};

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function createNotionCollector(): Collector {
  let timer: ReturnType<typeof setInterval> | undefined;
  let lastPayloadJson = '';

  async function fetchTasks(): Promise<TasksData> {
    const url = `https://api.notion.com/v1/databases/${config.notionDatabaseId}/query`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.notionToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: {
          or: [
            {
              and: [
                { property: '狀態', status: { does_not_equal: '完成' } },
                { property: '狀態', status: { does_not_equal: '取消' } },
                { property: '完成日', date: { on_or_after: dateOffset(-RANGE_DAYS_BEFORE) } },
                { property: '完成日', date: { on_or_before: dateOffset(RANGE_DAYS_AFTER) } },
              ],
            },
            {
              and: [
                { property: '狀態', status: { does_not_equal: '完成' } },
                { property: '狀態', status: { does_not_equal: '取消' } },
                { property: '日期', date: { on_or_after: dateOffset(-RANGE_DAYS_BEFORE) } },
                { property: '日期', date: { on_or_before: dateOffset(RANGE_DAYS_AFTER) } },
              ],
            },
          ],
        },
        sorts: [{ property: '日期', direction: 'ascending' }],
        page_size: 10,
      }),
    });

    if (!response.ok) {
      throw new Error(`Notion API error: ${response.status} ${response.statusText}`);
    }

    const body = await response.json() as NotionQueryResponse;
    const items = parseResults(body.results);

    const today = new Date().toISOString().slice(0, 10);
    const todayItems = items.filter((t) => t.deadline?.startsWith(today) || !t.deadline);
    const completedToday = todayItems.filter((t) => t.done).length;

    return {
      items,
      completedToday,
      totalToday: todayItems.length,
    };
  }

  function getDayLabel(dateStr: string | undefined): string | undefined {
    if (!dateStr) return undefined;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr.slice(0, 10) + 'T00:00:00');
    const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
    const labels: Record<number, string> = { [-2]: '前天', [-1]: '昨天', 0: '今天', 1: '明天', 2: '後天' };
    return labels[diff];
  }

  function parseResults(results: NotionPage[]): TaskItem[] {
    return results.map((page) => {
      const props = page.properties;

      const titleProp = props['名稱'] ?? props['Name'] ?? props['title'];
      const title = extractTitle(titleProp);

      const statusProp = props['狀態'];
      const status = statusProp?.status?.name ?? undefined;
      const done = status === '完成';

      const completionDate = props['完成日']?.date?.start?.slice(0, 10);
      const generalDate = props['日期']?.date?.start?.slice(0, 10);
      const deadline = completionDate ?? generalDate ?? undefined;
      const dayLabel = getDayLabel(deadline);
      const isOverdue = deadline !== undefined && deadline < dateOffset(0) && !done;

      return {
        id: page.id,
        title,
        priority: isOverdue ? 'high' as const : 'medium' as const,
        done,
        deadline,
        status,
        dayLabel,
      };
    });
  }

  function extractTitle(prop: NotionProperty | undefined): string {
    if (!prop) return '(untitled)';
    if (prop.type === 'title' && Array.isArray(prop.title)) {
      return prop.title.map((t: { plain_text: string }) => t.plain_text).join('') || '(untitled)';
    }
    return '(untitled)';
  }

  /**
   * Read a page's body as plain text.
   *
   * Only the block types that actually carry prose are unwrapped; anything
   * else (dividers, embeds, child databases) has no useful single-line text
   * form on a 576x288 display and is skipped rather than rendered as noise.
   */
  async function fetchTaskContent(pageId: string): Promise<string[]> {
    const url = `https://api.notion.com/v1/blocks/${pageId}/children?page_size=50`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${config.notionToken}`,
        'Notion-Version': '2022-06-28',
      },
    });

    if (!response.ok) {
      throw new Error(`Notion blocks error: ${response.status} ${response.statusText}`);
    }

    const body = await response.json() as { results: NotionBlock[] };
    const lines: string[] = [];

    for (const block of body.results) {
      const text = extractBlockText(block);
      if (text) lines.push(text);
    }

    return lines;
  }

  function extractBlockText(block: NotionBlock): string | undefined {
    const type = block.type;
    const payload = block[type] as { rich_text?: RichText[]; checked?: boolean } | undefined;
    const rich = payload?.rich_text;
    if (!rich || rich.length === 0) return undefined;

    const text = rich.map((r) => r.plain_text).join('').trim();
    if (!text) return undefined;

    switch (type) {
      case 'to_do':
        return `[${payload?.checked ? 'x' : ' '}] ${text}`;
      case 'bulleted_list_item':
      case 'numbered_list_item':
        return `- ${text}`;
      case 'heading_1':
      case 'heading_2':
      case 'heading_3':
        return `# ${text}`;
      case 'quote':
        return `> ${text}`;
      case 'paragraph':
      case 'code':
      case 'callout':
      case 'toggle':
        return text;
      default:
        return undefined;
    }
  }

  async function updateTaskStatus(pageId: string, newStatus: string): Promise<void> {
    const url = `https://api.notion.com/v1/pages/${pageId}`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${config.notionToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          '狀態': { status: { name: newStatus } },
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`Notion update error: ${response.status} ${response.statusText}`);
    }
  }

  let broadcastFn: ((msg: AggregatorMessage) => void) | undefined;

  const forcePoll = async () => {
    if (!broadcastFn) return;
    try {
      const data = await fetchTasks();
      lastPayloadJson = JSON.stringify(data);
      broadcastFn({ type: 'tasks', data, timestamp: Date.now() });
      console.log(`[notion] force-broadcast ${data.items.length} tasks`);
    } catch (err) {
      console.error('[notion] force-poll error:', err instanceof Error ? err.message : err);
    }
  };

  return {
    name: 'notion',

    start(broadcast: (msg: AggregatorMessage) => void) {
      broadcastFn = broadcast;
      console.log('[notion] collector started, polling every 60s');

      const poll = async () => {
        try {
          const data = await fetchTasks();
          const payloadJson = JSON.stringify(data);

          if (payloadJson !== lastPayloadJson) {
            lastPayloadJson = payloadJson;
            broadcast({ type: 'tasks', data, timestamp: Date.now() });
            console.log(`[notion] broadcast ${data.items.length} tasks`);
          } else {
            console.log('[notion] no changes, skipping broadcast');
          }
        } catch (err) {
          console.error('[notion] poll error:', err instanceof Error ? err.message : err);
        }
      };

      void poll();
      timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
    },

    stop() {
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
      console.log('[notion] collector stopped');
    },

    async handleAction(action: string, payload: Record<string, unknown>) {
      if (action === 'getTaskDetail') {
        const taskId = payload.taskId as string;
        if (!broadcastFn) return;

        // Title/status/deadline are already known client-side; echoing them
        // back keeps the detail view self-contained if the list refreshes
        // underneath it.
        const detail: TaskDetail = {
          id: taskId,
          title: (payload.title as string) ?? '',
          status: payload.status as string | undefined,
          deadline: payload.deadline as string | undefined,
          content: [],
        };

        try {
          detail.content = await fetchTaskContent(taskId);
          console.log(`[notion] detail ${taskId}: ${detail.content.length} lines`);
        } catch (err) {
          console.error('[notion] detail error:', err instanceof Error ? err.message : err);
          detail.content = ['(could not load page content)'];
        }

        broadcastFn({ type: 'taskDetail', data: detail, timestamp: Date.now() });
        return;
      }

      if (action === 'advanceTaskStatus') {
        const taskId = payload.taskId as string;
        const currentStatus = (payload.currentStatus as string) ?? '未開始';
        const nextStatus = STATUS_PROGRESSION[currentStatus];
        if (!nextStatus) {
          console.log(`[notion] no progression from "${currentStatus}"`);
          return;
        }
        console.log(`[notion] advancing ${taskId}: "${currentStatus}" → "${nextStatus}"`);
        await updateTaskStatus(taskId, nextStatus);
        await forcePoll();
      }
    },
  };
}

interface NotionQueryResponse {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

interface NotionPage {
  id: string;
  properties: Record<string, NotionProperty>;
}

interface NotionProperty {
  type: string;
  title?: Array<{ plain_text: string }>;
  status?: { name: string };
  date?: { start: string };
  [key: string]: unknown;
}

interface RichText {
  plain_text: string;
}

interface NotionBlock {
  id: string;
  type: string;
  [key: string]: unknown;
}
