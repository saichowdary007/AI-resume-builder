'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Loader } from 'lucide-react'

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

interface FileUploadProps {
  onResumeUpload: (resumeData: ResumeData) => void
}

export function FileUpload({ onResumeUpload }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    setIsUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('resume', file)

      const response = await fetch('/api/resume/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (result.success) {
        onResumeUpload(result.data)
      } else {
        setUploadError(result.message || 'Failed to parse resume')
      }
    } catch (error) {
      console.error('Upload error:', error)
      setUploadError('Failed to upload file. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }, [onResumeUpload])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  })

  return (
    <div className="text-center">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">
        Upload Your Resume
      </h2>
      <p className="text-gray-600 mb-8">
        Upload your existing resume (PDF or DOCX) to get started with AI-powered optimization
      </p>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400'
        } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input {...getInputProps()} />

        {isUploading ? (
          <div className="flex flex-col items-center">
            <Loader className="w-12 h-12 text-primary-500 animate-spin mb-4" />
            <p className="text-lg text-gray-600">Parsing your resume...</p>
            <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Upload className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-lg text-gray-600 mb-2">
              {isDragActive ? 'Drop your resume here' : 'Drag & drop your resume here'}
            </p>
            <p className="text-gray-500 mb-4">or click to browse files</p>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <FileText className="w-4 h-4" />
              <span>Supports PDF and DOCX files (max 10MB)</span>
            </div>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">{uploadError}</p>
        </div>
      )}

      <div className="mt-8 text-sm text-gray-500">
        <p className="mb-2">Your resume data is processed locally and not stored permanently.</p>
        <p>AI will help optimize your resume content for better ATS compatibility.</p>
      </div>
    </div>
  )
}
