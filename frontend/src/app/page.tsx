'use client'

import { ResumeBuilder } from '@/components/ResumeBuilder'
import './globals.css'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 p-5">
      <div className="test-css mb-5">
        CSS Test: If this is red and large, CSS is working
      </div>
      <div className="text-center py-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          AI Resume Builder
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Optimize your resume with conversational AI for ATS-friendly PDFs
        </p>
      </div>

      <ResumeBuilder />
    </main>
  )
}
