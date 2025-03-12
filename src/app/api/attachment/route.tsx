import { AttachmentDTO, attachmentDTOSchema, StorageSchemas } from "@/data/dto";
import ServerAttachmentRepository from "@/data/server/server-attachment-repository";
import { authorizeSaasContext, authorizeStorageSchema, genericGET, genericPUT } from "@/lib/generic-api";
import { authorizeRequestContext } from "@/lib/authorization-api";
import { StorageService } from "@/lib/storage-service";
import { getErrorMessage } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";


// Rest of the code


export async function PUT(request: NextRequest, response: NextResponse) {
    try {
        if (request.headers.get("Content-Type") === "application/json") {
            const inputJson = await request.json();
            return await handlePUTRequest(inputJson, request, response);
        } else {
            const formData = await request.formData();
            return await handlePUTRequest(JSON.parse(formData.get("attachmentDTO") as string), request, response, formData.get("file") as File);
        }
    } catch (error) {
        console.error(error);

        return Response.json({ message: getErrorMessage(error), status: 499 }, {status: 499});
} 
}

async function handlePUTRequest(inputJson: any, request: NextRequest, response: NextResponse, file?: File) {
    const requestContext = await authorizeRequestContext(request, response);
    const storageSchema = await authorizeStorageSchema(request, response);
    const saasContext = await authorizeSaasContext(request);

    const storageService = new StorageService(requestContext.databaseIdHash, storageSchema);
    let apiResult = await genericPUT<AttachmentDTO>(
        inputJson,
        attachmentDTOSchema,
        new ServerAttachmentRepository(requestContext.databaseIdHash, saasContext.isSaasMode ? saasContext.saasContex?.storageKey : null, storageSchema),
        'id'
    );

    // TODO add markitdown extraction + data encryption


    if (apiResult.status === 200) { // validation went OK, now we can store the file
        if (file) { // file could be not uploaded in case of metadata update
            try {
                const savedAttachment: AttachmentDTO = apiResult.data as AttachmentDTO;
                storageService.saveAttachment(file, savedAttachment.storageKey);
            } catch (e) {
                console.error("Error saving attachment", e);
                apiResult.status = 500;
                apiResult.message = getErrorMessage(e);
                apiResult.error = e;
            }
        }
    }
    return Response.json(apiResult, { status: apiResult.status });
}

export async function GET(request: NextRequest, response: NextResponse) {
    const requestContext = await authorizeRequestContext(request, response);
    const storageSchema = await authorizeStorageSchema(request, response);
    const saasContext = await authorizeSaasContext(request);

    return Response.json(await genericGET<AttachmentDTO>(request, new ServerAttachmentRepository(requestContext.databaseIdHash, saasContext.isSaasMode ? saasContext.saasContex?.storageKey : null, storageSchema)));
}
