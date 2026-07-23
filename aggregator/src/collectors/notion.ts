import type { Collector } from './types.js';
import type { AggregatorMessage, TaskItem, TasksData } from '../types.js';
import { config } from '../config.js';

const POLL_INTERVAL_MS = 60_000;
const ETHAN_USER_ID = 'a3ab0f13-21dc-4f04-8f9b-061b61edeede';

/**
 * Notion collector -- polls the Eng Tasks database and broadcasts task data.
 */
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
          and: [
            {
              property: 'Assignee',
              people: { contains: ETHAN_USER_ID },
            },
            {
              property: 'Status',
              status: { does_not_equal: 'Completed' },
            },
            {
              property: 'Status',
              status: { does_not_equal: 'Complete' },
            },
            {
              property: 'Status',
              status: { does_not_equal: 'Released' },
            },
            {
              property: 'Status',
              status: { does_not_equal: 'Archived' },
            },
          ],
        },
        sorts: [{ property: '期限', direction: 'ascending' }],
        page_size: 10,
      }),
    });

    if (!response.ok) {
      throw new Error(`Notion API error: ${response.status} ${response.statusText}`);
    }

    const body = await response.json() as NotionQueryResponse;
    const items = parseResults(body.results);

    const today = new Date().toISOString().slice(0, 10);
    const todayItems = items.filter((t) => t.deadline === today || !t.deadline);
    const completedToday = todayItems.filter((t) => t.done).length;

    return {
      items,
      completedToday,
      totalToday: todayItems.length,
    };
  }

  function parseResults(results: NotionPage[]): TaskItem[] {
    return results.map((page) => {
      const props = page.properties;

      // Title
      const titleProp = props['Task name'] ?? props['Name'] ?? props['Task'] ?? props['title'];
      const title = extractTitle(titleProp);

      // Status
      const statusProp = props['Status'];
      const status = statusProp?.status?.name ?? undefined;
      const done = status === 'Completed' || status === 'Complete' || status === 'Released';

      // Deadline (期限)
      const deadlineProp = props['期限'];
      const deadline = deadlineProp?.date?.start ?? undefined;

      // Tags (Eng tags)
      const tagsProp = props['Eng tags'] ?? props['Tags'];
      const tags = extractMultiSelect(tagsProp);

      // Priority: derive from tags or default to medium
      const priority = derivePriority(tags);

      return {
        id: page.id,
        title,
        priority,
        done,
        deadline,
        status,
        tags,
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

  function extractMultiSelect(prop: NotionProperty | undefined): string[] {
    if (!prop || prop.type !== 'multi_select') return [];
    return (prop.multi_select ?? []).map((s: { name: string }) => s.name);
  }

  function derivePriority(tags: string[]): 'high' | 'medium' | 'low' {
    const lower = tags.map((t) => t.toLowerCase());
    if (lower.some((t) => t === 'urgent' || t === 'high' || t === 'p0' || t === 'critical')) {
      return 'high';
    }
    if (lower.some((t) => t === 'low' || t === 'p2' || t === 'backlog')) {
      return 'low';
    }
    return 'medium';
  }

  return {
    name: 'notion',

    start(broadcast: (msg: AggregatorMessage) => void) {
      console.log('[notion] collector started, polling every 60s');

      const poll = async () => {
        try {
          const data = await fetchTasks();
          const payloadJson = JSON.stringify(data);

          // Only broadcast if data actually changed
          if (payloadJson !== lastPayloadJson) {
            lastPayloadJson = payloadJson;
            broadcast({
              type: 'tasks',
              data,
              timestamp: Date.now(),
            });
            console.log(`[notion] broadcast ${data.items.length} tasks`);
          } else {
            console.log('[notion] no changes, skipping broadcast');
          }
        } catch (err) {
          console.error('[notion] poll error:', err instanceof Error ? err.message : err);
          // Will retry on next interval
        }
      };

      // Initial poll immediately
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
  };
}

// ---- Notion API response types (minimal) ----

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
  multi_select?: Array<{ name: string }>;
  [key: string]: unknown;
}
