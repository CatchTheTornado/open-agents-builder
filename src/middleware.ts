import { NextResponse, type NextRequest } from 'next/server'
import {SignJWT, jwtVerify, type JWTPayload} from 'jose'
import { i18nRouter } from 'next-i18n-router';
import i18nConfig from '@/app/i18nConfig';
import { precheckAPIRequest } from './lib/middleware-precheck-api';


export async function middleware(request: NextRequest) {
    if (request.url.indexOf('/api/') > 0) {
        const { jwtToken, apiRequest } = await precheckAPIRequest(request as NextRequest);

        if (!jwtToken) {
            return NextResponse.json({ message: 'Unauthorized', status: 401 }, { status: 401 });
        } else {
            try {
                const decoded = await jwtVerify(jwtToken, new TextEncoder().encode(process.env.NEXT_PUBLIC_TOKEN_SECRET || 'Jeipho7ahchue4ahhohsoo3jahmui6Ap'));
                const checkDbHeader = request.headers.get('database-id-hash') === decoded.payload.databaseIdHash;

                if(!checkDbHeader) {
                    return NextResponse.json({ message: 'Unauthorized', status: 401 }, { status: 401 });
                }

            } catch (error) {
                console.error(error);
                return NextResponse.json({ message: 'Unauthorized', status: 401 }, { status: 401 });
            }

        }
    } else {
        request.headers.set('X-Path', request.nextUrl.pathname);
        return i18nRouter(request, i18nConfig);
    }


}
 
export const config = {
  matcher: '/((?!api/db|api/agent/.*/exec|api/chat|api/chat/upload|api/exec|api/og|storage|api/gmail|api/saas|api/agent/results-chat|content|img|_next/image|_next/static|static|.*\\..*|_next).*)',
  //matcher: ['/((?!api/db|storage|agent|dashboard|chat|api/saas|_next/static|content|_next/image|img|onboarding|manifest|favicon.ico|$).*)'],
}