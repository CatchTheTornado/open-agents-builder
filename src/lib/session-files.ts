import { getExecutionTempDir } from '@/lib/file-extractor';
import { readdirSync } from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import type { Message } from 'ai';
import i18next from 'i18next';

/**
 * Lists files in the session execution directory and returns an assistant message
 * containing download links (Markdown) for those files.
 */
export function createSessionFilesMessage(databaseIdHash: string, agentId: string, sessionId: string, language: string): Message | null {
  const sessionDir = getExecutionTempDir(databaseIdHash, agentId, sessionId);

  // Security: restrict to /tmp path
  if (!path.resolve(sessionDir).startsWith('/tmp')) return null;

  let files: string[] = [];
  try {
    files = readdirSync(sessionDir);
  } catch {
    // ignore read errors (dir may not exist yet)
  }

  if (files.length === 0) return null;

  const links = files
    .map((f) => `- [${f}](/api/session/${sessionId}/file?name=${encodeURIComponent(f)})`)
    .join('\n');

  const header = i18next.t('Download files', { lng: language });

  const content = `### ${header}\n\n${links}`;

  return {
    id: nanoid(),
    role: 'assistant',
    content
  } as Message;
} 