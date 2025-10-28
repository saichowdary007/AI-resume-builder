export interface PersonalInfo {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  website?: string;
}

export interface Experience {
  company: string;
  position: string;
  location?: string;
  startDate: string;
  endDate?: string;
  bullets: string[];
}

export interface Education {
  institution: string;
  degree: string;
  field?: string;
  graduationDate?: string;
  gpa?: string;
  honors?: string[];
}

export interface Skill {
  category: string;
  skills: string[];
}

export interface Project {
  name: string;
  description: string;
  technologies?: string[];
  url?: string;
  startDate?: string;
  endDate?: string;
}

export interface Certification {
  name: string;
  issuer: string;
  date: string;
  expiryDate?: string;
  credentialId?: string;
}

export interface Award {
  name: string;
  issuer: string;
  date: string;
  description?: string;
}

export interface ResumeData {
  personalInfo: PersonalInfo;
  summary?: string;
  experience: Experience[];
  education: Education[];
  skills: Skill[];
  projects?: Project[];
  certifications?: Certification[];
  awards?: Award[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface ResumeSnapshot {
  version: number;
  data: ResumeData;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  jobTitle?: string;
  company?: string;
  jobDescription?: string;
  messages: Message[];
  resumeSnapshots: ResumeSnapshot[];
  currentResume: ResumeData;
  currentLatexResume?: string;
  status: 'active' | 'completed' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

export interface JobAnalysis {
  skills: string[];
  requirements: string[];
  keywords: string[];
  experienceLevel: string;
  atsScore?: number;
  recommendations: string[];
}

export interface LLMResponse {
  message: string;
  action?: string;
  changes?: any;
  updatedResume?: ResumeData;
  suggestions?: string[];
  confidence?: number;
}

export interface FileUpload {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
}
