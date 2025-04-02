import { NextRequest, NextResponse } from "next/server";
import { createOpenAIEmbeddings } from "oab-vector-store";

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const generateEmbeddings = createOpenAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY
    });

    const embedding = await generateEmbeddings(content);

    return NextResponse.json({ embedding });
  } catch (error) {
    console.error("Error generating embeddings:", error);
    return NextResponse.json(
      { error: "Failed to generate embeddings" },
      { status: 500 }
    );
  }
} 