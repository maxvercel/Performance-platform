/**
 * EXAMPLE API ROUTE FOR SENDING PUSH NOTIFICATIONS
 *
 * This is an example showing how to send push notifications to subscribed users.
 * Copy and adapt this code to create your own notification endpoints.
 *
 * DO NOT use this file directly - it's just a template!
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// You'll need to install web-push: npm install web-push
// And install types: npm install --save-dev @types/web-push
// import * as webpush from 'web-push'

export async function POST(request: Request) {
  try {
    // IMPORTANT: Add authentication check here!
    // Only admins or coaches should be able to send notifications
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.role !== 'coach') {
      return NextResponse.json(
        { error: 'Unauthorized. Only coaches can send notifications.' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { userId, title, body: messageBody, url, tag } = body

    if (!userId || !title || !messageBody) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, title, body' },
        { status: 400 }
      )
    }

    // TODO: Uncomment and configure web-push
    /*
    // Configure web-push with VAPID keys
    webpush.setVapidDetails(
      'mailto:your-email@example.com',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    )

    // Fetch all subscriptions for the target user
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('subscription_json')
      .eq('client_id', userId)

    if (fetchError) {
      console.error('Error fetching subscriptions:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch subscriptions' },
        { status: 500 }
      )
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json(
        { message: 'No active subscriptions for this user' },
        { status: 200 }
      )
    }

    // Create notification payload
    const payload = JSON.stringify({
      title,
      body: messageBody,
      url: url || '/portal/dashboard',
      tag: tag || 'default',
    })

    // Send notification to all subscriptions
    const sendPromises = subscriptions.map((sub) => {
      const subscription = sub.subscription_json
      return webpush.sendNotification(subscription, payload).catch((error) => {
        // Handle subscription errors (e.g., expired)
        console.error('Failed to send notification:', error)

        // Optionally: delete expired subscriptions
        if (error.statusCode === 410) {
          supabase
            .from('push_subscriptions')
            .delete()
            .eq('subscription_json', subscription)
            .catch(console.error)
        }

        return null
      })
    })

    const results = await Promise.all(sendPromises)
    const successful = results.filter((r) => r !== null).length

    return NextResponse.json(
      {
        success: true,
        message: `Notification sent to ${successful} subscription(s)`,
        total: subscriptions.length,
        successful,
      },
      { status: 200 }
    )
    */

    // Temporary response until web-push is configured
    return NextResponse.json(
      {
        error: 'This endpoint is not yet configured. Please uncomment the web-push code and set up your VAPID keys.'
      },
      { status: 501 }
    )
  } catch (error) {
    console.error('Send notification error:', error)
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    )
  }
}

/**
 * USAGE EXAMPLES:
 *
 * 1. Send a workout reminder:
 *    POST /api/notifications/send
 *    {
 *      "userId": "user-uuid",
 *      "title": "Training Herinnering",
 *      "body": "Je volgende training is morgen om 18:00",
 *      "url": "/portal/workouts/upcoming",
 *      "tag": "workout-reminder"
 *    }
 *
 * 2. Send a message notification:
 *    POST /api/notifications/send
 *    {
 *      "userId": "user-uuid",
 *      "title": "Nieuw bericht van Coach",
 *      "body": "Je coach heeft je een bericht gestuurd",
 *      "url": "/portal/messages",
 *      "tag": "new-message"
 *    }
 *
 * 3. Send a habit check-in reminder:
 *    POST /api/notifications/send
 *    {
 *      "userId": "user-uuid",
 *      "title": "Habitscheck",
 *      "body": "Vergeet niet je dagelijkse gewoonten in te vullen",
 *      "url": "/portal/habits",
 *      "tag": "habit-reminder"
 *    }
 */
