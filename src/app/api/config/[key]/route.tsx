import ServerConfigRepository from "@/data/server/server-config-repository";
import { genericDELETE } from "@/lib/generic-api";
import { authorizeRequestContext } from "@/lib/authorization-api";
import { getErrorMessage } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(request: NextRequest, { params }: { params: { key: string }}) {
    try {
        const recordLocator = params.key;
        const requestContext = await authorizeRequestContext(request);
        if (requestContext.acl.role !== 'owner') {
            return Response.json({ message: "Owner role is required", status: 401 }, {status: 401});
        }

        if(!recordLocator){
            return Response.json({ message: "Invalid request, no key provided within request url", status: 400 }, {status: 400});
        } else { 
            return Response.json(await genericDELETE(request, new ServerConfigRepository(requestContext.databaseIdHash), { key: recordLocator}));
        }
    } catch (error) {
        console.error(error);

        return Response.json({ message: getErrorMessage(error), status: 499 }, {status: 499});
}     
}