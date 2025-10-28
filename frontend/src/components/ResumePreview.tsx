'use client'

import { FileText, User, Briefcase, GraduationCap, Code } from 'lucide-react'

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

interface ResumePreviewProps {
  resumeData: ResumeData
  latexContent?: string
}

export function ResumePreview({ resumeData, latexContent }: ResumePreviewProps) {
  return (
    <div className="bg-white border rounded-lg h-[600px] overflow-hidden">
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Resume Preview</h3>
          </div>
          {latexContent && (
            <div className="text-sm text-gray-500">
              AI-Optimized LaTeX Available
            </div>
          )}
        </div>
      </div>

      <div className="p-6 overflow-y-auto h-full">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {resumeData.personalInfo.name || 'Your Name'}
          </h1>
          <div className="text-sm text-gray-600 space-y-1">
            <p>{resumeData.personalInfo.email}</p>
            {resumeData.personalInfo.phone && <p>{resumeData.personalInfo.phone}</p>}
            {resumeData.personalInfo.location && <p>{resumeData.personalInfo.location}</p>}
            <div className="flex justify-center space-x-4 mt-2">
              {resumeData.personalInfo.linkedin && (
                <a href={resumeData.personalInfo.linkedin} className="text-primary-600 hover:underline">
                  LinkedIn
                </a>
              )}
              {resumeData.personalInfo.github && (
                <a href={resumeData.personalInfo.github} className="text-primary-600 hover:underline">
                  GitHub
                </a>
              )}
              {resumeData.personalInfo.website && (
                <a href={resumeData.personalInfo.website} className="text-primary-600 hover:underline">
                  Website
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Summary */}
        {resumeData.summary && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
              <User className="w-5 h-5 mr-2" />
              Professional Summary
            </h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              {resumeData.summary}
            </p>
          </div>
        )}

        {/* Experience */}
        {resumeData.experience.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <Briefcase className="w-5 h-5 mr-2" />
              Experience
            </h2>
            <div className="space-y-4">
              {resumeData.experience.map((exp, index) => (
                <div key={index} className="border-l-2 border-primary-200 pl-4">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <h3 className="font-semibold text-gray-900">{exp.position}</h3>
                      <p className="text-primary-600 font-medium">{exp.company}</p>
                      {exp.location && <p className="text-sm text-gray-600">{exp.location}</p>}
                    </div>
                    <span className="text-sm text-gray-500">
                      {exp.startDate} - {exp.endDate || 'Present'}
                    </span>
                  </div>
                  {exp.bullets.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {exp.bullets.map((bullet, bulletIndex) => (
                        <li key={bulletIndex} className="text-sm text-gray-700 flex items-start">
                          <span className="text-primary-500 mr-2">•</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Education */}
        {resumeData.education.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <GraduationCap className="w-5 h-5 mr-2" />
              Education
            </h2>
            <div className="space-y-3">
              {resumeData.education.map((edu, index) => (
                <div key={index}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-900">{edu.degree}</h3>
                      {edu.field && <p className="text-primary-600">{edu.field}</p>}
                      <p className="text-gray-600">{edu.institution}</p>
                    </div>
                    {edu.graduationDate && (
                      <span className="text-sm text-gray-500">{edu.graduationDate}</span>
                    )}
                  </div>
                  {edu.gpa && (
                    <p className="text-sm text-gray-600 mt-1">GPA: {edu.gpa}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skills */}
        {resumeData.skills.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <Code className="w-5 h-5 mr-2" />
              Skills
            </h2>
            <div className="space-y-3">
              {resumeData.skills.map((skillGroup, index) => (
                <div key={index}>
                  <h3 className="font-medium text-gray-900 mb-2">{skillGroup.category}</h3>
                  <div className="flex flex-wrap gap-2">
                    {skillGroup.skills.map((skill, skillIndex) => (
                      <span
                        key={skillIndex}
                        className="px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Placeholder for Projects/Certifications/Awards if they exist */}
        {(resumeData.projects?.length || resumeData.certifications?.length || resumeData.awards?.length) && (
          <div className="text-center text-gray-500 py-4">
            <p className="text-sm">Additional sections (Projects, Certifications, Awards) will be displayed here</p>
          </div>
        )}
      </div>
    </div>
  )
}
