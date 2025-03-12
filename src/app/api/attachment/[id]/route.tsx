import ServerAttachmentRepository from "@/data/server/server-attachment-repository";
import { authorizeSaasContext, authorizeStorageSchema, genericDELETE } from "@/lib/generic-api";
import { authorizeRequestContext } from "@/lib/authorization-api";
import { StorageService } from "@/lib/storage-service";
import { getErrorMessage } from "@/lib/utils";
import { NextRequest } from "next/server";
export const dynamic = 'force-dynamic' // defaults to auto


export async function DELETE(request: NextRequest, { params }: { params: { id: string }} ) {
    try {
        const requestContext = await authorizeRequestContext(request);
        const storageSchema = await authorizeStorageSchema(request);
        const saasContext = await authorizeSaasContext(request);
        const storageService = new StorageService(requestContext.databaseIdHash, storageSchema);

        const recordLocator = params.id;
        if(!recordLocator){
            return Response.json({ message: "Invalid request, no id provided within request url", status: 400 }, {status: 400});
        } else { 
            const repo = new ServerAttachmentRepository(requestContext.databaseIdHash, saasContext.isSaasMode ? saasContext.saasContex?.storageKey : null, storageSchema)
            const recordBeforeDelete = await repo.findOne({ storageKey: recordLocator });
            if (!recordBeforeDelete) {
                return Response.json({ message: "Record not found", status: 404 }, {status: 404});
            }
            const apiResponse = await genericDELETE(request, repo, { storageKey: recordLocator});
            if(apiResponse.status === 200){
                storageService.deleteAttachment(recordLocator);
            }
            return Response.json(apiResponse);       
        }
    } catch (error) {
        console.error(error);

        return Response.json({ message: getErrorMessage(error), status: 499 }, {status: 499});
} 
}

export async function GET(request: Request, { params }: { params: { id: string }}) {
    try {
        const requestContext = await authorizeRequestContext(request);
        const storageSchema = await authorizeStorageSchema(request);
        const storageService = new StorageService(requestContext.databaseIdHash, storageSchema);

        const headers = new Headers();
        headers.append('Content-Type', 'application/octet-stream');
        const fileContent = await storageService.readAttachment(params.id) // TODO: add streaming
        return new Response(fileContent, { headers });
    } catch (error) {
        console.error(error);

        return Response.json({ message: getErrorMessage(error), status: 499 }, {status: 499});
} 
}