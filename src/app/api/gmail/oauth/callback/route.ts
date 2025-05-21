import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import ServerConfigRepository from '@/data/server/server-config-repository';
import { authorizeSaasContext, authorizeSaasToken } from '@/lib/generic-api';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
      return NextResponse.json(
        { error: 'Code and state parameters are required' },
        { status: 400 }
      );
    }

    // Split state into databaseIdHash and agentId
    const [databaseIdHash, agentId] = state.split('|');
    if (!databaseIdHash || !agentId) {
      return NextResponse.json(
        { error: 'Invalid state parameter' },
        { status: 400 }
      );
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.json(
        { error: 'Failed to get access token' },
        { status: 500 }
      );
    }

    const saasContex = await authorizeSaasToken(databaseIdHash);
    // Store tokens in config repository
    const configRepo = new ServerConfigRepository(databaseIdHash, saasContex.isSaasMode ? saasContex.saasContex?.storageKey : null);
    await configRepo.upsert(
      { key: `gmail_settings_${agentId}` },
      {
        key: `gmail_settings_${agentId}`,
        value: JSON.stringify({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiryDate: tokens.expiry_date
        }),
        updatedAt: Date.now().toString()
      }
    );

    // Redirect back to the app
    return NextResponse.redirect(new URL('/admin/agent/' + encodeURIComponent(agentId) + '/tools', request.url));
  } catch (error) {
    console.error('Failed to handle OAuth callback:', error);
    return NextResponse.json(
      { error: 'Failed to handle OAuth callback' },
      { status: 500 }
    );
  }
} 