import { statsSchema } from "@/data/dto";
import ServerStatRepository from "@/data/server/server-stat-repository";
import { genericGET, genericPUT } from "@/lib/generic-api";
import { authorizeRequestContext } from "@/lib/authorization-api";
import { getErrorMessage, getZedErrorMessage } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, response: NextResponse) {
    try {
        const requestContext = await authorizeRequestContext(request, response);

        const statsRepo = new ServerStatRepository(requestContext.databaseIdHash, 'stats');
        const statsAggregated = await statsRepo.thisAndLastMonth();
        return Response.json({
            message: 'Stats aggregated!',
            data: statsAggregated,
            status: 200
        }, { status: 200 });

    } catch (e) {   
        return Response.json({
            message: getErrorMessage(e),
            status: 400
        }, { status: 400 });
    }
}

