'use client'

import { useState } from 'react'
import { Button } from './ui/Button'
import { ArrowLeft, Briefcase } from 'lucide-react'

interface JobDescriptionInputProps {
  jobTitle: string
  setJobTitle: (title: string) => void
  company: string
  setCompany: (company: string) => void
  jobDescription: string
  setJobDescription: (description: string) => void
  onSubmit: () => void
  onBack: () => void
}

export function JobDescriptionInput({
  jobTitle,
  setJobTitle,
  company,
  setCompany,
  jobDescription,
  setJobDescription,
  onSubmit,
  onBack
}: JobDescriptionInputProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const handleSubmit = async () => {
    if (!jobTitle.trim() || !company.trim() || !jobDescription.trim()) {
      return
    }

    setIsAnalyzing(true)
    try {
      await onSubmit()
    } finally {
      setIsAnalyzing(false)
    }
  }

  const canSubmit = jobTitle.trim() && company.trim() && jobDescription.trim()

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center mb-6">
        <Button
          variant="ghost"
          onClick={onBack}
          className="flex items-center space-x-2 mr-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Button>
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Job Details</h2>
          <p className="text-gray-600">Tell us about the position you're applying for</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-700 mb-2">
              Job Title *
            </label>
            <input
              type="text"
              id="jobTitle"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g., Senior Software Engineer"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-2">
              Company *
            </label>
            <input
              type="text"
              id="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g., Google"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="jobDescription" className="block text-sm font-medium text-gray-700 mb-2">
            Job Description *
          </label>
          <textarea
            id="jobDescription"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the complete job description here. Include requirements, responsibilities, and qualifications."
            rows={12}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-vertical"
            required
          />
          <p className="text-sm text-gray-500 mt-2">
            The more detailed the job description, the better AI can optimize your resume
          </p>
        </div>

        <div className="flex justify-end space-x-4">
          <Button
            variant="outline"
            onClick={onBack}
            disabled={isAnalyzing}
          >
            Back
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isAnalyzing}
            className="flex items-center space-x-2"
          >
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Analyzing Job...</span>
              </>
            ) : (
              <>
                <Briefcase className="w-4 h-4" />
                <span>Start Optimization</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {!canSubmit && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-yellow-800 text-sm">
            Please fill in all required fields to continue
          </p>
        </div>
      )}
    </div>
  )
}
