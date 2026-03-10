'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { nl } from 'date-fns/locale'

export default function ClientDetail() {
  const supabase = createClient()
  const router = useRouter()
  const { id: clientId } = useParams<{ id: string }>()

  const [coach, setCoach] = useState<any>(null)
  const [client, setClient] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { load() }, [clientId])
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/portal/login'); return }
    setCoach({ id: user.id })

    const { data: clientProfile } = await supabase
      .from('profiles').select('*').eq('id', clientId).single()
    setClient(clientProfile)

    // Berichten tussen coach en client in beide richtingen
    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${clientId}),and(sender_id.eq.${clientId},receiver_id.eq.${user.id})`)
      .order('sent_at', { ascending: true })

    setMessages(msgs ?? [])

    // Markeer berichten van client als gelezen
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', clientId)
      .eq('receiver_id', user.id)
      .is('read_at', null)

    setLoading(false)
  }

  async function sendMessage() {
    if (!newMessage.trim() || !coach) return
    setSending(true)

    const { data } = await supabase
      .from('messages')
      .insert({
        sender_id: coach.id,
        receiver_id: clientId,
        content: newMessage.trim(),
      })
      .select().single()

    if (data) setMessages(prev => [...prev, data])
    setNewMessage('')
    setSending(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col pb-24">

      <div className="bg-zinc-900 px-5 pt-12 pb-4 border-b border-zinc-800 flex-shrink-0">
        <button onClick={() => router.push('/portal/coach')}
          className="text-zinc-500 text-xs mb-2 flex items-center gap-1">
          ← Terug
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white font-black text-lg">
            {client?.full_name?.[0] ?? '?'}
          </div>
          <div>
            <h1 className="text-white font-black text-lg">{client?.full_name}</h1>
            <p className="text-zinc-500 text-xs">{client?.email}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">💬</p>
            <p className="text-zinc-500 text-sm">Nog geen berichten</p>
            <p className="text-zinc-600 text-xs mt-1">Stuur een bericht naar {client?.full_name?.split(' ')[0]}</p>
          </div>
        )}

        {messages.map(msg => {
          const isCoach = msg.sender_id === coach?.id
          const timestamp = msg.sent_at || msg.inserted_at
          return (
            <div key={msg.id} className={`flex ${isCoach ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                isCoach ? 'bg-orange-500 text-white rounded-br-sm' : 'bg-zinc-800 text-white rounded-bl-sm'
              }`}>
                <p className="text-sm">{msg.content}</p>
                {timestamp && (
                  <p className={`text-xs mt-1 ${isCoach ? 'text-orange-200' : 'text-zinc-500'}`}>
                    {formatDistanceToNow(parseISO(timestamp), { addSuffix: true, locale: nl })}
                  </p>
                )}
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-zinc-900 border-t border-zinc-800 px-4 py-3 flex-shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder={`Bericht aan ${client?.full_name?.split(' ')[0]}...`}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-orange-500"
          />
          <button onClick={sendMessage} disabled={sending || !newMessage.trim()}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-bold px-4 rounded-xl text-sm transition">
            {sending ? '...' : '→'}
          </button>
        </div>
      </div>
    </div>
  )
}