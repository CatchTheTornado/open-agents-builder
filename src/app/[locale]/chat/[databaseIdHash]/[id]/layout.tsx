import type { Metadata, ResolvingMetadata } from "next";
import { ExecApiClient } from "@/data/client/exec-api-client";
import { Agent } from "@/data/client/models";
import { metadata } from "@/app/layout"; 
// zakładam, że defaultMetadata masz wyeksportowane w swoim głównym layout.tsx
// ewentualnie możesz tu wpisać "na sztywno" lub wstawić import z innego pliku

import ChatLayoutClient from "./layout-client"; 
// to jest nasz plik kliencki, do którego przeniesiemy obecną logikę useState / useEffect / itp.

type Props = {
  params: { databaseIdHash: string; id: string; locale: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {

  const { databaseIdHash, id } = params;

  try {
    const client = new ExecApiClient(databaseIdHash, process.env.NEXT_PUBLIC_APP_URL);
    const agt = Agent.fromDTO((await client.agent(id)).data);

    return {
      title: agt.options?.ogTitle || agt.displayName,
      description: agt.options?.ogDescription || agt.options?.welcomeMessage || metadata.description,
      openGraph: {
        images: agt.icon 
          ? [agt.icon]
          : [`${process.env.NEXT_PUBLIC_APP_URL}/api/og/${databaseIdHash}/${id}`],
      },
    };
  } catch (error) {
    console.error(error);
  }

  // Fallback:
  return metadata;
}

export default function ChatAgentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { databaseIdHash: string; id: string; locale: string };
}) {

  return (
    <ChatLayoutClient params={params}>
      {children}
    </ChatLayoutClient>
  );
}
