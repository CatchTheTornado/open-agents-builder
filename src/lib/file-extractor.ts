import { Message, TextPart } from 'ai';
import { execSync } from 'child_process';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, unlinkSync, rmdirSync, mkdirSync } from 'fs';
import { file } from 'jszip';
import { tmpdir } from 'os';
import path, { join } from 'path';

export interface ProcessFilesParams {
  inputObject: Record<string, string | string[]>; // base64 or array of base64
  pdfExtractText?: boolean;                      // default false
}

export function getMimeType(base64Data: string): string | null {
  // Expecting strings like: data:application/pdf;base64,JVBERi0x...
  const match = base64Data.match(/^data:([^;]+);base64,/);
  return match ? match[1] : null;
}

export function getFileExtensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/html': 'html',
    'text/csv': 'csv',
    'application/json': 'json',
    'application/zip': 'zip',
    'text/markdown': 'md',
    'text/plain': 'txt'
    // add more as needed...
  };
  return map[mimeType] || "not_convertible";
}

/**
 * Convert non-image, non-PDF documents to text/Markdown via markitdown.
 */
export function convertFileToText(filePath: string, outputPath: string): void {
  execSync(`markitdown  "${filePath}" > "${outputPath}"`, { stdio: 'ignore' });
}

/**
 * Convert PDF to an array of base64-encoded images (one per page).
 * Relies on `pdftoppm` from poppler-utils.
 */
export function convertPdfToImages(pdfPath: string, outputPrefix: string): string[] {
  // Example: pdftoppm -png myDocument.pdf page
  // creates page-1.png, page-2.png, ...
  execSync(`pdftoppm -png "${pdfPath}" "${outputPrefix}"`, { stdio: 'ignore' });

  // Gather any resulting .png files
  const dir = outputPrefix.substring(0, outputPrefix.lastIndexOf('/')); // tempDir
  const baseName = outputPrefix.substring(outputPrefix.lastIndexOf('/') + 1); // "page"
  
  const allFiles = readdirSync(dir);
  const imageFiles = allFiles.filter((f) => f.startsWith(baseName) && f.endsWith('.png'));

  // Convert each .png to base64
  const base64Images = imageFiles.map((imgFile) => {
    const fullPath = join(dir, imgFile);
    const data = readFileSync(fullPath);
    // Optionally prefix with "data:image/png;base64," for consistency
    const base64Encoded = `data:image/png;base64,${data.toString('base64')}`;
    try {
      unlinkSync(fullPath); // remove temp file
    } catch (error) {
      console.error(`Failed to remove temporary file: ${fullPath}`, error);
    }
    return base64Encoded;
  });

  return base64Images;
}

/**
 * Main function to process each entry in `inputObject`.
 * - Images → do nothing
 * - PDF (pdfExtractText = false) → array of base64 images
 * - PDF (pdfExtractText = true) → text (via markitdown)
 * - Other → text (via markitdown)
 */
