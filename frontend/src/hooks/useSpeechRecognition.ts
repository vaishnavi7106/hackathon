import { useState, useRef, useCallback, useEffect } from 'react'

interface UseSpeechRecognitionReturn {
  isSupported: boolean
  isRecording: boolean
  transcript: string
  interimTranscript: string
  error: string | null
  elapsed: number
  start: () => void
  stop: () => void
  reset: () => void
}

// TypeScript global augmentation for webkit prefix
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

export function useSpeechRecognition(lang: 'ta' | 'en' = 'ta'): UseSpeechRecognitionReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const SpeechRecognitionAPI = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null

  const isSupported = !!SpeechRecognitionAPI

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const start = useCallback(() => {
    if (!SpeechRecognitionAPI) {
      setError('உங்கள் உலாவியில் குரல் இனங்காணல் ஆதரிக்கப்படவில்லை.')
      return
    }

    setError(null)
    setTranscript('')
    setInterimTranscript('')
    setElapsed(0)

    const recognition = new SpeechRecognitionAPI()
    recognition.lang = lang === 'ta' ? 'ta-IN' : 'en-IN'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsRecording(true)
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    }

    recognition.onresult = (event) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }
      if (final) setTranscript((t) => t + final)
      setInterimTranscript(interim)
    }

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setError('மைக்ரோஃபோன் அனுமதி தேவை. உலாவி அமைப்பில் அனுமதிக்கவும்.')
      } else if (event.error === 'no-speech') {
        setError('குரல் கேட்கவில்லை. மீண்டும் முயற்சிக்கவும்.')
      } else {
        setError(`பிழை: ${event.error}`)
      }
      setIsRecording(false)
      if (timerRef.current) clearInterval(timerRef.current)
    }

    recognition.onend = () => {
      setIsRecording(false)
      setInterimTranscript('')
      if (timerRef.current) clearInterval(timerRef.current)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [SpeechRecognitionAPI, lang])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const reset = useCallback(() => {
    recognitionRef.current?.abort()
    setIsRecording(false)
    setTranscript('')
    setInterimTranscript('')
    setError(null)
    setElapsed(0)
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  return { isSupported, isRecording, transcript, interimTranscript, error, elapsed, start, stop, reset }
}

export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}
