import { authorizeRequestContext } from "@/lib/authorization-api";
import { authorizeSaasContext } from "@/lib/generic-api";
import { getErrorMessage } from "@/lib/utils";
import { getExecutionTempDir, getMimeType } from "@/lib/file-extractor";
import ServerSessionRepository from "@/data/server/server-session-repository";
import { NextRequest } from "next/server";
import { readFileSync } from "fs";
import path from "path";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionId = params.id;
    const url = new URL(request.url);
    const fileName = url.searchParams.get('name');
    if (!fileName) {
      return Response.json({ message: 'Filename missing', status: 400 }, { status: 400 });
    }

    const requestContext = await authorizeRequestContext(request);
    const saasContext = await authorizeSaasContext(request);

    const sessionRepo = new ServerSessionRepository(requestContext.databaseIdHash, saasContext.isSaasMode ? saasContext.saasContex?.storageKey : null);
    const existingSession = await sessionRepo.findOne({ id: sessionId });
    if (!existingSession) {
      return Response.json({ message: 'Session not found', status: 404 }, { status: 404 });
    }

    const agentId = existingSession.agentId;
    const sessionDir = getExecutionTempDir(requestContext.databaseIdHash, agentId, sessionId);
    const filePath = path.join(sessionDir, path.basename(fileName));

    if (!path.resolve(filePath).startsWith(path.resolve(sessionDir))) {
      return Response.json({ message: 'Invalid file path', status: 400 }, { status: 400 });
    }

    let data: Buffer;
    try {
      data = readFileSync(filePath);
    } catch (err) {
      return Response.json({ message: 'File not found', status: 404 }, { status: 404 });
    }

    const mimeType = getMimeType(data.toString('base64')) || 'application/octet-stream';
    const headers = new Headers();
    headers.append('Content-Type', mimeType);
    headers.append('Content-Disposition', `attachment; filename="${path.basename(fileName)}"`);

    return new Response(new Uint8Array(data), { headers });
  } catch (err) {
    console.error(err);
    return Response.json({ message: getErrorMessage(err), status: 499 }, { status: 499 });
  }
} 