import { NextRequest, NextResponse } from "next/server";
import { authorizeRequestContext } from "@/lib/authorization-api";
import { authorizeSaasContext, authorizeStorageSchema } from "@/lib/generic-api";
import { getErrorMessage } from "@/lib/utils";
import { createVectorStoreManager } from "oab-vector-store";
import { getDataDir } from "@/utils/paths";

/**
 * GET /api/memory/[filename]
 * Returns the raw file content of a memory JSON file.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const requestContext = await authorizeRequestContext(request);
    await authorizeSaasContext(request);
    await authorizeStorageSchema(request);

    const dataDir = getDataDir(requestContext.databaseIdHash);
    const storeManager = await createVectorStoreManager({
      baseDir: dataDir
    });

    const store = await storeManager.getStore(requestContext.databaseIdHash, params.filename);
    if (!store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      );
    }

    const { items } = await store.entries();
    return NextResponse.json(items);
  } catch (err) {
    console.error('Error fetching store:', err);
    return NextResponse.json(
      { error: getErrorMessage(err) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/memory/[filename]
 * Deletes a memory JSON file.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const requestContext = await authorizeRequestContext(request);
    await authorizeSaasContext(request);
    await authorizeStorageSchema(request);

    const dataDir = getDataDir(requestContext.databaseIdHash);
    const storeManager = await createVectorStoreManager({
      baseDir: dataDir
    });

    // Check if store exists first
    const store = await storeManager.getStore(requestContext.databaseIdHash, params.filename);
    if (!store) {
      return NextResponse.json(
        { message: `Store '${params.filename}' not found`, status: 404 },
        { status: 404 }
      );
    }

    // Delete the store - this will handle both the store file and index cleanup
    await storeManager.deleteStore(requestContext.databaseIdHash, params.filename);
    return NextResponse.json({ message: 'Store deleted successfully', status: 200 });

  } catch (err) {
    console.error('Error deleting store:', err);
    return NextResponse.json(
      { message: getErrorMessage(err), status: 500 },
      { status: 500 }
    );
  }
}
