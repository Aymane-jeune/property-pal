import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-google-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const calendarId = url.searchParams.get('calendarId') || 'primary';
    const timeMin = url.searchParams.get('timeMin') || new Date().toISOString();
    const timeMax = url.searchParams.get('timeMax');
    const maxResults = url.searchParams.get('maxResults') || '100';

    if (req.method === 'POST') {
      const body = await req.json();
      const { action, refresh_token } = body;
      console.log('Action received:', action);

      if (action === 'refresh') {
        if (!refresh_token) {
          console.error('Refresh token missing in request body');
          return new Response(JSON.stringify({ error: 'Refresh token is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const GOOGLE_CLIENT_ID = Deno.env.get('VITE_GOOGLE_CLIENT_ID');
        const GOOGLE_CLIENT_SECRET = Deno.env.get('VITE_GOOGLE_CLIENT_SECRET');

        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
          console.error('Google credentials missing: CLIENT_ID:', !!GOOGLE_CLIENT_ID, 'CLIENT_SECRET:', !!GOOGLE_CLIENT_SECRET);
          return new Response(JSON.stringify({
            error: 'Server configuration error: Google credentials missing',
            details: 'Make sure VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_CLIENT_SECRET are set in Supabase secrets.'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log('Attempting to refresh Google token...');
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            refresh_token: refresh_token,
            grant_type: 'refresh_token',
          }),
        });

        const tokenData = await tokenResponse.json();
        console.log('Google token response status:', tokenResponse.status);

        if (!tokenResponse.ok) {
          console.error('Token refresh failed:', tokenData);
          return new Response(JSON.stringify({ error: 'Failed to refresh Google token', details: tokenData }), {
            status: tokenResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log('Token refreshed successfully');
        return new Response(JSON.stringify({
          access_token: tokenData.access_token,
          expires_in: tokenData.expires_in,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'insert') {
        const googleToken = req.headers.get('x-google-token');
        const { event } = body;

        if (!googleToken) {
          return new Response(JSON.stringify({ error: 'Authentication required' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (!event) {
          return new Response(JSON.stringify({ error: 'Event data required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log('Inserting event into Google Calendar...');
        const insertRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${googleToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });

        const insertData = await insertRes.json();
        console.log('Google insert response status:', insertRes.status);

        if (!insertRes.ok) {
          console.error('Failed to insert event:', insertData);
          return new Response(JSON.stringify({ error: 'Failed to insert Google event', details: insertData }), {
            status: insertRes.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify(insertData), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'update') {
        const googleToken = req.headers.get('x-google-token');
        const { eventId, event } = body;

        if (!googleToken) {
          return new Response(JSON.stringify({ error: 'Authentication required' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (!eventId || !event) {
          return new Response(JSON.stringify({ error: 'Event ID and data required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log('Updating event in Google Calendar:', eventId);
        const updateRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${googleToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });

        const updateData = await updateRes.json();
        console.log('Google update response status:', updateRes.status);

        if (!updateRes.ok) {
          console.error('Failed to update event:', updateData);
          return new Response(JSON.stringify({ error: 'Failed to update Google event', details: updateData }), {
            status: updateRes.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify(updateData), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Check for OAuth provider token first, then fall back to API key
    const googleToken = req.headers.get('x-google-token');

    let apiUrl: string;

    if (googleToken) {
      // OAuth mode: use the user's Google access token
      const params = new URLSearchParams({
        timeMin,
        maxResults,
        singleEvents: 'true',
        orderBy: 'startTime',
      });
      if (timeMax) params.set('timeMax', timeMax);

      apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;

      console.log('Fetching Google Calendar via OAuth:', apiUrl);
      const response = await fetch(apiUrl, {
        headers: { 'Authorization': `Bearer ${googleToken}` },
      });
      const data = await response.json();

      if (!response.ok) {
        const hint = response.status === 403
          ? ' — Calendar access denied. Make sure you granted calendar permissions.'
          : response.status === 404
            ? ' — Calendar not found. Ensure the token has permissions to access the primary calendar. Try signing in again with the full "calendar" scope.'
            : '';
        return new Response(JSON.stringify({
          error: `Google Calendar API error [${response.status}]${hint}`,
          details: data,
          url: apiUrl // Include URL for debugging
        }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // API key fallback mode
      const GOOGLE_CALENDAR_API_KEY = Deno.env.get('GOOGLE_CALENDAR_API_KEY');
      if (!GOOGLE_CALENDAR_API_KEY) {
        return new Response(JSON.stringify({ error: 'No authentication method available. Please sign in with Google.' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const params = new URLSearchParams({
        key: GOOGLE_CALENDAR_API_KEY,
        timeMin,
        maxResults,
        singleEvents: 'true',
        orderBy: 'startTime',
      });
      if (timeMax) params.set('timeMax', timeMax);

      apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (!response.ok) {
        const hint = response.status === 404
          ? ' — Calendar not found. Make sure the calendar is set to PUBLIC in Google Calendar settings.'
          : response.status === 403
            ? ' — Access denied. Verify your API key has Google Calendar API enabled.'
            : '';
        return new Response(JSON.stringify({ error: `Google Calendar API error [${response.status}]${hint}`, details: data }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
