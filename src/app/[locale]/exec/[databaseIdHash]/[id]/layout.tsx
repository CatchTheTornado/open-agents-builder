import type { Metadata, ResolvingMetadata } from 'next';
import { ExecApiClient } from '@/data/client/exec-api-client';
import { Agent } from '@/data/client/models';

// Tu wczytaj swój defaultMetadata, np. z głównego layoutu
// lub wyeksportuj je do osobnego pliku i tu zaimportuj
import { metadata } from '@/app/layout';

import ExecLayoutClient from './layout-client';

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
      title: agt.options?.ogTitle ?? agt.displayName,
      description:
        agt.options?.ogDescription ??
        agt.options?.welcomeMessage ??
        metadata.description,
      openGraph: {
        images: agt.icon
          ? [agt.icon]
          : [`${process.env.NEXT_PUBLIC_APP_URL}/api/og/${databaseIdHash}/${id}`],
      },
    };
  } catch (error) {
    console.error(error);
  }

  // fallback, gdyby powyższy kod rzucił wyjątek
  return metadata;
}

export default function ExecLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { databaseIdHash: string; id: string; locale: string };
}) {
  // Tu nic nie robimy klienckiego (żadnych hooków) – layout jest serwerowy.
  // Wyrenderujemy layout kliencki (layout-client), który przejmie naszą logikę i18n itp.

  return (
    <ExecLayoutClient params={params}>
      {children}
    </ExecLayoutClient>
  );
}
