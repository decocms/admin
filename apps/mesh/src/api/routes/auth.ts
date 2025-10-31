/**
 * Custom Auth Routes
 * 
 * Provides custom authentication endpoints that work better with OAuth flows
 * by returning callback URLs in response body instead of using 302 redirects.
 */

import { Hono } from 'hono';
import { auth } from '../../auth';

const app = new Hono();

/**
 * Custom Sign-In Endpoint
 * 
 * Uses Better Auth's sign-in API without callbackURL (returns 200 OK).
 * For OAuth flows, generates authorization code and returns the callback URL.
 * Browser handles navigation client-side to avoid CORS issues.
 * 
 * Route: POST /api/auth/custom/sign-in
 */
app.post('/sign-in', async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, oauthParams } = body;

    console.log('[Custom Sign-In] Request:', { email, oauthParams });

    // Validate inputs
    if (!email || !password) {
      return c.json({
        success: false,
        error: 'Email and password are required'
      }, 400);
    }

    // Use Better Auth's API - NO callbackURL so it returns 200 OK
    const response = await auth.api.signInEmail({
      body: {
        email,
        password,
        // NOT passing callbackURL - Better Auth returns 200 instead of 302
      },
      asResponse: true,
    });

    // Check if authentication was successful
    if (!response.ok) {
      const errorData = await response.json() as { message?: string };
      return c.json({
        success: false,
        error: errorData.message || 'Invalid credentials'
      }, response.status as any);
    }

    // Extract cookies from Better Auth response
    const setCookieHeaders: string[] = [];
    if (typeof response.headers.getSetCookie === 'function') {
      setCookieHeaders.push(...response.headers.getSetCookie());
    } else {
      const cookieHeader = response.headers.get('set-cookie');
      if (cookieHeader) {
        setCookieHeaders.push(cookieHeader);
      }
    }

    // Forward all Set-Cookie headers to the client
    setCookieHeaders.forEach(cookie => {
      c.header('Set-Cookie', cookie, { append: true });
    });

    // Parse Better Auth response data
    const data = await response.json() as { user: any; session: any };

    let callbackURL = '/';

    // If OAuth flow, use Better Auth to generate authorization code
    if (oauthParams && oauthParams.client_id && oauthParams.redirect_uri) {
      console.log('[Custom Sign-In] OAuth flow detected, generating authorization code via Better Auth');

      // Use Better Auth's internal MCP plugin to generate authorization code
      // Create a synthetic request to Better Auth's authorize endpoint
      const authorizeUrl = new URL('http://localhost/api/auth/mcp/authorize');
      Object.entries(oauthParams).forEach(([key, value]) => {
        if (value && typeof value === 'string') {
          authorizeUrl.searchParams.set(key, value);
        }
      });

      // Build headers with the NEW session cookies we just created
      const authorizeHeaders = new Headers(c.req.raw.headers);
      // Add the session cookies from Better Auth response
      setCookieHeaders.forEach(cookie => {
        // Parse cookie to get the cookie name and value for the request
        const cookieParts = cookie.split(';')[0]; // Get "name=value" part
        const existingCookies = authorizeHeaders.get('cookie') || '';
        authorizeHeaders.set('cookie', existingCookies ? `${existingCookies}; ${cookieParts}` : cookieParts);
      });

      const authorizeRequest = new Request(authorizeUrl.toString(), {
        method: 'GET',
        headers: authorizeHeaders,
      });

      // Call Better Auth's authorization endpoint
      const authorizeResponse = await auth.handler(authorizeRequest);

      console.log('[Custom Sign-In] Better Auth authorize response:', authorizeResponse.status);

      // Better Auth should return 302 redirect to callback with code
      if (authorizeResponse.status === 302) {
        const location = authorizeResponse.headers.get('location');
        if (location) {
          // Check if it's redirecting back to sign-in (auth failed) or to client callback (success)
          if (location.startsWith('/sign-in')) {
            console.log('[Custom Sign-In] Better Auth redirected back to sign-in, auth might have failed');
            // Don't update callbackURL, let it stay as '/'
          } else {
            callbackURL = location;
            // Safe logging - handle both absolute and relative URLs
            try {
              const url = new URL(location);
              console.log('[Custom Sign-In] Got callback URL from Better Auth:', url.origin + '/...');
            } catch {
              console.log('[Custom Sign-In] Got callback URL from Better Auth:', location);
            }
          }
        }
      }
    }

    console.log('[Custom Sign-In] Success!');

    // Return success with callback URL in response body
    // Browser will navigate to this URL
    return c.json({
      success: true,
      callbackURL,
      user: data.user,
      session: data.session,
    });

  } catch (error) {
    console.error('[Custom Sign-In] Error:', error);

    const errorMessage = error instanceof Error
      ? error.message
      : 'Sign in failed';

    return c.json({
      success: false,
      error: errorMessage
    }, 401);
  }
});

