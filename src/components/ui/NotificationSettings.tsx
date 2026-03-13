'use client'

import { useState, useEffect } from 'react'
import { Button } from './Button'
import { Card } from './Card'

type NotificationPermission = 'default' | 'granted' | 'denied'

interface NotificationSettingsProps {
  onStatusChange?: (enabled: boolean) => void
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({ onStatusChange }) => {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [loading, setLoading] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)

  // Check if notifications are supported
  useEffect(() => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator
    setIsSupported(supported)

    if (supported && Notification.permission !== 'default') {
      setPermission(Notification.permission as NotificationPermission)
      setSubscribed(Notification.permission === 'granted')
    }
  }, [])

  const getStatusText = () => {
    switch (permission) {
      case 'granted':
        return 'Meldingen zijn ingeschakeld'
      case 'denied':
        return 'Je hebt meldingen uitgeschakeld'
      default:
        return 'Klik op "Inschakelen" om meldingen in te schakelen'
    }
  }

  const getStatusColor = () => {
    switch (permission) {
      case 'granted':
        return 'text-green-400'
      case 'denied':
        return 'text-red-400'
      default:
        return 'text-zinc-400'
    }
  }

  const handleEnableNotifications = async () => {
    if (!isSupported) {
      alert('Je browser ondersteunt meldingen niet')
      return
    }

    setLoading(true)

    try {
      // Request notification permission
      const result = await Notification.requestPermission()
      setPermission(result as NotificationPermission)

      if (result === 'granted') {
        // Register service worker if not already registered
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
          })

          // Subscribe to push notifications
          const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
          if (!publicKey) {
            console.error('VAPID public key not found. Please set NEXT_PUBLIC_VAPID_PUBLIC_KEY environment variable.')
            alert('Pushberichten kunnen niet ingeschakeld worden. VAPID-sleutel ontbreekt.')
            setLoading(false)
            return
          }

          try {
            const subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
            })

            // Save subscription to backend
            const response = await fetch('/api/notifications/subscribe', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ subscription: subscription.toJSON() }),
            })

            if (!response.ok) {
              throw new Error('Failed to save subscription')
            }

            setSubscribed(true)
            onStatusChange?.(true)
          } catch (error) {
            console.error('Failed to subscribe to push notifications:', error)
            alert('Pushberichten konden niet ingeschakeld worden. Probeer het later opnieuw.')
            setPermission('default')
          }
        }
      } else if (result === 'denied') {
        onStatusChange?.(false)
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error)
      alert('Pushberichten konden niet ingeschakeld worden. Probeer het later opnieuw.')
    } finally {
      setLoading(false)
    }
  }

  // Helper function to convert VAPID key from base64 to Uint8Array
  const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  if (!isSupported) {
    return null
  }

  return (
    <Card className="space-y-3">
      <div>
        <p className="text-white font-bold">Meldingen</p>
        <p className="text-zinc-500 text-xs mt-0.5">Ontvang meldingen voor trainingsherinneringen en berichten</p>
      </div>

      <div className={`py-2 ${getStatusColor()}`}>
        <p className="text-xs font-medium">{getStatusText()}</p>
      </div>

      {permission !== 'granted' && (
        <Button onClick={handleEnableNotifications} disabled={loading} loading={loading} fullWidth>
          {loading ? 'Meldingen inschakelen...' : 'Meldingen inschakelen'}
        </Button>
      )}

      {permission === 'granted' && (
        <div className="text-xs text-green-400 bg-green-500/5 border border-green-500/30 rounded-lg p-3">
          <p className="font-medium">✓ Meldingen zijn actief</p>
          <p className="text-zinc-400 mt-1">Je ontvangt nu trainingsherinneringen en berichten</p>
        </div>
      )}

      {permission === 'denied' && (
        <div className="text-xs text-red-400 bg-red-500/5 border border-red-500/30 rounded-lg p-3">
          <p className="font-medium">⚠ Meldingen zijn geblokkeerd</p>
          <p className="text-zinc-400 mt-1">
            Je hebt meldingen geweigerd. Je kunt dit wijzigen in je browserinstellingen.
          </p>
        </div>
      )}
    </Card>
  )
}
