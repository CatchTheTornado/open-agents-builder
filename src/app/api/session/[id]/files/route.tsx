import { authorizeRequestContext } from "@/lib/authorization-api";
import { authorizeSaasContext } from "@/lib/generic-api";
import { getErrorMessage } from "@/lib/utils";
import { getExecutionTempDir } from "@/lib/file-extractor";
import ServerSessionRepository from "@/data/server/server-session-repository";
import { NextRequest } from "next/server";
import { readdirSync } from "fs";
import path from "path";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionId = params.id;
    const saasContext = await authorizeSaasContext(request);

    const sessionRepo = new ServerSessionRepository(requestContext.databaseIdHash, saasContext.isSaasMode ? saasContext.saasContex?.storageKey : null);
    const existingSession = await sessionRepo.findOne({ id: sessionId });
    if (!existingSession) {
      return Response.json({ message: 'Session not found', status: 404 }, { status: 404 });
    }

    const agentId = existingSession.agentId;
    const sessionDir = getExecutionTempDir(requestContext.databaseIdHash, agentId, sessionId);

    // Safety check: only list files under /tmp
    if (!path.resolve(sessionDir).startsWith('/tmp')) {
      return Response.json({ message: 'Invalid session directory', status: 400 }, { status: 400 });
    }

    let files: string[] = [];
    try {
      files = readdirSync(sessionDir);
    } catch (err) {
      console.error(err);
    }

    return Response.json(files);
  } catch (err) {
    console.error(err);
    return Response.json({ message: getErrorMessage(err), status: 499 }, { status: 499 });
  }
} 