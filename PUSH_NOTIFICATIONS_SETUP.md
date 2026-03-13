# Push Notifications Setup Guide

This guide explains how to complete the push notification system setup for 9toFit.

## Overview

The push notification system consists of:
- Service Worker (`public/sw.js`) - Handles push events and notifications
- NotificationSettings Component - UI for enabling/disabling notifications
- API Route (`/api/notifications/subscribe`) - Saves subscriptions to database
- Profile Page Integration - Notification settings in user profile

## Setup Steps

### 1. Generate VAPID Keys

VAPID keys are required to send push notifications. Generate them using web-push:

```bash
npm install web-push
npx web-push generate-vapid-keys
```

This will output something like:
```
Public Key: BGxxxxxx...
Private Key: xxxx...
```

### 2. Set Environment Variables

Add the generated keys to your `.env.local`:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BGxxxxxx...
VAPID_PRIVATE_KEY=xxxx...
```

**Important:**
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` must be prefixed with `NEXT_PUBLIC_` (it's public-facing)
- `VAPID_PRIVATE_KEY` should never be exposed to the client (keep it server-only)

### 3. Create Supabase Table

Create the `push_subscriptions` table in your Supabase database:

```sql
CREATE TABLE push_subscriptions (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_json JSONB NOT NULL,
  endpoint TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, endpoint)
);

-- Create index for faster lookups
CREATE INDEX idx_push_subscriptions_client_id ON push_subscriptions(client_id);
```

### 4. Install Dependencies

Make sure you have web-push installed for your backend:

```bash
npm install web-push
```

If using TypeScript, also install types:

```bash
npm install --save-dev @types/web-push
```

## File Structure

```
src/
├── components/ui/
│   └── NotificationSettings.tsx          # New: Notification toggle UI
├── app/api/
│   └── notifications/
│       └── subscribe/
│           └── route.ts                  # New: API to save subscriptions
└── app/portal/
    └── profile/
        └── page.tsx                      # Updated: Integrated NotificationSettings
public/
└── sw.js                                 # Updated: Added push event handlers
```

## Component Details

### NotificationSettings Component

Located at: `src/components/ui/NotificationSettings.tsx`

Features:
- Checks browser support for notifications
- Requests user permission for notifications
- Saves subscription to backend via API
- Shows permission status (granted/denied/default)
- Dutch language UI

Usage:
```tsx
import { NotificationSettings } from '@/components/ui/NotificationSettings'

<NotificationSettings onStatusChange={(enabled) => console.log('Notifications:', enabled)} />
```

### API Route: POST /api/notifications/subscribe

Location: `src/app/api/notifications/subscribe/route.ts`

Request body:
```json
{
  "subscription": {
    "endpoint": "https://...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  }
}
```

Response on success (201):
```json
{
  "success": true,
  "message": "Abonnement opgeslagen.",
  "subscription": [...]
}
```

### Service Worker Updates

The service worker now handles:
- `push` events - Displays notifications with custom data
- `notificationclick` events - Opens app and navigates to URL when clicked

Default notification:
- Title: "9toFit"
- Body: "Je hebt een nieuw bericht!"
- Icon/Badge: `/icon.svg`

## Sending Notifications (Backend)

To send notifications from your backend, you'll need to:

1. Fetch subscriptions from the database
2. Use web-push library to send notifications

Example (Node.js/Express):
```javascript
const webpush = require('web-push');

webpush.setVapidDetails(
  'mailto:your-email@example.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const payload = JSON.stringify({
  title: 'Training Herinnering',
  body: 'Je volgende training is morgen om 18:00',
  url: '/portal/workouts/upcoming',
  tag: 'workout-reminder'
});

// Get subscription from database
const subscription = JSON.parse(subscription_json);

await webpush.sendNotification(subscription, payload);
```

## Testing Notifications

1. Go to Profile page (`/portal/profile`)
2. Find the "Meldingen" section
3. Click "Meldingen inschakelen"
4. Grant permission when prompted
5. You should see a success message

## Troubleshooting

### "VAPID public key not found"
- Make sure `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is set in `.env.local`
- Restart your dev server after adding environment variables

### "Pushberichten kunnen niet ingeschakeld worden"
- Check browser console for detailed errors
- Ensure service worker is registered correctly
- Try incognito mode (sometimes easier to test)

### Subscription not saving
- Verify user is authenticated
- Check that `push_subscriptions` table exists
- Check database connection in API route logs

### Notifications not displaying
- Check service worker is active (DevTools → Application → Service Workers)
- Verify push event handler in `sw.js` is present
- Check browser notifications permissions

## Browser Support

Push notifications are supported in:
- Chrome/Edge (Windows, macOS, Android)
- Firefox (Windows, macOS, Android)
- Safari (macOS 13+, requires special setup)

Not supported in:
- Safari on iOS
- IE 11

## Security Notes

1. **VAPID Private Key**: Never expose this key to the client. Keep it in `.env` only.
2. **Subscriptions**: Each subscription endpoint is unique per browser/device.
3. **User Consent**: Always request permission before subscribing.
4. **Validation**: Always validate user authentication on the backend.

## Next Steps

After setup is complete, you can:
1. Create additional API routes to send notifications
2. Add notification preferences (frequency, types, etc.)
3. Implement notification logging and analytics
4. Create cron jobs to send scheduled notifications
