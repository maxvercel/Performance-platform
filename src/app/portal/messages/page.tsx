'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { nl } from 'date-fns/locale'
import type { Profile } from '@/types'

interface ChatMessage {
  id: string
  coach_id: string
  client_id: string
  sender_id: string
  content: string
  read_at: string | null
  created_at: string
}

export default function MessagesPage() {
  const supabase = createClient()
  const router = useRouter()

  const [userId, setUserId] = useState<string | null>(null)
  const [coachId, setCoachId] = useState<string | null>(null)
  const [coach, setCoach] = useState<Profile | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { load() }, [])
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Realtime subscription for new messages
  useEffect(() => {
    if (!userId || !coachId) return

    const channel = supabase
      .channel(`messages:${userId}:${coachId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `client_id=eq.${userId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage
          // Only add if it's for this conversation and not already in state
          if (newMsg.coach_id === coachId) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev
              return [...prev, newMsg]
            })
            // Auto-mark as read if from coach
            if (newMsg.sender_id === coachId) {
              supabase
                .from('messages')
                .update({ read_at: new Date().toISOString() })
                .eq('id', newMsg.id)
                .then()
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, coachId])

  async function load() {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) { router.push('/portal/login'); return }
      setUserId(user.id)

      const { data: relation, error: relError } = await supabase
        .from('coach_client')
        .select('coach_id')
        .eq('client_id', user.id)
        .eq('active', true)
        .limit(1).single()

      if (relError && relError.code !== 'PGRST116') {
        console.error('Coach relation error:', relError)
        setError('Kan coach-koppeling niet laden.')
        setLoading(false)
        return
      }

      if (!relation) { setLoading(false); return }
      setCoachId(relation.coach_id)

      const { data: coachProfile, error: coachError } = await supabase
        .from('profiles').select('*').eq('id', relation.coach_id).single()

      if (coachError) console.error('Coach profile error:', coachError)
      setCoach(coachProfile as Profile | null)

      const { data: msgs, error: msgsError } = await supabase
        .from('messages')
        .select('*')
        .eq('coach_id', relation.coach_id)
        .eq('client_id', user.id)
        .order('created_at', { ascending: true })

      if (msgsError) {
        console.error('Messages fetch error:', msgsError)
        setError('Kan berichten niet laden. Probeer het opnieuw.')
        setLoading(false)
        return
      }

      setMessages((msgs as ChatMessage[]) ?? [])

      // Markeer als gelezen
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('coach_id', relation.coach_id)
        .eq('client_id', user.id)
        .eq('sender_id', relation.coach_id)
        .is('read_at', null)
    } catch (err) {
      console.error('Messages page load error:', err)
      setError('Er ging iets mis bij het laden van berichten.')
    } finally {
      setLoading(false)
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() || !userId || !coachId) return
    setSending(true)
    setSendError(null)

    try {
      const { data, error: insertError } = await supabase
        .from('messages')
        .insert({
          coach_id: coachId,
          client_id: userId,
          sender_id: userId,
          content: newMessage.trim(),
        })
        .select().single()

      if (insertError) {
        console.error('Send message error:', insertError)
        setSendError('Bericht niet verzonden. Probeer opnieuw.')
        setSending(false)
        return
      }

      if (data) setMessages(prev => [...prev, data as ChatMessage])
      setNewMessage('')
    } catch (err) {
      console.error('Send message error:', err)
      setSendError('Bericht niet verzonden. Controleer je verbinding.')
    } finally {
      setSending(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
      <div className="text-center">
        <p className="text-4xl mb-3">⚠️</p>
        <p className="text-red-400 font-bold mb-2">Fout bij laden</p>
        <p className="text-zinc-500 text-sm mb-4">{error}</p>
        <button onClick={() => { setError(null); setLoading(true); load() }}
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-2 rounded-xl text-sm transition">
          Opnieuw proberen
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col pb-20">

      <div className="bg-zinc-900 px-5 pt-12 pb-4 border-b border-zinc-800 flex-shrink-0">
        <p className="text-orange-500 text-xs font-bold tracking-widest uppercase mb-1">Berichten</p>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center
                          justify-center text-white font-black">
            {coach?.full_name?.[0] ?? 'C'}
          </div>
          <div>
            <h1 className="text-white font-black">{coach?.full_name ?? 'Jouw Coach'}</h1>
            <p className="text-zinc-500 text-xs">Coach</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && !coach && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">👤</p>
            <p className="text-zinc-500 text-sm">Nog geen coach gekoppeld</p>
          </div>
        )}

        {messages.length === 0 && coach && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">💬</p>
            <p className="text-zinc-500 text-sm">Stel je coach een vraag!</p>
          </div>
        )}

        {messages.map(msg => {
          const isMe = msg.sender_id === userId
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                isMe
                  ? 'bg-orange-500 text-white rounded-br-sm'
                  : 'bg-zinc-800 text-white rounded-bl-sm'
              }`}>
                <p className="text-sm">{msg.content}</p>
                <p className={`text-xs mt-1 ${isMe ? 'text-orange-200' : 'text-zinc-500'}`}>
                  {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: nl })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-zinc-900 border-t border-zinc-800 px-4 py-3 flex-shrink-0 mb-16">
        {sendError && (
          <div className="mb-2 px-3 py-2 bg-red-500/15 border border-red-500/30 rounded-xl">
            <p className="text-red-400 text-xs">{sendError}</p>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={e => { setNewMessage(e.target.value); setSendError(null) }}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Stel je coach een vraag..."
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3
                       text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-orange-500"
          />
          <button onClick={sendMessage} disabled={sending || !newMessage.trim()}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white
                       font-bold px-4 rounded-xl text-sm transition">
            {sending ? '...' : '→'}
          </button>
        </div>
      </div>
    </div>
  )
}