/**
 * Custom Sign-Up Endpoint
 * 
 * Uses Better Auth's sign-up API without callbackURL (returns 200 OK).
 * For OAuth flows, generates authorization code and returns the callback URL.
 * 
 * Route: POST /api/auth/custom/sign-up
 */
app.post('/sign-up', async (c) => {
  try {
    const body = await c.req.json();
    const { name, email, password, oauthParams } = body;

    console.log('[Custom Sign-Up] Request:', { email, name, oauthParams });

    // Validate inputs
    if (!email || !password || !name) {
      return c.json({
        success: false,
        error: 'Name, email and password are required'
      }, 400);
    }

    // Use Better Auth's API - NO callbackURL so it returns 200 OK
    const response = await auth.api.signUpEmail({
      body: {
        name,
        email,
        password,
        // NOT passing callbackURL - Better Auth returns 200 instead of 302
      },
      asResponse: true,
    });

    // Check if sign-up was successful
    if (!response.ok) {
      const errorData = await response.json() as { message?: string };
      return c.json({
        success: false,
        error: errorData.message || 'Sign up failed'
      }, response.status as any);
    }

    // Extract cookies from Better Auth response
    const setCookieHeaders: string[] = [];
    if (typeof response.headers.getSetCookie === 'function') {
      setCookieHeaders.push(...response.headers.getSetCookie());
    } else {
      const cookieHeader = response.headers.get('set-cookie');
      if (cookieHeader) {
        setCookieHeaders.push(cookieHeader);
      }
    }

    // Forward all Set-Cookie headers to the client
    setCookieHeaders.forEach(cookie => {
      c.header('Set-Cookie', cookie, { append: true });
    });

    // Parse Better Auth response data
    const data = await response.json() as { user: any; session: any };

    let callbackURL = '/';

    // If OAuth flow, use Better Auth to generate authorization code
    if (oauthParams && oauthParams.client_id && oauthParams.redirect_uri) {
      console.log('[Custom Sign-Up] OAuth flow detected, generating authorization code via Better Auth');

      // Use Better Auth's internal MCP plugin to generate authorization code
      // Create a synthetic request to Better Auth's authorize endpoint
      const authorizeUrl = new URL('http://localhost/api/auth/mcp/authorize');
      Object.entries(oauthParams).forEach(([key, value]) => {
        if (value && typeof value === 'string') {
          authorizeUrl.searchParams.set(key, value);
        }
      });

      // Build headers with the NEW session cookies we just created
      const authorizeHeaders = new Headers(c.req.raw.headers);
      // Add the session cookies from Better Auth response
      setCookieHeaders.forEach(cookie => {
        // Parse cookie to get the cookie name and value for the request
        const cookieParts = cookie.split(';')[0]; // Get "name=value" part
        const existingCookies = authorizeHeaders.get('cookie') || '';
        authorizeHeaders.set('cookie', existingCookies ? `${existingCookies}; ${cookieParts}` : cookieParts);
      });

      const authorizeRequest = new Request(authorizeUrl.toString(), {
        method: 'GET',
        headers: authorizeHeaders,
      });

      // Call Better Auth's authorization endpoint
      const authorizeResponse = await auth.handler(authorizeRequest);

      console.log('[Custom Sign-Up] Better Auth authorize response:', authorizeResponse.status);

      // Better Auth should return 302 redirect to callback with code
      if (authorizeResponse.status === 302) {
        const location = authorizeResponse.headers.get('location');
        if (location) {
          // Check if it's redirecting back to sign-in (auth failed) or to client callback (success)
          if (location.startsWith('/sign-in')) {
            console.log('[Custom Sign-Up] Better Auth redirected back to sign-in, auth might have failed');
            // Don't update callbackURL, let it stay as '/'
          } else {
            callbackURL = location;
            // Safe logging - handle both absolute and relative URLs
            try {
              const url = new URL(location);
              console.log('[Custom Sign-Up] Got callback URL from Better Auth:', url.origin + '/...');
            } catch {
              console.log('[Custom Sign-Up] Got callback URL from Better Auth:', location);
            }
          }
        }
      }
    }

    console.log('[Custom Sign-Up] Success!');

    // Return success with callback URL in response body
    return c.json({
      success: true,
      callbackURL,
      user: data.user,
      session: data.session,
    });

  } catch (error) {
    console.error('[Custom Sign-Up] Error:', error);

    const errorMessage = error instanceof Error
      ? error.message
      : 'Sign up failed';

    return c.json({
      success: false,
      error: errorMessage
    }, 400);
  }
});

export default app;

