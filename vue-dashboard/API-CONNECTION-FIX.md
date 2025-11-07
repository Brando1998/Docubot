# API Connection Fix Documentation

## Problem Analysis

### Root Cause

The `net::ERR_CONNECTION_REFUSED` error when loading `BotManagement.vue` was caused by:

1. **Missing Environment Configuration**: The `useBots.ts` composable uses `VITE_API_URL` environment variable, but it was not set, causing it to default to `http://localhost:8080`.

2. **No Development Proxy**: The Vite development server didn't have API proxy configuration, so requests to `/api/v1/bot-instances` were trying to reach `localhost:8080` directly without proper handling.

3. **Local vs Production URL Mismatch**: Your project runs in production on AWS, but locally the development server didn't know the correct API configuration.

## Solution Implemented

### 1. Environment Configuration Files

Created two environment configuration files:

- **`.env`**: Base configuration for all environments
- **`.env.development`**: Specific configuration for development mode

Both files contain:

```env
VITE_API_URL=http://18.223.102.115:8080
NODE_ENV=development
```

### 2. Vite Direct Connection Configuration

Updated `vite.config.ts` to connect directly to your AWS server:

```typescript
server: {
  host: '0.0.0.0',
  port: 5173,
  // Direct connection to AWS API - no proxy needed
}
```

This configuration:

- Connects directly to `http://18.223.102.115:8080` from the frontend
- No proxy needed since we connect directly to your production server
- Simplifies the connection setup

## How It Works

### Development Mode (Direct AWS Connection)

1. Frontend makes request to `/api/v1/bot-instances`
2. Frontend uses `VITE_API_URL=http://18.223.102.115:8080` from environment
3. Request goes directly to `http://18.223.102.115:8080/api/v1/bot-instances`
4. API responds, and the response is sent back to the frontend
5. Direct connection to your production server for testing

### Local Development Mode (With API Running Locally)

1. Change `VITE_API_URL=http://localhost:8080` in `.env` file
2. Start your API service on port 8080
3. Frontend uses the local API directly
4. Or use the proxy configuration for CORS handling

## Usage Instructions

### For Local Development

1. Make sure your API is running on `http://localhost:8080`
2. Start the Vue development server:
   ```bash
   cd vue-dashboard
   npm run dev
   ```
3. The BotManagement.vue should now load without connection errors

### To Test Against Production AWS

1. Update your `.env` file (already configured):
   ```env
   VITE_API_URL=http://18.223.102.115:8080
   ```
2. Restart the development server
3. The frontend will connect directly to your AWS API

### To Run Locally with Docker

1. Use the project's docker-compose setup:
   ```bash
   docker-compose up
   ```
2. This will start all services including the API on port 8080
3. Start the Vue dev server for frontend development

## Files Modified

1. **Created**: `vue-dashboard/.env` - Environment configuration
2. **Created**: `vue-dashboard/.env.development` - Development-specific configuration
3. **Modified**: `vue-dashboard/vite.config.ts` - Added development proxy

## Troubleshooting

### If you still get connection errors:

1. **Check API is running**: Verify your API service is running on port 8080
2. **Check environment variables**: Ensure `VITE_API_URL` is set correctly
3. **Clear browser cache**: Hard refresh (Ctrl+F5) to reload environment variables
4. **Check Vite proxy logs**: Look for proxy request logs in the terminal

### Common Issues:

- **Port 8080 in use**: Make sure no other service is using port 8080
- **CORS errors in development**: Should be resolved by the proxy configuration
- **API not accessible**: Verify the API service is healthy and accessible

## Additional Notes

- The proxy configuration only applies to development mode
- In production builds, the frontend uses the `VITE_API_URL` directly
- Environment variables are only available with `VITE_` prefix in Vite
- The `__dirname` issue was resolved by using a simpler path alias configuration
