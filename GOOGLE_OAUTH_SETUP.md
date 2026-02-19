# Google Calendar & OAuth Integration Setup

## Overview

This property management application now uses Google OAuth for authentication and Google Calendar integration. The hardcoded email credentials have been removed for better security.

## Setup Instructions

### 1. Google Cloud Console Setup

1. **Create a Google Cloud Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one

2. **Enable APIs**:
   - Enable Google Calendar API
   - Enable Google+ API (for OAuth)

3. **Create OAuth 2.0 Credentials**:
   - Go to "Credentials" section
   - Click "Create Credentials" → "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:5173` (for development)
     - `https://your-domain.com` (for production)

4. **Get your credentials**:
   - Copy the Client ID
   - Copy the Client Secret

### 2. Environment Variables Setup

Update your `.env` file with the following variables:

```env
# Supabase Configuration (existing)
VITE_SUPABASE_PROJECT_ID="your_project_id"
VITE_SUPABASE_PUBLISHABLE_KEY="your_publishable_key"
VITE_SUPABASE_URL="https://your_project.supabase.co"

# Google OAuth Configuration (new)
VITE_GOOGLE_CLIENT_ID="your-google-client-id"
VITE_GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Google Calendar API (used as fallback when OAuth is not available)
GOOGLE_CALENDAR_API_KEY="your-google-calendar-api-key"
```

### 3. Supabase Configuration

1. **Configure OAuth Provider**:
   - Go to your Supabase dashboard
   - Navigate to Authentication → Providers
   - Enable Google provider
   - Add your Google Client ID and Client Secret

2. **Set redirect URLs**:
   - Add your application URLs in the redirect URL settings

## Features

### Authentication
- **Google OAuth**: Users sign in with their Google accounts
- **Automatic redirection**: Seamless login experience
- **Session management**: Persistent authentication across browser sessions

### Calendar Integration
- **Google Calendar sync**: Automatic synchronization with user's Google Calendar
- **Real-time updates**: Calendar events update automatically
- **Read permissions**: Application requests read-only access to calendar data

### Security Improvements
- **No hardcoded credentials**: All sensitive data moved to environment variables
- **Token-based authentication**: OAuth tokens used for secure API access
- **Proper session handling**: Secure token storage and management

## User Experience

1. **Landing Page**: Users see a clean login interface with Google sign-in button
2. **Google OAuth**: Clicking "Continue with Google" opens Google's OAuth flow
3. **Permission Grant**: Users grant calendar access permissions
4. **Automatic Login**: Users are logged in and redirected to the application
5. **Calendar Sync**: Google Calendar events automatically appear in the interface

## Development Notes

### Authentication Flow
1. User clicks "Continue with Google"
2. Lovable auth redirects to Google OAuth
3. User grants permissions
4. Google redirects back with tokens
5. Supabase session is created with Google user data
6. User is logged into the application

### Permissions Requested
- `openid`: Basic user identification
- `email`: User's email address
- `profile`: User's basic profile information
- `https://www.googleapis.com/auth/calendar.readonly`: Read-only access to Google Calendar

### Calendar API Usage
- **Primary method**: OAuth token from user's Google account
- **Fallback method**: Google Calendar API key (for public calendars)
- **Scope**: Read-only access to calendar events

## Troubleshooting

### Common Issues

1. **OAuth Redirect Mismatch**:
   - Ensure redirect URIs in Google Console match your application URLs
   - Check both development and production URLs

2. **API Not Enabled**:
   - Verify Google Calendar API is enabled in Google Cloud Console
   - Check API quotas and usage limits

3. **Permission Errors**:
   - Ensure calendar permissions are granted during OAuth flow
   - Users may need to re-authorize if permissions change

4. **Environment Variables**:
   - Double-check all environment variables are set correctly
   - Restart development server after changing environment variables

### Testing

1. **Local Development**:
   ```bash
   npm run dev
   # Visit http://localhost:5173
   ```

2. **OAuth Testing**:
   - Test with different Google accounts
   - Verify calendar data appears correctly
   - Check logout functionality

3. **Production Deployment**:
   - Update redirect URIs for production domain
   - Ensure environment variables are set in production

## Migration Notes

### Changes Made
1. **Removed hardcoded authentication**:
   - Deleted email/password login form
   - Removed hardcoded user credentials

2. **Added Google OAuth**:
   - Integrated Lovable auth for Google OAuth
   - Added automatic session management

3. **Enhanced calendar integration**:
   - Improved OAuth token handling
   - Better error messaging for calendar access

### Breaking Changes
- **No backward compatibility**: Old email/password authentication has been completely removed
- **Google account required**: Users must have Google accounts to access the application
- **Calendar permissions**: Users must grant calendar access for full functionality

## Security Considerations

1. **Token Storage**: OAuth tokens are stored securely in localStorage and Supabase session
2. **API Keys**: Server-side API keys are kept in environment variables
3. **Permissions**: Minimal required permissions requested from Google
4. **Session Management**: Proper session cleanup on logout

## Future Enhancements

1. **Write Permissions**: Could request calendar write permissions for event creation
2. **Multiple Calendars**: Support for multiple Google calendars
3. **Offline Access**: Store refresh tokens for offline calendar access
4. **Admin Controls**: Role-based access control for different user types