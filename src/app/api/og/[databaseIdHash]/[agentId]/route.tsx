import { Agent } from '@/data/client/models';
import ServerAgentRepository from '@/data/server/server-agent-repository';
import { ImageResponse } from '@vercel/og';
import Markdown from 'react-markdown';

const defaultImage = new ImageResponse(
  (
    <div
      style={{
        display: 'flex',
        fontSize: 40,
        color: 'black',
        background: 'white',
        width: '100%',
        height: '100%',
        padding: '50px 200px',
        textAlign: 'center',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <img style={{ margin: '5px', width: '100px' }} src="https://app.openagentsbuilder.com/img/OAB-Logo-Small.svg" />
      Welcome to Open Agents Builder agent!
    </div>
  ),
  {
    width: 1200,
    height: 630,
  },
);

export async function GET(request: Request, { params }: { params: { databaseIdHash: string, agentId: string } }) {

  try {
    const agRepo = new ServerAgentRepository(params.databaseIdHash);
    const agtDTO = await agRepo.findOne({ id: params.agentId });

    if (agtDTO) {
      const agt = Agent.fromDTO(agtDTO);
      if (process.env.NODE_ENV !== 'production') {
        console.log(agt?.icon);
      }
      return new ImageResponse(
        (
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              color: 'black',
              background: 'white',
              width: '100%',
              height: '100%',
              padding: '50px',
              textAlign: 'left',
              justifyContent: 'flex-start',
              alignItems: 'center',
              fontFamily: 'Arial, sans-serif',
            }}
          >
            <img
              style={{
                marginRight: '30px',
                width: '200px',
                height: '200px',
                objectFit: 'cover',
                borderRadius: '10px',
              }}
              width={100}
              height={100}
              src={"https://app.openagentsbuilder.com/img/OAB-Logo-Small.svg"}
              alt="Agent Icon"
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h1 style={{ fontSize: '50px', margin: '0 0 20px 0', width: '800px' }}>
                {agt?.displayName ?? 'Agent Name'}
              </h1>
              <div style={{ display: 'flex', fontSize: '20px', lineHeight: '1.5', width: '800px' }}>
                <Markdown>
                  {agt?.options?.ogDescription?.replace(/[#_*~`>+-]/g, '') || agt?.options?.welcomeMessage?.replace(/[#_*~`>+-]/g, '') || 'No description available.'}
                </Markdown>
              </div>
            </div>
          </div>
        ),
        {
          width: 1200,
          height: 630,
        },
      );
    } else {
      return defaultImage;
    }
  } catch (err) {
    console.error(err);

    return defaultImage;

  }
}