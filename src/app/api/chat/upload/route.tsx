import { NextRequest, NextResponse } from "next/server";
import { authorizeStorageSchema, authorizeSaasContext, ApiResult } from "@/lib/generic-api";
import { putAttachment, getAttachments } from "@/lib/attachments-api";
import { getErrorMessage } from "@/lib/utils";
import { nanoid } from "nanoid";
import { attachmentDTOSchema, StorageSchemas } from "@/data/dto";
import { v4 as uuidv4 } from "uuid";

/* ── helpers for the public endpoint ──────────────────────────────── */
function extractContextHeaders(req: NextRequest) {
    return {
        databaseIdHash: req.headers.get("Database-Id-Hash") ?? "public",
        sessionId: req.headers.get("Agent-Session-Id") || nanoid(),
        agentId: req.headers.get("Agent-Id") ?? undefined,
    };
}

/* PUT – no user auth  - allows only the users to put in a new file for the chat scenario - nothing less nothing more */
export async function PUT(request: NextRequest, response: NextResponse) {
    try {
        const { databaseIdHash } = extractContextHeaders(request);
        const schema = await authorizeStorageSchema(request, response);
        const saasCtx = await authorizeSaasContext(request);

        const handle = async (dto: any, file?: File): Promise<ApiResult> => {
            const attachmentDTO = attachmentDTOSchema.parse(dto);
            if (attachmentDTO.id) throw new Error("Cannot create new attachment with existing id or storageKey");
            attachmentDTO.storageKey = uuidv4();

            return putAttachment(dto, file, { databaseIdHash, storageSchema: schema as StorageSchemas, saasContext: saasCtx });
        }

        const result =
            request.headers.get("Content-Type") === "application/json"
                ? await handle(await request.json())
                : await (async () => {
                    const form = await request.formData();
                    return handle(
                        JSON.parse(form.get("attachmentDTO") as string),
                        form.get("file") as File | undefined
                    );
                })();

        return NextResponse.json(result, { status: 200 });
    } catch (e) {
        console.error(e);
        return NextResponse.json(
            { message: getErrorMessage(e), status: 499 },
            { status: 499 }
        );
    }
}
