# Push Notifications Quick Start

## 1. Generate VAPID Keys (5 minutes)

```bash
npm install web-push
npx web-push generate-vapid-keys
```

Copy the output keys.

## 2. Set Environment Variables (2 minutes)

Create/edit `.env.local` at project root:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Save and restart your dev server!**

## 3. Create Database Table (5 minutes)

Go to Supabase → SQL Editor → New Query

Copy and paste all content from:
```
supabase/migrations/create_push_subscriptions_table.sql
```

Run the query.

## 4. Test It Out (2 minutes)

1. Visit `/portal/profile`
2. Scroll down to "Meldingen" section
3. Click "Meldingen inschakelen"
4. Grant browser permission
5. You should see "✓ Meldingen zijn actief"

**Done! Your push notification system is ready.**

## Next: Send Test Notifications

See `src/app/api/notifications/send/EXAMPLE_route.ts` for template code.

To actually send notifications from your backend, you'll need to:
1. Uncomment the web-push code in EXAMPLE_route.ts
2. Adapt it for your use case
3. Call it from your workout reminders, messages, etc.

## Files You Created

```
Created:
├── src/components/ui/NotificationSettings.tsx    (UI component)
├── src/app/api/notifications/subscribe/route.ts  (API endpoint)
├── src/app/api/notifications/send/EXAMPLE_route.ts
├── supabase/migrations/create_push_subscriptions_table.sql
├── PUSH_NOTIFICATIONS_SETUP.md                    (detailed guide)
└── PUSH_NOTIFICATIONS_QUICKSTART.md               (this file)

Modified:
├── public/sw.js                                   (added push handlers)
└── src/app/portal/profile/page.tsx               (integrated component)
```

## Troubleshooting

**"VAPID public key not found"**
- Restart dev server after setting env vars

**Notifications not working?**
- Check DevTools → Application → Service Workers (should show "9tofit-v1")
- Check browser console for errors
- Verify user is logged in

**Subscription not saving?**
- Check that table was created in Supabase
- Check user is authenticated
- Look at server logs for API errors

## Common Next Steps

- [ ] Test on actual device/browser
- [ ] Create send endpoint for workout reminders
- [ ] Create send endpoint for messages
- [ ] Add notification preferences/settings
- [ ] Set up scheduled notification jobs

---

For detailed information, see `PUSH_NOTIFICATIONS_SETUP.md`
