import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import ServerConfigRepository from '@/data/server/server-config-repository';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // Contains databaseIdHash

    if (!code || !state) {
      return NextResponse.json(
        { error: 'Authorization code and state are required' },
        { status: 400 }
      );
    }

    // Exchange the code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    // Store the tokens in the config repository
    const configRepo = new ServerConfigRepository(state);
    await configRepo.upsert(
      { key: 'gmail_settings' },
      {
        key: 'gmail_settings',
        value: JSON.stringify({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiryDate: tokens.expiry_date
        }),
        updatedAt: Date.now().toString()
      }
    );

    // Redirect back to the admin page
    return NextResponse.redirect(new URL('/admin/settings', request.url));
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.json(
      { error: 'Failed to complete OAuth flow' },
      { status: 500 }
    );
  }
} 