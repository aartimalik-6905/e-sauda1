import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from '../lib/notifications'
import { AppNotification } from '../types'

// Centralizes notification state so the Navbar bell doesn't carry fetch/subscribe/
// mark-read logic directly -- same reasoning as useSavedListings.ts.
export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setNotifications([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchNotifications(user.id)
      .then((rows) => {
        if (!cancelled) setNotifications(rows)
      })
      .catch(() => {
        if (!cancelled) setNotifications([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    // New rows (a message just landed, a report was reviewed) show up
    // instantly instead of only appearing after the next page load.
    const unsubscribe = subscribeToNotifications(user.id, (n) => {
      setNotifications((prev) => [n, ...prev])
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [user])

  const unreadCount = notifications.filter((n) => !n.read).length

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    try {
      await markNotificationRead(id)
    } catch {
      // Not worth rolling back for a read-receipt -- worst case it re-shows as unread
      // next fetch, which is harmless.
    }
  }, [])

  const markAllRead = useCallback(async () => {
    if (!user) return
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    try {
      await markAllNotificationsRead(user.id)
    } catch {
      // Same reasoning as above.
    }
  }, [user])

  return { notifications, unreadCount, loading, markRead, markAllRead }
}
