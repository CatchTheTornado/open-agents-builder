// Business logic shared by both attachment endpoints
import { AttachmentDTO, attachmentDTOSchema, StorageSchemas } from "@/data/dto";
import ServerAttachmentRepository from "@/data/server/server-attachment-repository";
import { genericPUT, genericGET } from "@/lib/generic-api";
import { StorageService } from "@/lib/storage-service";
import { processFiles } from "@/lib/file-extractor";
import { getErrorMessage } from "@/lib/utils";
import { NextRequest } from "next/server";

export interface HandlerContext {
  databaseIdHash: string;
  storageSchema: StorageSchemas;
  saasContext: Awaited<ReturnType<typeof import("@/lib/generic-api").authorizeSaasContext>>;
}

export async function parseUploadPayload(req: NextRequest) {
    const ct = req.headers.get("Content-Type") ?? "";
    if (ct.startsWith("application/json")) {
      return { dto: await req.json(), file: undefined as File | undefined };
    }
    // assume multipart/form‑data
    const form = await req.formData();
    return {
      dto: JSON.parse(form.get("attachmentDTO") as string),
      file: form.get("file") as File | undefined,
    };
  }
  
/** Core PUT handler used by both routes */
export async function putAttachment(
  dtoInput: any,
  file: File | undefined,
  ctx: HandlerContext
) {

  const repo = new ServerAttachmentRepository(
    ctx.databaseIdHash,
    ctx.saasContext.isSaasMode ? ctx.saasContext.saasContex?.storageKey : null,
    ctx.storageSchema
  );
  const storage = new StorageService(ctx.databaseIdHash, ctx.storageSchema);

  const apiResult = await genericPUT<AttachmentDTO>(
    dtoInput,
    attachmentDTOSchema,
    repo,
    "id"
  );

  if (apiResult.status === 200 && file) {
    const saved = apiResult.data as AttachmentDTO;
    await storage.saveAttachment(file, saved.storageKey);

    // Only heavy‑lift for non‑images
    if (!saved.mimeType?.startsWith("image")) {
      try {
        repo.upsert({ id: saved.id }, { ...saved, extra: JSON.stringify({ status: "extracting" }) });

        const processed = processFiles({
          inputObject: {
            fileContent: storage.readAttachmentAsBase64WithMimeType(
              saved.storageKey,
              saved.mimeType ?? "application/octet-stream"
            ),
          },
          pdfExtractText: true,
        });

        const content = processed["fileContent"];
        repo.upsert(
          { id: saved.id },
          { ...saved, content: Array.isArray(content) ? content.join("\n") : content, extra: "" }
        );
      } catch (e) {
        repo.upsert(
          { id: saved.id },
          { ...saved, extra: JSON.stringify({ status: "error", error: getErrorMessage(e) }) }
        );
        console.error("Extraction error", e);
      }
    }
  }
  return apiResult;
}

/** Core GET handler used by both routes */
export async function getAttachments(
  request: Request,
  ctx: HandlerContext
) {
  const repo = new ServerAttachmentRepository(
    ctx.databaseIdHash,
    ctx.saasContext.isSaasMode ? ctx.saasContext.saasContex?.storageKey : null,
    ctx.storageSchema
  );

  return genericGET<AttachmentDTO>(request as any, repo);
}
