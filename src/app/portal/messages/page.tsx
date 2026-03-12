'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { nl } from 'date-fns/locale'

export default function MessagesPage() {
  const supabase = createClient()
  const router = useRouter()

  const [userId, setUserId] = useState<string | null>(null)
  const [coachId, setCoachId] = useState<string | null>(null)
  const [coach, setCoach] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { load() }, [])
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/portal/login'); return }
    setUserId(user.id)

    const { data: relation } = await supabase
      .from('coach_client')
      .select('coach_id')
      .eq('client_id', user.id)
      .eq('active', true)
      .limit(1).single()

    if (!relation) { setLoading(false); return }
    setCoachId(relation.coach_id)

    const { data: coachProfile } = await supabase
      .from('profiles').select('*').eq('id', relation.coach_id).single()
    setCoach(coachProfile)

    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('coach_id', relation.coach_id)
      .eq('client_id', user.id)
      .order('created_at', { ascending: true })

    setMessages(msgs ?? [])

    // Markeer als gelezen
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('coach_id', relation.coach_id)
      .eq('client_id', user.id)
      .eq('sender_id', relation.coach_id)
      .is('read_at', null)

    setLoading(false)
  }

  async function sendMessage() {
    if (!newMessage.trim() || !userId || !coachId) return
    setSending(true)

    const { data } = await supabase
      .from('messages')
      .insert({
        coach_id: coachId,
        client_id: userId,
        sender_id: userId,
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

      <div className="bg-zinc-900 border-t border-zinc-800 px-4 py-3 flex-shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
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