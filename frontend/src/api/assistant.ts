import { api } from './client'

export interface AssistantChatRequest {
  message: string
  farmer_context?: string
  conversation_id?: string | null
}

export interface AssistantChatResponse {
  response: string
  conversation_id: string
}

export const assistantApi = {
  chat: (body: AssistantChatRequest) =>
    api.post<AssistantChatResponse>('/assistant/chat', body),
}
