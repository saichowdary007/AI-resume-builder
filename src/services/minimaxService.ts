import axios, { AxiosInstance } from 'axios';
import winston from 'winston';
import { ResumeData, LLMResponse, JobAnalysis } from '../types';

export class MinimaxService {
  private client: AxiosInstance;
  private apiKey: string;
  private baseURL: string;
  private model: string;
  private fallbackModel: string;

  constructor() {
    // Support both naming conventions for backward compatibility
    this.apiKey = process.env.MINIMAX_API_KEY || process.env.ANTHROPIC_API_KEY || '';
    // Use OpenAI-compatible API (working with MiniMax)
    this.baseURL = process.env.MINIMAX_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.minimax.io';
    this.model = process.env.MINIMAX_MODEL || 'MiniMax-M2';
    this.fallbackModel = process.env.MINIMAX_MODEL_FALLBACK || 'MiniMax-M2';

    console.log('MiniMax Service Config:', {
      hasApiKey: !!this.apiKey,
      apiKeyLength: this.apiKey.length,
      baseURL: this.baseURL,
      model: this.model
    });

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // Increased timeout for better reliability
    });
  }

  /**
   * Analyze job description and provide resume optimization suggestions
   */
  async analyzeJobAndSuggestOptimizations(
    jobDescription: string,
    currentResume: ResumeData,
    conversationHistory: string[] = []
  ): Promise<LLMResponse> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildJobAnalysisPrompt(jobDescription, currentResume, conversationHistory);

    try {
      const response = await this.callLLM(systemPrompt, userPrompt);
      return this.parseLLMResponse(response);
    } catch (error) {
      console.error('Minimax job analysis error:', error);
      return this.getFallbackResponse('job_analysis');
    }
  }

  /**
   * Process user message and update resume accordingly
   */
  async processUserMessage(
    userMessage: string,
    currentResume: ResumeData,
    jobDescription: string,
    conversationHistory: string[] = [],
    currentLatexResume?: string,
    userNotes: string = 'NONE'
  ): Promise<LLMResponse> {
    require('fs').appendFileSync('/tmp/debug.log', `=== MiniMax.processUserMessage called ===\ncurrentLatexResume provided: ${!!currentLatexResume}\n`);
    let systemPrompt: string;
    let userPrompt: string;

    if (currentLatexResume) {
      // Use LaTeX optimization prompt
      systemPrompt = this.buildLatexOptimizationSystemPrompt();
      userPrompt = this.buildLatexOptimizationPrompt(currentLatexResume, jobDescription, userNotes);
    } else {
      // Use regular conversation prompt
      systemPrompt = this.buildSystemPrompt();
      userPrompt = this.buildConversationPrompt(userMessage, currentResume, jobDescription, conversationHistory);
    }

    try {
      const response = await this.callLLM(systemPrompt, userPrompt);

      if (currentLatexResume) {
        // For LaTeX responses, return the raw LaTeX as the message
        winston.info('LaTeX optimization path activated');
        winston.info('LaTeX response keys:', Object.keys(response));
        winston.info('Response choices length:', response.choices?.length);
        const latexContent = response.choices?.[0]?.message?.content || response.content?.[0]?.text || response.message || '';
        winston.info('Extracted LaTeX content length:', latexContent.length);
        winston.info('First 200 chars of content:', latexContent.substring(0, 200));
        return {
          message: latexContent,
          action: 'latex_update',
          changes: {},
          updatedResume: undefined,
          suggestions: [],
          confidence: 0.9
        };
      }

      return this.parseLLMResponse(response);
    } catch (error: any) {
      winston.error('Minimax conversation error:', error.message);
      winston.error('Error status:', error.response?.status);
      winston.error('Error data:', error.response?.data);
      return this.getFallbackResponse('conversation');
    }
  }

  /**
   * Generate specific resume section improvements
   */
  async optimizeResumeSection(
    section: string,
    currentContent: any,
    jobRequirements: string[],
    conversationHistory: string[] = []
  ): Promise<LLMResponse> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildSectionOptimizationPrompt(section, currentContent, jobRequirements, conversationHistory);

    try {
      const response = await this.callLLM(systemPrompt, userPrompt);
      return this.parseLLMResponse(response);
    } catch (error) {
      console.error('Minimax section optimization error:', error);
      return this.getFallbackResponse('section_optimization');
    }
  }

  /**
   * Call Minimax API
   */
  private async callLLM(systemPrompt: string, userPrompt: string): Promise<any> {
    // OpenAI-compatible API format (working with MiniMax)
    const payload = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2048,
      top_p: 0.95
    };

    try {
      winston.info('Making API call to:', this.baseURL + '/v1/chat/completions');
      winston.info('Payload model:', payload.model);
      winston.info('Payload messages count:', payload.messages.length);
      const response = await this.client.post('/v1/chat/completions', payload);
      winston.info('API response status:', response.status);
      return response.data;
    } catch (error) {
      // Try fallback model if primary fails
      if (this.model !== this.fallbackModel) {
        winston.info('Primary model failed, trying fallback model...');
        payload.model = this.fallbackModel;
        try {
          const fallbackResponse = await this.client.post('/v1/chat/completions', payload);
          return fallbackResponse.data;
        } catch (fallbackError) {
          console.error('Fallback model also failed:', fallbackError);
        }
      }
      throw error;
    }
  }

  /**
   * Build system prompt for resume optimization
   */
  private buildSystemPrompt(): string {
    return `You are an expert resume writer and career coach specializing in ATS-optimized resumes.

Your role is to help job seekers create compelling, ATS-friendly resumes that highlight their most relevant qualifications for specific job opportunities.

Guidelines:
- Always maintain truthfulness - never fabricate experience or skills
- Focus on quantifiable achievements and specific contributions
- Use action verbs and industry-specific keywords
- Keep content concise but impactful
- Ensure ATS compatibility (avoid tables, graphics, unusual fonts)
- Provide specific, actionable suggestions
- Consider the candidate's career level and industry context

Response Format:
Always respond in valid JSON with this structure:
{
  "message": "Your conversational response to the user",
  "action": "modify_experience|modify_summary|add_skills|etc.",
  "changes": {
    "section": "experience|education|skills|etc.",
    "index": 0,
    "field": "bullets|description|etc.",
    "value": "new content here"
  },
  "updatedResume": { /* full updated resume object */ },
  "suggestions": ["Suggestion 1", "Suggestion 2"],
  "confidence": 0.95
}

Actions you can take:
- modify_experience: Update work experience section
- modify_summary: Update professional summary
- add_skills: Add or modify skills
- modify_education: Update education section
- add_projects: Add project highlights
- reorder_sections: Change section order for relevance
- no_change: Just provide suggestions without changes`;
  }

  /**
   * Build prompt for initial job analysis
   */
  private buildJobAnalysisPrompt(
    jobDescription: string,
    currentResume: ResumeData,
    conversationHistory: string[]
  ): string {
    const historyText = conversationHistory.length > 0
      ? `\nConversation History:\n${conversationHistory.join('\n')}\n`
      : '';

    return `${historyText}Job Description:
${jobDescription}

Current Resume:
${JSON.stringify(currentResume, null, 2)}

Please analyze this job description and provide specific recommendations for optimizing the resume. Focus on:
1. Key skills and qualifications required
2. Experience level expectations
3. Industry-specific keywords to include
4. Sections that need emphasis or reordering
5. Any gaps between current resume and job requirements

Provide concrete suggestions for improving the resume's relevance to this position.`;
  }

  /**
   * Build prompt for conversational interaction
   */
  private buildConversationPrompt(
    userMessage: string,
    currentResume: ResumeData,
    jobDescription: string,
    conversationHistory: string[]
  ): string {
    const historyText = conversationHistory.length > 0
      ? `\nRecent Conversation:\n${conversationHistory.slice(-5).join('\n')}\n`
      : '';

    return `Job Description:
${jobDescription}

Current Resume:
${JSON.stringify(currentResume, null, 2)}
${historyText}
User Request: ${userMessage}

Please respond helpfully to the user's request and suggest specific resume improvements. If the user wants changes made, implement them in the updatedResume field.`;
  }

  /**
   * Build prompt for section-specific optimization
   */
  private buildSectionOptimizationPrompt(
    section: string,
    currentContent: any,
    jobRequirements: string[],
    conversationHistory: string[]
  ): string {
    const historyText = conversationHistory.length > 0
      ? `\nContext:\n${conversationHistory.slice(-3).join('\n')}\n`
      : '';

    return `${historyText}Section to optimize: ${section}
Current content: ${JSON.stringify(currentContent, null, 2)}
Job requirements: ${jobRequirements.join(', ')}

Please provide specific improvements for this resume section to better align with the job requirements.`;
  }

  /**
   * Build system prompt for LaTeX optimization
   */
  private buildLatexOptimizationSystemPrompt(): string {
    return `You are a resume optimization expert. Take the provided LaTeX resume and job description, then return an improved LaTeX version.

Rules:
- Stay truthful to original content
- Add relevant keywords from job description
- Improve bullet points with metrics where possible
- Keep LaTeX structure intact
- Return ONLY valid LaTeX code, no explanations`;
  }

  /**
   * Build prompt for LaTeX optimization
   */
  private buildLatexOptimizationPrompt(
    currentLatexResume: string,
    jobDescription: string,
    userNotes: string
  ): string {
    // Truncate LaTeX resume to key sections only to avoid token limits
    const maxLength = 2000;
    let truncatedResume = currentLatexResume;
    if (currentLatexResume.length > maxLength) {
      // Keep the beginning (header, summary) and end (skills, education)
      const startPart = currentLatexResume.substring(0, 1000);
      const endPart = currentLatexResume.substring(currentLatexResume.length - 1000);
      truncatedResume = startPart + '\n\n[... LaTeX content truncated for optimization ...]\n\n' + endPart;
    }

    return `Optimize this LaTeX resume for the job: "${jobDescription}"

Current LaTeX (truncated):
${truncatedResume}

Return ONLY the improved LaTeX code. Focus on:
1. Adding job-relevant keywords
2. Improving bullet points with metrics
3. Reordering sections for ATS optimization
4. Keep truthful to original content`;
  }

  /**
   * Parse LLM response into structured format
   */
  private parseLLMResponse(response: any): LLMResponse {
    try {
      // Handle MiniMax/OpenAI-compatible API response format
      const content = response.choices?.[0]?.message?.content || response.message || '{}';

      // Try to parse as JSON first (for structured responses)
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        // If not JSON, treat as plain text response
        return {
          message: content,
          action: 'no_change',
          changes: {},
          updatedResume: undefined,
          suggestions: [],
          confidence: 0.8
        };
      }

      // Validate required fields
      if (!parsed.message) {
        throw new Error('Missing message field in response');
      }

      return {
        message: parsed.message,
        action: parsed.action || 'no_change',
        changes: parsed.changes || {},
        updatedResume: parsed.updatedResume || undefined,
        suggestions: parsed.suggestions || [],
        confidence: parsed.confidence || 0.8
      };
    } catch (error) {
      console.error('Failed to parse LLM response:', error);
      console.error('Raw response:', JSON.stringify(response, null, 2));
      return this.getFallbackResponse('parsing_error');
    }
  }

  /**
   * Get fallback response when LLM fails
   */
  private getFallbackResponse(type: string): LLMResponse {
    const fallbacks = {
      job_analysis: {
        message: "I've analyzed the job description. Here are some general recommendations to improve your resume's relevance to this position.",
        action: 'no_change',
        changes: {},
        updatedResume: undefined,
        suggestions: [
          'Include keywords from the job description',
          'Quantify your achievements with metrics',
          'Tailor your summary to highlight relevant experience',
          'Ensure your skills section matches job requirements'
        ],
        confidence: 0.5
      },
      conversation: {
        message: "I understand you'd like to make changes to your resume. Please try rephrasing your request or be more specific about what you'd like to modify.",
        action: 'no_change',
        changes: {},
        updatedResume: undefined,
        suggestions: [
          'Try: "Make my summary more specific to this role"',
          'Try: "Add more details to my most recent job"',
          'Try: "Emphasize my technical skills"'
        ],
        confidence: 0.3
      },
      section_optimization: {
        message: "I'd recommend reviewing this section to ensure it aligns with the job requirements.",
        action: 'no_change',
        changes: {},
        updatedResume: undefined,
        suggestions: [
          'Add specific achievements and metrics',
          'Use action verbs to start bullet points',
          'Include relevant keywords from the job description'
        ],
        confidence: 0.4
      },
      parsing_error: {
        message: "I encountered an issue processing your request. Please try again with a different approach.",
        action: 'no_change',
        changes: {},
        updatedResume: undefined,
        suggestions: [
          'Try making your request more specific',
          'Check that your resume data is complete',
          'Ensure the job description is clear'
        ],
        confidence: 0.2
      }
    };

    return fallbacks[type as keyof typeof fallbacks] || fallbacks.conversation;
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }
}

export const minimaxService = new MinimaxService();
