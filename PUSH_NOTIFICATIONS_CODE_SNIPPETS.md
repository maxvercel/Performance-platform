# Push Notifications - Code Snippets & Examples

## Setup & Configuration

### Generate VAPID Keys
```bash
npm install web-push
npx web-push generate-vapid-keys
```

### Environment Variables (.env.local)
```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Install web-push (Backend)
```bash
npm install web-push
npm install --save-dev @types/web-push
```

---

## Service Worker Events

### Push Event Handler (in sw.js)
```javascript
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {
    title: '9toFit',
    body: 'Je hebt een nieuw bericht!'
  };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: data.tag || 'default',
      data: { url: data.url || '/portal/dashboard' },
    })
  );
});
```

### Notification Click Handler (in sw.js)
```javascript
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/portal/dashboard';
  event.waitUntil(clients.openWindow(url));
});
```

---

## Database

### Create Table (SQL)
```sql
CREATE TABLE push_subscriptions (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_json JSONB NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_subscription_per_user UNIQUE(client_id, endpoint)
);

CREATE INDEX idx_push_subscriptions_client_id ON push_subscriptions(client_id);
CREATE INDEX idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);
```

### Insert Subscription
```sql
INSERT INTO push_subscriptions (client_id, subscription_json, endpoint, created_at, updated_at)
VALUES (
  'user-uuid',
  '{"endpoint":"https://...","keys":{"p256dh":"...","auth":"..."}}'::jsonb,
  'https://...',
  NOW(),
  NOW()
)
ON CONFLICT (endpoint) DO UPDATE SET
  updated_at = NOW();
```

### Query User Subscriptions
```sql
SELECT subscription_json FROM push_subscriptions WHERE client_id = 'user-uuid';
```

---

## API Endpoints

### Subscribe Endpoint (POST /api/notifications/subscribe)
```typescript
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { subscription } = await request.json()

  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert({
      client_id: user.id,
      subscription_json: subscription,
      created_at: new Date().toISOString(),
    })
    .select()

  return NextResponse.json({ success: true, subscription: data }, { status: 201 })
}
```

### Send Notification Endpoint Example
```typescript
import * as webpush from 'web-push'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  webpush.setVapidDetails(
    'mailto:your-email@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )

  const { userId, title, body, url, tag } = await request.json()

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('subscription_json')
    .eq('client_id', userId)

  const payload = JSON.stringify({ title, body, url, tag })

  const results = await Promise.all(
    subscriptions?.map((sub) =>
      webpush.sendNotification(sub.subscription_json, payload)
    ) || []
  )

  return NextResponse.json({
    success: true,
    sent: results.length,
  })
}
```

---

## React Component

### Using NotificationSettings Component
```tsx
import { NotificationSettings } from '@/components/ui/NotificationSettings'

export default function ProfilePage() {
  return (
    <div>
      <NotificationSettings
        onStatusChange={(enabled) => {
          console.log('Notifications:', enabled)
        }}
      />
    </div>
  )
}
```

### Manual Implementation Example
```tsx
'use client'
import { useState } from 'react'

export function ManualNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default')

  const handleEnable = async () => {
    const result = await Notification.requestPermission()
    setPermission(result)

    if (result === 'granted' && 'serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.register('/sw.js')

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      })

      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      })
    }
  }

  return (
    <button onClick={handleEnable}>
      {permission === 'granted' ? 'Enabled' : 'Enable Notifications'}
    </button>
  )
}
```

---

## Sending Notifications

### From Node.js Backend
```javascript
const webpush = require('web-push')

async function sendWorkoutReminder(userId, workoutName, workoutTime) {
  webpush.setVapidDetails(
    'mailto:coach@9tofit.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )

  // Get subscriptions from database
  const subscriptions = await db
    .from('push_subscriptions')
    .select('subscription_json')
    .eq('client_id', userId)

  const payload = JSON.stringify({
    title: 'Training Herinnering',
    body: `Je ${workoutName} is ${workoutTime}`,
    url: '/portal/workouts/upcoming',
    tag: 'workout-reminder-' + workoutTime,
  })

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub.subscription_json, payload)
    } catch (error) {
      if (error.statusCode === 410) {
        // Subscription expired, delete it
        await db
          .from('push_subscriptions')
          .delete()
          .eq('subscription_json', sub.subscription_json)
      }
    }
  }
}
```

### From Next.js API Route
```typescript
// POST /api/notifications/send-workout-reminder
export async function POST(request: Request) {
  const { userId, workoutName, workoutTime } = await request.json()

  // Verify coach/admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user?.user_metadata?.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Send notification using sendWorkoutReminder function
  await sendWorkoutReminder(userId, workoutName, workoutTime)

  return NextResponse.json({ success: true })
}
```

---

## Notification Payloads

### Workout Reminder
```json
{
  "title": "Training Herinnering",
  "body": "Je volgende training is morgen om 18:00",
  "url": "/portal/workouts/upcoming",
  "tag": "workout-reminder-tomorrow"
}
```

### Message Notification
```json
{
  "title": "Nieuw bericht van Coach",
  "body": "Je coach heeft je een bericht gestuurd",
  "url": "/portal/messages",
  "tag": "new-message"
}
```

### Habit Check-in
```json
{
  "title": "Dagelijkse Gewoonten",
  "body": "Vergeet niet je dagelijkse gewoonten in te vullen",
  "url": "/portal/habits",
  "tag": "habit-reminder"
}
```

### Progress Update
```json
{
  "title": "Voortgang Update",
  "body": "Je 4-wekelijkse voortgangscheck is klaar",
  "url": "/portal/progress",
  "tag": "progress-check"
}
```

---

## Helper Functions

### Convert VAPID Key (Client-side)
```typescript
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
```

### Check Notification Support
```typescript
function isNotificationSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator
}
```

### Check Current Permission
```typescript
function getNotificationPermission(): NotificationPermission {
  return Notification.permission
}
```

### Send Test Notification (from backend)
```bash
curl -X POST http://localhost:3000/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid",
    "title": "Test Notification",
    "body": "This is a test notification",
    "url": "/portal/dashboard",
    "tag": "test"
  }'
```

---

## Error Handling

### Handle Subscription Errors
```typescript
try {
  await webpush.sendNotification(subscription, payload)
} catch (error) {
  if (error.statusCode === 410) {
    // Gone - subscription no longer valid
    await deleteSubscription(subscriptionId)
  } else if (error.statusCode === 401) {
    // Unauthorized - invalid keys
    console.error('VAPID keys invalid')
  } else if (error.statusCode === 429) {
    // Too Many Requests - rate limited
    console.error('Rate limited, retry later')
  } else {
    console.error('Failed to send notification:', error)
  }
}
```

### Handle Permission Errors
```typescript
try {
  const permission = await Notification.requestPermission()
  if (permission === 'granted') {
    // Subscribe to push
  } else if (permission === 'denied') {
    console.log('User denied notifications')
  }
} catch (error) {
  console.error('Failed to request notification permission:', error)
}
```

---

## Testing

### Test Subscription Flow
1. Open DevTools Console
2. Check service worker: `navigator.serviceWorker.getRegistrations()`
3. Check subscription: `await registration.pushManager.getSubscription()`
4. Send test via API

### View Database Subscriptions
```sql
SELECT
  client_id,
  endpoint,
  created_at,
  updated_at
FROM push_subscriptions
ORDER BY created_at DESC
LIMIT 10;
```

### Clear Subscriptions for Testing
```sql
DELETE FROM push_subscriptions WHERE client_id = 'test-user-uuid';
```

---

For complete setup guide, see `PUSH_NOTIFICATIONS_SETUP.md`
