import { supabase } from './supabase'

export interface AssistantMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function askAssistant(messages: AssistantMessage[]): Promise<string> {
  const { data, error } = await supabase.functions.invoke('chat-assistant', {
    body: { messages },
  })
  if (error) {
    // supabase-js's default error on a non-2xx response is a generic
    // "Edge Function returned a non-2xx status code" -- it doesn't surface
    // what the function actually said. error.context is the raw Response,
    // so read its real body to get the specific message instead.
    if ('context' in error && error.context instanceof Response) {
      try {
        const body = await error.context.json()
        throw new Error(body?.error || error.message)
      } catch {
        throw error
      }
    }
    throw error
  }
  if (data?.error) throw new Error(data.error)
  return data.reply as string
}