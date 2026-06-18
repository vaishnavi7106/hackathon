import { useState, useCallback, useRef, useEffect } from 'react'

interface UseSpeechSynthesisReturn {
  isSupported: boolean
  isSpeaking: boolean
  isPaused: boolean
  currentId: string | null
  speak: (text: string, id: string) => void
  stop: () => void
  toggle: (text: string, id: string) => void
}

export function useSpeechSynthesis(lang: 'ta' | 'en' = 'ta'): UseSpeechSynthesisReturn {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSupported) window.speechSynthesis.cancel()
    }
  }, [isSupported])

  function findTamilVoice(): SpeechSynthesisVoice | null {
    if (!isSupported) return null
    const voices = window.speechSynthesis.getVoices()
    // Prefer Tamil voices
    const tamilVoice = voices.find((v) =>
      v.lang.startsWith('ta') || v.lang === 'ta-IN'
    )
    // Fallback: any Indian English voice
    const indianVoice = voices.find((v) => v.lang === 'en-IN')
    return tamilVoice || indianVoice || null
  }

  const speak = useCallback((text: string, id: string) => {
    if (!isSupported) return
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang === 'ta' ? 'ta-IN' : 'en-IN'
    utterance.rate = 0.9
    utterance.pitch = 1.0
    utterance.volume = 1.0

    // Try to set a Tamil voice (voices may not be loaded yet)
    const voice = findTamilVoice()
    if (voice) utterance.voice = voice

    utterance.onstart = () => {
      setIsSpeaking(true)
      setIsPaused(false)
      setCurrentId(id)
    }

    utterance.onend = () => {
      setIsSpeaking(false)
      setIsPaused(false)
      setCurrentId(null)
    }

    utterance.onerror = () => {
      setIsSpeaking(false)
      setIsPaused(false)
      setCurrentId(null)
    }

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [isSupported, lang])

  const stop = useCallback(() => {
    if (!isSupported) return
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
    setIsPaused(false)
    setCurrentId(null)
  }, [isSupported])

  const toggle = useCallback((text: string, id: string) => {
    if (!isSupported) return

    if (currentId === id && isSpeaking && !isPaused) {
      window.speechSynthesis.pause()
      setIsPaused(true)
    } else if (currentId === id && isPaused) {
      window.speechSynthesis.resume()
      setIsPaused(false)
    } else {
      speak(text, id)
    }
  }, [isSupported, currentId, isSpeaking, isPaused, speak])

  return { isSupported, isSpeaking, isPaused, currentId, speak, stop, toggle }
}
