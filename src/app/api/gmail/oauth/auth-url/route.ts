import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const state = url.searchParams.get('state'); // databaseIdHash
    const agentId = url.searchParams.get('agentId');

    if (!state || !agentId) {
      return NextResponse.json(
        { error: 'State and agentId parameters are required' },
        { status: 400 }
      );
    }

    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: `${state}|${agentId}`,
      prompt: 'consent'
    });

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Failed to generate auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    );
  }
} 