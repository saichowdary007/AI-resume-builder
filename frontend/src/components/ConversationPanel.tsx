'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader } from 'lucide-react'
import { Button } from './ui/Button'

interface ResumeData {
  personalInfo: {
    name: string
    email: string
    phone?: string
    location?: string
    linkedin?: string
    github?: string
    website?: string
  }
  summary?: string
  experience: Array<{
    company: string
    position: string
    location?: string
    startDate: string
    endDate?: string
    bullets: string[]
  }>
  education: Array<{
    institution: string
    degree: string
    field?: string
    graduationDate?: string
    gpa?: string
  }>
  skills: Array<{
    category: string
    skills: string[]
  }>
  projects?: Array<any>
  certifications?: Array<any>
  awards?: Array<any>
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
}

interface Conversation {
  id: string
  jobTitle?: string
  company?: string
  jobDescription?: string
  messages: Message[]
  currentResume: ResumeData
  currentLatexResume?: string
}

interface ConversationPanelProps {
  conversation: Conversation
  onConversationUpdate: (conversation: Conversation) => void
  onLatexUpdate?: (latexContent: string) => void
}

export function ConversationPanel({ conversation, onConversationUpdate, onLatexUpdate }: ConversationPanelProps) {
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [conversation.messages])

  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) return

    const userMessage = message.trim()
    setMessage('')
    setIsLoading(true)

    try {
      const response = await fetch(`/api/conversation/${conversation.id}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: userMessage,
        }),
      })

      const result = await response.json()

      if (result.success) {
        // Update conversation with new messages and resume data
        const updatedConversation = {
          ...conversation,
          messages: [
            ...conversation.messages,
            result.data.userMessage,
            result.data.aiMessage
          ],
          currentResume: result.data.llmResponse.updatedResume || conversation.currentResume,
          currentLatexResume: result.data.llmResponse.action === 'latex_update' && result.data.llmResponse.message
            ? result.data.llmResponse.message
            : conversation.currentLatexResume
        }

        onConversationUpdate(updatedConversation)

        // Notify parent component of LaTeX update
        if (result.data.llmResponse.action === 'latex_update' && result.data.llmResponse.message && onLatexUpdate) {
          onLatexUpdate(result.data.llmResponse.message)
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="bg-white border rounded-lg h-[600px] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50 rounded-t-lg">
        <h3 className="text-lg font-semibold text-gray-900">
          Resume Optimization Chat
        </h3>
        <p className="text-sm text-gray-600">
          {conversation.jobTitle} at {conversation.company}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {conversation.messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <Bot className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg mb-2">Ready to optimize your resume!</p>
            <p className="text-sm">
              Ask me to improve specific sections, add keywords, or tailor content for this role.
            </p>
          </div>
        ) : (
          conversation.messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start space-x-3 ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary-600" />
                </div>
              )}

              <div
                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className="text-xs opacity-70 mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </p>
              </div>

              {msg.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-gray-600" />
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary-600" />
            </div>
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <div className="flex items-center space-x-2">
                <Loader className="w-4 h-4 animate-spin" />
                <span className="text-sm text-gray-600">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex space-x-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask AI to optimize your resume... e.g., 'Make my summary more impactful' or 'Add more technical keywords'"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            rows={2}
            disabled={isLoading}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || isLoading}
            className="self-end"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        <div className="mt-2 text-xs text-gray-500">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  )
}