export function processFiles({
  inputObject,
  pdfExtractText = false
}: ProcessFilesParams): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(inputObject)) {
    // If value is already an array (e.g., previously processed PDF pages),
    // just pass it through unchanged
    if (Array.isArray(value)) {
      result[key] = value;
      continue;
    }

    const base64Str = value; // must be a string at this point
    const mimeType = getMimeType(base64Str || '');
    if (!mimeType) {
      // If we can't detect a mime type, just pass it
      const base64Parts = base64Str.split(',');
      if (base64Parts.length < 2) {
        result[key] = base64Str; // keep as base64 if the format is invalid
        continue;
      }
      const content = Buffer.from(base64Parts[1], 'base64');
      // Check if the content contains non-printable characters
      const isBinary = content.some(byte => (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) || byte === 255);
      if (isBinary) {
        result[key] = base64Str; // keep as base64
      } else {
        result[key] = content.toString('utf-8'); // decode and return as text
      }
      continue;
    }

    // 1) If image => do nothing
    if (mimeType.startsWith('image/')) {
      result[key] = base64Str; // keep as is
      continue;
    }

    if(mimeType.startsWith('application/json')) {
      result[key] = Buffer.from(base64Str.split(',')[1], 'base64').toString('utf-8');
      continue;
    }    

    // 2) If PDF
    if (mimeType === 'application/pdf') {
      if (!pdfExtractText) {
        // Convert PDF to images
        const tempDir = mkdtempSync(join(tmpdir(), 'pdf2img-'));
        const inputFilename = join(tempDir, 'input.pdf');
        writeFileSync(inputFilename, Buffer.from(base64Str.split(',')[1], 'base64'));

        const outputPrefix = join(tempDir, 'page'); // pdftoppm page-1.png, page-2.png, etc.
        const images = convertPdfToImages(inputFilename, outputPrefix);

        // Clean up temp files
        cleanupTempDir(tempDir);

        // Save array of images
        result[key] = images;
      } else {
        // Extract text from PDF
        const tempDir = mkdtempSync(join(tmpdir(), 'markitdown-'));
        const inputFilename = join(tempDir, 'input.pdf');
        writeFileSync(inputFilename, Buffer.from(base64Str.split(',')[1], 'base64'));

        const outputFilename = join(tempDir, 'output.md');
        convertFileToText(inputFilename, outputFilename);
        const docText = readFileSync(outputFilename, 'utf-8');
        cleanupTempDir(tempDir);
        // Return the text
        result[key] = docText;
      }
      continue;
    }

    const fileExt = getFileExtensionFromMimeType(mimeType);
    const tempDir = mkdtempSync(join(tmpdir(), 'markitdown-'));

    // 3) Any other file => convert to text (via markitdown)
    try {
      if (fileExt === 'not_convertible') { // if thile is not convertible then try to return it as text
        // If we don't recognize the file type, just pass it
        // In case of error, return the error message
        const content = Buffer.from(base64Str.split(',')[1], 'base64');
        // Check if the content contains non-printable characters
        const isBinary = content.some(byte => (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) || byte === 255);
        if (isBinary) {
          throw new Error('Unsupported file format: Text file detected');
        }
        result[key] = content.toString('utf-8');
        cleanupTempDir(tempDir);
        
      } else {
        const inputFilename = join(tempDir, `input.${fileExt}`);
        writeFileSync(inputFilename, Buffer.from(base64Str.split(',')[1], 'base64'));

        const outputFilename = join(tempDir, 'output.md');
        convertFileToText(inputFilename, outputFilename);

        const docText = readFileSync(outputFilename, 'utf-8');
        cleanupTempDir(tempDir);

        result[key] = docText;
      }
    } catch (e) {
      console.error(e);
      continue;
    }
  }

  return result;
}

/**
 * Utility to remove temp files created during processing.
 * For illustration only — adjust for your own needs/permissions.
 */
function cleanupTempDir(dirPath: string) {
  try {
    // Remove files in the directory
    readdirSync(dirPath).forEach((file) => {
      unlinkSync(join(dirPath, file));
    });
    // Remove directory itself
    rmdirSync(dirPath);
  } catch (err) {
    // In real code, handle or log errors if you want
  }
}


export const replaceBase64Content = (data: string): string => {
  // Remove all base64 encoded content from the "image" fields
    return data.replace(/data:image\/[a-zA-Z]+;base64,[a-zA-Z0-9+/=]+/g, "File content removed");
};



