import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BUCKET = 'my_documents_buckets';
const GCS_API = `https://storage.googleapis.com/storage/v1/b/${BUCKET}`;
const GCS_UPLOAD_API = `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}`;

async function getAccessToken(): Promise<string> {
  const clientEmail = Deno.env.get('GCS_CLIENT_EMAIL');
  const privateKeyRaw = Deno.env.get('GCS_PRIVATE_KEY');
  if (!clientEmail || !privateKeyRaw) throw new Error('GCS credentials not configured');

  const privateKeyPem = privateKeyRaw.replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/devstorage.full_control',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const enc = new TextEncoder();
  const b64url = (data: Uint8Array) =>
    base64Encode(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const headerB64 = b64url(enc.encode(JSON.stringify(header)));
  const claimB64 = b64url(enc.encode(JSON.stringify(claim)));
  const unsignedToken = `${headerB64}.${claimB64}`;

  // Import private key
  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const keyData = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(unsignedToken));
  const signatureB64 = b64url(new Uint8Array(signature));
  const jwt = `${unsignedToken}.${signatureB64}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`);
  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = await getAccessToken();
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // LIST files
    if (action === 'list') {
      const prefix = url.searchParams.get('prefix') || '';
      const res = await fetch(`${GCS_API}/o?prefix=${encodeURIComponent(prefix)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`GCS list error [${res.status}]: ${JSON.stringify(data)}`);

      const items = (data.items || []).map((item: any) => ({
        name: item.name,
        size: item.size,
        updated: item.updated,
        contentType: item.contentType,
      }));
      return new Response(JSON.stringify({ items }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // UPLOAD file
    if (action === 'upload') {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      const path = formData.get('path') as string;
      if (!file || !path) throw new Error('Missing file or path');

      const arrayBuffer = await file.arrayBuffer();
      const res = await fetch(
        `${GCS_UPLOAD_API}/o?uploadType=media&name=${encodeURIComponent(path)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: arrayBuffer,
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(`GCS upload error [${res.status}]: ${JSON.stringify(data)}`);

      return new Response(JSON.stringify({ success: true, name: data.name, size: data.size }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE file
    if (action === 'delete') {
      const path = url.searchParams.get('path');
      if (!path) throw new Error('Missing path');

      const res = await fetch(`${GCS_API}/o/${encodeURIComponent(path)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok && res.status !== 404) {
        const data = await res.json();
        throw new Error(`GCS delete error [${res.status}]: ${JSON.stringify(data)}`);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DOWNLOAD (signed URL)
    if (action === 'download') {
      const path = url.searchParams.get('path');
      if (!path) throw new Error('Missing path');

      // Return a direct media link
      const mediaUrl = `https://storage.googleapis.com/${BUCKET}/${encodeURIComponent(path)}?access_token=${token}`;
      return new Response(JSON.stringify({ url: mediaUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action. Use: list, upload, delete, download' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('GCS Storage error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
