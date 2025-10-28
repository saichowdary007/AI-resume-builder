'use client'

import { useState } from 'react'
import { FileUpload } from './FileUpload'
import { JobDescriptionInput } from './JobDescriptionInput'
import { ConversationPanel } from './ConversationPanel'
import { ResumePreview } from './ResumePreview'
import { Button } from './ui/Button'
import { Download, Loader } from 'lucide-react'

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

interface Conversation {
  id: string
  jobTitle?: string
  company?: string
  jobDescription?: string
  messages: Array<{
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: string
  }>
  currentResume: ResumeData
  currentLatexResume?: string
}

type Step = 'upload' | 'job-description' | 'conversation'

export function ResumeBuilder() {
  const [currentStep, setCurrentStep] = useState<Step>('upload')
  const [uploadedResume, setUploadedResume] = useState<ResumeData | null>(null)
  const [jobDescription, setJobDescription] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [company, setCompany] = useState('')
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)

  const handleResumeUpload = (resumeData: ResumeData) => {
    setUploadedResume(resumeData)
    setCurrentStep('job-description')
  }

  const handleJobDescriptionSubmit = async () => {
    if (!uploadedResume || !jobDescription.trim()) return

    try {
      // Create conversation
      const response = await fetch('/api/conversation/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobTitle,
          company,
          jobDescription,
          resumeData: uploadedResume,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setConversation(result.data)
        setCurrentStep('conversation')
      }
    } catch (error) {
      console.error('Failed to create conversation:', error)
    }
  }

  const handleGeneratePDF = async () => {
    if (!conversation) return

    setIsGeneratingPDF(true)
    try {
      const response = await fetch('/api/pdf/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resumeData: conversation.currentResume,
          template: 'default',
          options: {
            company: conversation.company || 'General',
            latexContent: conversation.currentLatexResume || undefined
          }
        }),
      })

      if (response.ok) {
        // Create download link
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${conversation.currentResume.personalInfo.name || 'Resume'}_Resume_${conversation.company || 'General'}_${new Date().toISOString().slice(0, 10)}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Failed to generate PDF:', error)
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Progress indicator */}
      <div className="flex justify-center mb-8">
        <div className="flex items-center space-x-4">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
            currentStep === 'upload' ? 'bg-primary-500 text-white' :
            ['job-description', 'conversation'].includes(currentStep) ? 'bg-primary-100 text-primary-600' :
            'bg-gray-200 text-gray-600'
          }`}>
            1
          </div>
          <div className="w-12 h-px bg-gray-300"></div>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
            currentStep === 'job-description' ? 'bg-primary-500 text-white' :
            currentStep === 'conversation' ? 'bg-primary-100 text-primary-600' :
            'bg-gray-200 text-gray-600'
          }`}>
            2
          </div>
          <div className="w-12 h-px bg-gray-300"></div>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
            currentStep === 'conversation' ? 'bg-primary-500 text-white' :
            'bg-gray-200 text-gray-600'
          }`}>
            3
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        {currentStep === 'upload' && (
          <FileUpload onResumeUpload={handleResumeUpload} />
        )}

        {currentStep === 'job-description' && (
          <JobDescriptionInput
            jobTitle={jobTitle}
            setJobTitle={setJobTitle}
            company={company}
            setCompany={setCompany}
            jobDescription={jobDescription}
            setJobDescription={setJobDescription}
            onSubmit={handleJobDescriptionSubmit}
            onBack={() => setCurrentStep('upload')}
          />
        )}

        {currentStep === 'conversation' && conversation && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <ConversationPanel
                conversation={conversation}
                onConversationUpdate={setConversation}
                onLatexUpdate={(latexContent) => {
                  if (conversation) {
                    setConversation({
                      ...conversation,
                      currentLatexResume: latexContent
                    });
                  }
                }}
              />

              <div className="flex justify-center">
                <Button
                  onClick={handleGeneratePDF}
                  disabled={isGeneratingPDF}
                  className="flex items-center space-x-2"
                >
                  {isGeneratingPDF ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>{isGeneratingPDF ? 'Generating PDF...' : 'Download Resume PDF'}</span>
                </Button>
              </div>
            </div>

            <div>
              <ResumePreview resumeData={conversation.currentResume} latexContent={conversation.currentLatexResume} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