export const processChatAttachments = async (
  messages: Message[],
  databaseIdHash: string,
  agentId: string,
  sessionId: string
) => {
  for (const message of messages) { 
    if (message.experimental_attachments) {

      const processedAttachments = []
      // Prepare temp workspace directory for this agent/session
      const tempWorkspaceDir = getExecutionTempDir(databaseIdHash, agentId, sessionId);

      // Helper to save the original base64 attachment to disk
      const saveOriginalAttachment = (name: string, base64Data: string, mimeTypeGuess?: string): void => {
        const sanitize = (n: string) => n.replace(/[^a-zA-Z0-9._-]/g, '_');
        const mime = mimeTypeGuess || getMimeType(base64Data) || 'application/octet-stream';
        const ext = getFileExtensionFromMimeType(mime) || 'bin';
        const fileName = `${sanitize(name)}.${ext}`;
        const filePath = join(tempWorkspaceDir, fileName);

        try {
          let dataPart = base64Data;
          // Strip prefix if present
          if (base64Data.startsWith('data:')) {
            dataPart = base64Data.split(',')[1] ?? '';
          }
          writeFileSync(filePath, Buffer.from(dataPart, 'base64'));
        } catch (err) {
          console.error(`Error saving original attachment to ${filePath}`, err);
        }
      };

      const attachmentsToProcess: Record<string, string> = {};
      for (const attachment of message.experimental_attachments) {
        if (!attachment.contentType?.startsWith("image")) { // we do not need to process images
          if (attachment.url.startsWith("http://") || attachment.url.startsWith("https://")) {
            try {
              const response = await fetch(attachment.url); // get the file from the URL to process it
              if (response.ok) {
                const buffer = await response.arrayBuffer();
                const base64String = Buffer.from(buffer).toString('base64');
                const base64Data = `data:${attachment.contentType};base64,${base64String}`;
                const attName = attachment.name ?? 'default';
                attachmentsToProcess[attName] = base64Data;
                saveOriginalAttachment(attName, base64Data, attachment.contentType);
              } else {
                console.error(`Failed to fetch file from URL: ${attachment.url}, Status: ${response.status}`);
              }
            } catch (error) {
              console.error(`Error fetching file from URL: ${attachment.url}`, error);
            }
          } else {
            const attName = attachment.name ?? 'default';
            attachmentsToProcess[attName] = attachment.url;
            saveOriginalAttachment(attName, attachment.url, attachment.contentType);
          }
        } else {
          // For images we still save originals
          try {
            const imgData = attachment.url;
            const attName = attachment.name ?? 'image';
            saveOriginalAttachment(attName, imgData, attachment.contentType);
          } catch {}
          processedAttachments.push(attachment);
        }
      }

      // Convert PDF to images or other processing
      const filesToUpload = processFiles({
        inputObject: attachmentsToProcess,
        pdfExtractText: false,
      });
      message.experimental_attachments = []; //

      for (const key in filesToUpload) {
        const fileContent = filesToUpload[key];

        const fileMapper = (fileStr: string) => {
          // No longer saving processed content, just augment chat

          if (getMimeType(fileStr)?.startsWith('image')) {
            processedAttachments.push({
              url: fileStr,
              contentType: getMimeType(fileStr) || 'application/octet-stream'
            });
          } else {
            (message.parts as Array<TextPart>).push({
              type: 'text',
              text: `${fileStr}`
            });
          }
        };

        if (Array.isArray(fileContent)) {
          fileContent.forEach((fc) => fileMapper(fc as string));
        } else {
          fileMapper(fileContent as string);
        }
      }

      message.experimental_attachments = processedAttachments;
    }
  }
  return messages;
}

// ---------------------------------------------------------------------------
// Helper to generate and ensure temp execution directory shared across tools
// ---------------------------------------------------------------------------

/**
 * Returns a deterministic temp directory path for a given database, agent and session
 * (/tmp/{databaseIdHash}/{agentId}/{sessionId}) and makes sure it exists.
 */
export function getExecutionTempDir(databaseIdHash: string, agentId: string, sessionId: string): string {
  const dirPath = join('/tmp', databaseIdHash, agentId, sessionId);
  try {
    mkdirSync(dirPath, { recursive: true });
  } catch (err) {
    // Directory might already exist or creation failed due to permissions
    // In production we might want to log this, here we swallow to avoid breaking the flow
  }
  return dirPath;
}