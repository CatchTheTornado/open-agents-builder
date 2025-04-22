import { NextRequest, NextResponse } from "next/server";
import {
  authorizeStorageSchema,
  authorizeSaasContext,
} from "@/lib/generic-api";
import {
  parseUploadPayload,
  putAttachment,
  getAttachments,
} from "@/lib/attachments-api";
import { getErrorMessage } from "@/lib/utils";
import { authorizeRequestContext } from "@/lib/authorization-api";
import { StorageSchemas } from "@/data/dto";

// PUT with authentication
export async function PUT(request: NextRequest, response: NextResponse) {
  try {
    const reqCtx   = await authorizeRequestContext(request, response);
    const schema   = await authorizeStorageSchema(request, response);
    const saasCtx  = await authorizeSaasContext(request);

    const { dto, file } = await parseUploadPayload(request);
    const result = await putAttachment(dto, file, {
      databaseIdHash: reqCtx.databaseIdHash,
      storageSchema:  schema as StorageSchemas,
      saasContext:    saasCtx,
    });

    return NextResponse.json(result, { status: result.status });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: getErrorMessage(e), status: 499 },
      { status: 499 },
    );
  }
}

// GET with authentication
export async function GET(request: NextRequest, response: NextResponse) {
  const reqCtx  = await authorizeRequestContext(request, response);
  const schema  = await authorizeStorageSchema(request, response);
  const saasCtx = await authorizeSaasContext(request);

  return NextResponse.json(
    await getAttachments(request, {
      databaseIdHash: reqCtx.databaseIdHash,
      storageSchema:  schema as StorageSchemas,
      saasContext:    saasCtx,
    }),
  );
}
