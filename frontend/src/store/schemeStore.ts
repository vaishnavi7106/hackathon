import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ChatMsg {
  role: 'user' | 'bot'
  text: string
  schemeIds?: string[]
}

interface SchemeStore {
  lang: 'ta' | 'en'
  savedIds: string[]
  appliedIds: string[]
  checklistState: Record<string, string[]>
  chatHistory: ChatMsg[]
  chatConvId: string | undefined

  setLang: (lang: 'ta' | 'en') => void
  toggleLang: () => void
  saveScheme: (id: string) => void
  unsaveScheme: (id: string) => void
  isSaved: (id: string) => boolean
  markApplied: (id: string) => void
  isApplied: (id: string) => boolean
  toggleDoc: (schemeId: string, doc: string) => void
  isDocChecked: (schemeId: string, doc: string) => boolean
  getCheckedDocs: (schemeId: string) => string[]
  addChatMsg: (msg: ChatMsg) => void
  setChatConvId: (id: string) => void
  clearChatHistory: () => void
  resetUserData: () => void
}

export const useSchemeStore = create<SchemeStore>()(
  persist(
    (set, get) => ({
      lang: 'ta',
      savedIds: [],
      appliedIds: [],
      checklistState: {},
      chatHistory: [],
      chatConvId: undefined,

      setLang: (lang) => set({ lang }),
      toggleLang: () => set((s) => ({ lang: s.lang === 'ta' ? 'en' : 'ta' })),

      saveScheme: (id) => set((s) => ({
        savedIds: s.savedIds.includes(id) ? s.savedIds : [...s.savedIds, id],
      })),
      unsaveScheme: (id) => set((s) => ({
        savedIds: s.savedIds.filter((x) => x !== id),
      })),
      isSaved: (id) => get().savedIds.includes(id),

      markApplied: (id) => set((s) => ({
        appliedIds: s.appliedIds.includes(id) ? s.appliedIds : [...s.appliedIds, id],
      })),
      isApplied: (id) => get().appliedIds.includes(id),

      toggleDoc: (schemeId, doc) => set((s) => {
        const current = s.checklistState[schemeId] || []
        const updated = current.includes(doc)
          ? current.filter((d) => d !== doc)
          : [...current, doc]
        return { checklistState: { ...s.checklistState, [schemeId]: updated } }
      }),
      isDocChecked: (schemeId, doc) => (get().checklistState[schemeId] || []).includes(doc),
      getCheckedDocs: (schemeId) => get().checklistState[schemeId] || [],

      addChatMsg: (msg) => set((s) => ({
        chatHistory: [...s.chatHistory.slice(-49), msg],
      })),
      setChatConvId: (id) => set({ chatConvId: id }),
      clearChatHistory: () => set({ chatHistory: [], chatConvId: undefined }),
      resetUserData: () => set({
        savedIds: [],
        appliedIds: [],
        checklistState: {},
        chatHistory: [],
        chatConvId: undefined,
      }),
    }),
    {
      name: 'uzhavar-schemes',
    },
  ),
)
