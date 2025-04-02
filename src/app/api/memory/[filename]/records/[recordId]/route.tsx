import { NextRequest, NextResponse } from "next/server";
import { authorizeRequestContext } from "@/lib/authorization-api";
import { authorizeSaasContext, authorizeStorageSchema } from "@/lib/generic-api";
import { getErrorMessage } from "@/lib/utils";
import { createVectorStoreManager } from "oab-vector-store";
import { getDataDir } from "@/utils/paths";

/**
 * DELETE /api/memory/[filename]/records/[recordId]
 * Deletes a specific record from a vector store.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { filename: string; recordId: string } }
) {
  try {
    const requestContext = await authorizeRequestContext(request);
    await authorizeSaasContext(request);
    await authorizeStorageSchema(request);

    const dataDir = getDataDir(requestContext.databaseIdHash);
    const storeManager = createVectorStoreManager({
      baseDir: dataDir
    });

    const store = await storeManager.getStore(requestContext.databaseIdHash, params.filename);
    if (!store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      );
    }

    await store.delete(params.recordId);
    return NextResponse.json({ message: 'Record deleted successfully' });
  } catch (err) {
    console.error('Error deleting record:', err);
    return NextResponse.json(
      { error: getErrorMessage(err) },
      { status: 500 }
    );
  }
} 