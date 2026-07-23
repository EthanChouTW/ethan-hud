import 'dotenv/config';

export interface Config {
  notionToken: string;
  notionDatabaseId: string;
  wsPort: number;
  calendarEnabled: boolean;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config: Config = {
  notionToken: requireEnv('NOTION_TOKEN'),
  notionDatabaseId: process.env['NOTION_DATABASE_ID'] ?? '7f0a07d9d5544e818d32ea59356bbb2c',
  wsPort: parseInt(process.env['WS_PORT'] ?? '9500', 10),
  calendarEnabled: process.env['CALENDAR_ENABLED'] !== 'false',
};
