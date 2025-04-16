import { NextRequest, NextResponse } from 'next/server';
import { convertPdfToImages } from '@/lib/file-extractor';
import { AttachmentApiClient } from '@/data/client/attachment-api-client';
import { StorageSchemas, AttachmentDTO } from '@/data/dto';
import { writeFile, unlink, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { authorizeSaasContext, authorizeStorageSchema } from '@/lib/generic-api';
import { authorizeRequestContext } from '@/lib/authorization-api';
import ServerAttachmentRepository from '@/data/server/server-attachment-repository';
import { StorageService } from '@/lib/storage-service';

export async function POST(request:NextRequest, response: NextResponse) {
  try {

    const requestContext = await authorizeRequestContext(request, response);
    const saasContext = await authorizeSaasContext(request);
    const storageSchema = await authorizeStorageSchema(request, response);
    

    const { storageKey } = await request.json();
    
    if (!storageKey) {
      return NextResponse.json({ error: 'No attachment storageKey provided' }, { status: 400 });
    }

    const attRepo = new ServerAttachmentRepository(requestContext.databaseIdHash, saasContext.isSaasMode ? saasContext.saasContex?.storageKey : null, storageSchema);

    const attachment = await attRepo.findOne({ storageKey });

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    if (attachment.mimeType !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
    }

    const storageService = new StorageService(requestContext.databaseIdHash, storageSchema);
    const fileContent = await storageService.readAttachmentAsBase64WithMimeType(attachment.storageKey, attachment.mimeType);

    
    // Save PDF temporarily
    const tempPdfPath = join(tmpdir(), `${Date.now()}.pdf`);
    await writeFile(tempPdfPath, Buffer.from(fileContent));

    // Convert PDF to images
    const outputPrefix = join(tmpdir(), `${Date.now()}_page`);
    const base64Images = await convertPdfToImages(tempPdfPath, outputPrefix);

    // Cleanup temporary files
    await unlink(tempPdfPath);

    return NextResponse.json({ images: base64Images });
  } catch (error) {
    console.error('Error processing PDF:', error);
    return NextResponse.json({ error: 'Failed to process PDF' }, { status: 500 });
  }
} 