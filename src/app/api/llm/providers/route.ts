import { getAvailableProviders } from "@/lib/llm-provider";
import { authorizeRequestContext } from "@/lib/authorization-api";
import { getErrorMessage } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, res: NextResponse) {
  try {
    // Authorize the request
    const requestContext = await authorizeRequestContext(req, res);

    console.log("Request context:", requestContext);

    const providers = getAvailableProviders();
    return Response.json({ providers });
  } catch (error) {
    console.error("Error fetching LLM providers:", error);
    return Response.json(
      {
        error: "Failed to fetch LLM providers",
        message: getErrorMessage(error),
      },
      { status: error.message?.includes("Unauthorized") ? 401 : 500 }
    );
  }
}
