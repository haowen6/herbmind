// store/inquiry.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface ChatSession {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
}

export interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  options?: string[]
  isFinished?: boolean
  finalAnswer?: string
  retrievedContextPreview?: string
  requiresFileUpload?: boolean
  llmDetail?: string
  hasPlayedStreamingAnimation?: boolean  // 标记是否已播放流式动画
  uploadedImage?: {
    url: string
    name: string
  }
  // 按钮状态保持相关字段
  selectedOption?: string | null
  isOptionsDisabled?: boolean
  showOtherInput?: boolean
  otherInput?: string
  otherOptionText?: string
  isFileUploaded?: boolean
}

export const useInquiryStore = defineStore('inquiry', () => {
  // 状态
  const sessions = ref<ChatSession[]>([])
  const currentSessionId = ref<string | null>(null)
  const isLoading = ref(false)

  // 计算属性
  const currentSession = computed(() => {
    return sessions.value.find(session => session.id === currentSessionId.value)
  })

  const sortedSessions = computed(() => {
    return [...sessions.value].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  })

  // 方法
  const createNewSession = (sessionId: string, initialQuestion: string) => {
    const newSession: ChatSession = {
      id: sessionId,
      title: '新聊天',
      messages: [{
        id: Date.now().toString(),
        type: 'assistant',
        content: initialQuestion,
        timestamp: new Date()
      }],
      createdAt: new Date()
    }
    
    sessions.value.unshift(newSession)
    currentSessionId.value = sessionId
    saveToLocalStorage()
  }

  const updateSessionTitle = (sessionId: string, title: string) => {
    const session = sessions.value.find(s => s.id === sessionId)
    if (session) {
      session.title = title.length > 20 ? title.substring(0, 20) + '...' : title
      saveToLocalStorage()
    }
  }

  const addMessage = (sessionId: string, message: Omit<Message, 'id' | 'timestamp'>) => {
    const session = sessions.value.find(s => s.id === sessionId)
    if (session) {
      const newMessage: Message = {
        ...message,
        id: Date.now().toString(),
        timestamp: new Date()
      }
      session.messages.push(newMessage)
      
      // 如果是用户的第一条消息，更新会话标题
      if (message.type === 'user' && session.title === '新聊天') {
        updateSessionTitle(sessionId, message.content)
      }
      
      saveToLocalStorage()
    }
  }

  const setCurrentSession = (sessionId: string) => {
    currentSessionId.value = sessionId
  }

  const deleteSession = (sessionId: string) => {
    const index = sessions.value.findIndex(s => s.id === sessionId)
    if (index > -1) {
      sessions.value.splice(index, 1)
      if (currentSessionId.value === sessionId) {
        currentSessionId.value = sessions.value[0]?.id || null
      }
      saveToLocalStorage()
    }
  }

  const saveToLocalStorage = () => {
    localStorage.setItem('inquiry-sessions', JSON.stringify(sessions.value))
    localStorage.setItem('inquiry-current-session', currentSessionId.value || '')
  }

  const loadFromLocalStorage = () => {
    try {
      const savedSessions = localStorage.getItem('inquiry-sessions')
      const savedCurrentSession = localStorage.getItem('inquiry-current-session')
      
      if (savedSessions) {
        const parsedSessions = JSON.parse(savedSessions)
        sessions.value = parsedSessions.map((session: any) => ({
          ...session,
          createdAt: new Date(session.createdAt),
          messages: session.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }))
      }
      
      if (savedCurrentSession) {
        currentSessionId.value = savedCurrentSession
      }
    } catch (error) {
      console.error('加载本地存储失败:', error)
    }
  }

  const clearAllSessions = () => {
    sessions.value = []
    currentSessionId.value = null
    localStorage.removeItem('inquiry-sessions')
    localStorage.removeItem('inquiry-current-session')
  }

  const updateMessageStreamingStatus = (sessionId: string, messageId: string, hasPlayed: boolean) => {
    const session = sessions.value.find(s => s.id === sessionId)
    if (session) {
      const message = session.messages.find(m => m.id === messageId)
      if (message) {
        message.hasPlayedStreamingAnimation = hasPlayed
        saveToLocalStorage()
      }
    }
  }

  const updateMessageButtonState = (sessionId: string, messageId: string, buttonState: Partial<Pick<Message, 'selectedOption' | 'isOptionsDisabled' | 'showOtherInput' | 'otherInput' | 'otherOptionText' | 'isFileUploaded'>>) => {
    const session = sessions.value.find(s => s.id === sessionId)
    if (session) {
      const message = session.messages.find(m => m.id === messageId)
      if (message) {
        Object.assign(message, buttonState)
        saveToLocalStorage()
      }
    }
  }

  return {
    // 状态
    sessions,
    currentSessionId,
    isLoading,
    
    // 计算属性
    currentSession,
    sortedSessions,
    
    // 方法
    createNewSession,
    updateSessionTitle,
    addMessage,
    setCurrentSession,
    deleteSession,
    saveToLocalStorage,
    loadFromLocalStorage,
    clearAllSessions,
    updateMessageStreamingStatus,
    updateMessageButtonState
  }
})
