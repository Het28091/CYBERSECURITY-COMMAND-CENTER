// Settings helper — loads and updates the single Settings row.
import { db } from '@/lib/db';

export interface AppSettings {
  id: number;
  allowedProjectRoots: string[];
  typoCorrection: boolean;
  bindLocalhost: boolean;
  maxLogLinesPerProject: number;
  commandTimeoutMs: number;
  externalFetchEnabled: boolean;
  aiAssistanceEnabled: boolean;
  updatedAt: Date;
}

const DEFAULTS = {
  allowedProjectRoots: ['/home/z/my-project', '/tmp'],
  typoCorrection: true,
  bindLocalhost: true,
  maxLogLinesPerProject: 5000,
  commandTimeoutMs: 60000,
  externalFetchEnabled: true,
  aiAssistanceEnabled: true,
};

export async function getSettings(): Promise<AppSettings> {
  const row = await db.settings.findUnique({ where: { id: 1 } });
  if (!row) {
    const created = await db.settings.create({ data: { id: 1, ...DEFAULTS } });
    return rowToSettings(created);
  }
  return rowToSettings(row);
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const data = {
    allowedProjectRoots: JSON.stringify(patch.allowedProjectRoots ?? current.allowedProjectRoots),
    typoCorrection: patch.typoCorrection ?? current.typoCorrection,
    bindLocalhost: patch.bindLocalhost ?? current.bindLocalhost,
    maxLogLinesPerProject: patch.maxLogLinesPerProject ?? current.maxLogLinesPerProject,
    commandTimeoutMs: patch.commandTimeoutMs ?? current.commandTimeoutMs,
    externalFetchEnabled: patch.externalFetchEnabled ?? current.externalFetchEnabled,
    aiAssistanceEnabled: patch.aiAssistanceEnabled ?? current.aiAssistanceEnabled,
  };
  const updated = await db.settings.update({ where: { id: 1 }, data });
  return rowToSettings(updated);
}

function rowToSettings(row: any): AppSettings {
  return {
    id: row.id,
    allowedProjectRoots: safeParse(row.allowedProjectRoots, DEFAULTS.allowedProjectRoots),
    typoCorrection: row.typoCorrection,
    bindLocalhost: row.bindLocalhost,
    maxLogLinesPerProject: row.maxLogLinesPerProject,
    commandTimeoutMs: row.commandTimeoutMs,
    externalFetchEnabled: row.externalFetchEnabled,
    aiAssistanceEnabled: row.aiAssistanceEnabled,
    updatedAt: row.updatedAt,
  };
}

function safeParse<T>(s: string, fallback: T): T {
  try { return JSON.parse(s); } catch { return fallback; }
}
