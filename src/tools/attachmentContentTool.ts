import { z } from 'zod';
import { tool } from 'ai';
import { ToolDescriptor } from './registry';
import ServerAttachmentRepository from '@/data/server/server-attachment-repository';
import { getErrorMessage } from '@/lib/utils';
import { getExecutionTempDir, getFileExtensionFromMimeType, getMimeType } from '@/lib/file-extractor';
import { writeFileSync } from 'fs';
import path from 'path';
import { StorageService } from '@/lib/storage-service';

const attachmentContentToolParamsSchema = z.object({
  id: z.string().optional().describe("String to filter attachments by storageKey, filename or mimeType")
});

export function createAttachmentContentTool(
  databaseIdHash: string,
  storageKey: string | null | undefined,
  storagePartition: string,
  agentId: string,
  sessionId: string
): ToolDescriptor {
  return {
    displayName: "Get the attachment content",
    tool: tool({
      description: "Get the attachment content identified by id or storageKey or displayName",
      parameters: attachmentContentToolParamsSchema,
      execute: async (params) => {
        const { id } = params;
      
        try {
          const attRepo = new ServerAttachmentRepository(databaseIdHash, storageKey, storagePartition);
          const attachments = await attRepo.queryAll({ query: id ?? '', limit: 1, offset: 0, orderBy: "displayName" });

          if (attachments.rows.length === 0) {
            return `No attachment found with id=${id}`;
          }

          const attachment = attachments.rows[0];
          const contentStr = attachment.content ?? '';

          // Determine session execution folder and file name base
          const sessionDir = getExecutionTempDir(databaseIdHash, agentId, sessionId);

          // Base name (without extension) derived from displayName or storageKey
          const baseName = (attachment.displayName ?? attachment.storageKey).replace(/[^a-zA-Z0-9._-]/g, '_');

          // Always save markdown representation
          const mdFileName = `${path.parse(baseName).name}.md`;

          const mdFilePath = path.join(sessionDir, mdFileName);

          try {
            // contentStr is plain markdown text already
            writeFileSync(mdFilePath, contentStr, 'utf-8');
          } catch (err) {
            console.error('Error writing markdown file', err);
            return `Failed to save markdown file: ${getErrorMessage(err)}`;
          }

          // Save original/binary attachment content
          const storageService = new StorageService(databaseIdHash, storagePartition);

          let binaryFileName = baseName;
          if (!path.extname(binaryFileName)) {
            const mimeType = attachment.mimeType || 'application/octet-stream';
            const ext = getFileExtensionFromMimeType(mimeType);
            binaryFileName = `${binaryFileName}.${ext}`;
          }

          const binaryFilePath = path.join(sessionDir, binaryFileName);

          try {
            const arrayBuffer = storageService.readAttachment(attachment.storageKey);
            writeFileSync(binaryFilePath, Buffer.from(arrayBuffer));
          } catch (err) {
            console.error('Error saving binary attachment', err);
            // Continue even if binary save fails
          }

          // Return the content plus the paths of the saved files
          return {
            content: contentStr,
            markdownPath: `/session/${mdFileName}`,
            binaryPath: `/session/${binaryFileName}`
          };
        } catch (err) {
          console.error(err);
          return `Error retrieving attachment: ${getErrorMessage(err)}`;
        }
      }
    })
  }
}