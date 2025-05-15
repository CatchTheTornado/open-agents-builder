import ServerSessionRepository from "@/data/server/server-session-repository";
import {  auditLog, authorizeSaasContext, genericDELETE } from "@/lib/generic-api";
import { authorizeRequestContext } from "@/lib/authorization-api";
import { getErrorMessage } from "@/lib/utils";
import { getExecutionTempDir } from "@/lib/file-extractor";
import { rmSync } from "fs";
import path from "path";
import { NextRequest } from "next/server";

export async function DELETE(request: NextRequest, { params }: { params: { id: number }} ) {
    try {
        const recordLocator = params.id;
        const requestContext = await authorizeRequestContext(request);
        const saasContext = await authorizeSaasContext(request);

        if(!recordLocator){
            return Response.json({ message: "Invalid request, no id provided within request url", status: 400 }, {status: 400});
        } else { 

            auditLog({
                eventName: 'deleteSession',
                recordLocator: JSON.stringify({ id: recordLocator})
            }, null, requestContext, saasContext);
                    
            const sessionRepo = new ServerSessionRepository(requestContext.databaseIdHash, saasContext.isSaasMode ? saasContext.saasContex?.storageKey : null);

            // Retrieve the session before deletion to get agentId
            const existingSessions = await sessionRepo.findAll({ filter: { id: recordLocator } });
            const agentId = existingSessions.length > 0 ? existingSessions[0].agentId : undefined;

            // Proceed with DB deletion
            const deleteResponse = await genericDELETE(request, sessionRepo, { id: recordLocator});

            // After successful deletion, remove temp directory if we have agentId
            if (deleteResponse.status === 200 && agentId) {
              try {
                const sessionDir = getExecutionTempDir(requestContext.databaseIdHash, agentId, String(recordLocator));
                // Ensure we do not accidentally delete root dirs
                if (path.resolve(sessionDir).startsWith('/tmp')) {
                  rmSync(sessionDir, { recursive: true, force: true });
                }
              } catch (err) {
                console.error('Error removing session temp directory', err);
              }
            }

            return Response.json(deleteResponse);
        }
    } catch (error) {
        console.error(error);

        return Response.json({ message: getErrorMessage(error), status: 499 }, {status: 499});
    }
}