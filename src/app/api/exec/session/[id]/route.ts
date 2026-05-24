import { SessionDTO } from "@/data/dto";
import ServerSessionRepository from "@/data/server/server-session-repository";
import { authorizeSaasContext } from "@/lib/generic-api";
import { getErrorMessage } from "@/lib/utils";
import { NextRequest } from "next/server";


// create new session or return the existing one - do not allow to override the session initial data if created
export async function POST(request: NextRequest, { params }: { params: { id: string }} ) {
    try {
        const databaseIdHash = request.headers.get('Database-Id-Hash') || '';
        const { id } = params;
        const { agentId, userName, userEmail, acceptTerms } = await request.json();

        const saasContex = await authorizeSaasContext(request);
        const sessionRepo = new ServerSessionRepository(databaseIdHash, saasContex.isSaasMode ? saasContex.saasContex?.storageKey : null);

        if(!id) {
            return Response.json({ message: "Invalid request, no id provided within request url", status: 400 }, {status: 400});
        }

        if(!agentId || !userName || !userEmail) {
            return Response.json({ message: "Invalid request, missing required fields", status: 400 }, {status: 400});
        }

        const existingSession = await sessionRepo.findOne({ id });

        if (existingSession) {
            return Response.json({ message: "Session already exists", data: { id: existingSession.id }}, { status: 200 });
        }

        const savedSession = await sessionRepo.create({
            id,
            agentId,
            userName,
            userEmail,
            acceptTerms: acceptTerms === 'true' ? 'true' : 'false',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        } as SessionDTO);

        return Response.json({ message: "Session created", data: { id: savedSession.id }, status: 200 }); // do not return the session data as it contains personal information so getting the session id user would be able to retrieve it's personal data


    } catch (error) {
        console.error(error);
        return Response.json({ message: `Invalid request ${getErrorMessage(error)}`, status: 499 }, {status: 499});
    }
}