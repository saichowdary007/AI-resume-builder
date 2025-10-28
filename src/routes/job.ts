import express from 'express';
import { JobAnalysis } from '../types';
import { validateRequest, jobAnalysisSchema, asyncHandler } from '../middleware/validation';

const router = express.Router();

/**
 * POST /api/job/analyze
 * Analyze job description for keywords, skills, and requirements
 */
router.post('/analyze', validateRequest(jobAnalysisSchema), asyncHandler(async (req, res) => {
  const { jobDescription, jobTitle } = req.body;

  // Analyze job description
  const analysis = analyzeJobDescription(jobDescription, jobTitle);

  res.json({
    success: true,
    data: analysis,
    message: 'Job description analyzed successfully'
  });
}));

/**
 * Analyze job description for key information
 */
export function analyzeJobDescription(description: string, title?: string): JobAnalysis {
  const text = description.toLowerCase();

  // Extract skills (technical and soft skills)
  const technicalSkills = extractTechnicalSkills(text);
  const softSkills = extractSoftSkills(text);

  // Extract requirements and responsibilities
  const requirements = extractRequirements(text);
  const responsibilities = extractResponsibilities(text);

  // Determine experience level
  const experienceLevel = determineExperienceLevel(text, title);

  // Extract keywords for ATS
  const keywords = extractKeywords(text);

  // Calculate ATS score (simplified)
  const atsScore = calculateATSScore(keywords, technicalSkills);

  // Generate recommendations
  const recommendations = generateRecommendations(technicalSkills, softSkills, experienceLevel);

  return {
    skills: [...technicalSkills, ...softSkills],
    requirements,
    keywords,
    experienceLevel,
    atsScore,
    recommendations
  };
}

/**
 * Extract technical skills from job description
 */
function extractTechnicalSkills(text: string): string[] {
  const technicalSkills = [
    // Programming languages
    'javascript', 'python', 'java', 'c\\+\\+', 'c#', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala', 'r', 'matlab', 'perl',
    // Web technologies
    'react', 'angular', 'vue', 'node', 'express', 'django', 'flask', 'spring', 'laravel', 'asp.net',
    'html', 'css', 'sass', 'less', 'typescript', 'jquery', 'bootstrap', 'tailwind', 'webpack', 'babel',
    // Databases
    'sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'oracle', 'sqlite', 'cassandra', 'dynamodb', 'firebase',
    // Cloud platforms
    'aws', 'azure', 'gcp', 'heroku', 'digitalocean', 'vercel', 'netlify', 'cloudflare', 'lambda', 'ec2', 's3',
    // DevOps tools
    'docker', 'kubernetes', 'jenkins', 'gitlab', 'github', 'terraform', 'ansible', 'circleci', 'travis', 'github actions',
    // Data & ML
    'pandas', 'numpy', 'scikit-learn', 'tensorflow', 'pytorch', 'keras', 'jupyter', 'spark', 'hadoop', 'kafka',
    // Mobile
    'ios', 'android', 'react native', 'flutter', 'xamarin', 'ionic', 'cordova',
    // Other technologies
    'git', 'linux', 'ubuntu', 'centos', 'graphql', 'rest', 'api', 'microservices', 'agile', 'scrum', 'kanban', 'jira', 'confluence',
    // Testing
    'jest', 'mocha', 'chai', 'cypress', 'selenium', 'junit', 'pytest', 'rspec'
  ];

  const foundSkills: string[] = [];

  technicalSkills.forEach(skill => {
    const regex = new RegExp(`\\b${skill.replace('+', '\\+')}\\b`, 'i');
    if (regex.test(text)) {
      foundSkills.push(skill.replace('\\+\\+', 'c++'));
    }
  });

  return [...new Set(foundSkills)]; // Remove duplicates
}

/**
 * Extract soft skills from job description
 */
function extractSoftSkills(text: string): string[] {
  const softSkills = [
    'communication', 'leadership', 'teamwork', 'collaboration', 'problem.solving', 'analytical',
    'adaptability', 'flexibility', 'creativity', 'innovation', 'time.management', 'organization',
    'project.management', 'critical.thinking', 'decision.making', 'strategic.thinking',
    'interpersonal', 'mentoring', 'coaching', 'presentation', 'public.speaking',
    'emotional.intelligence', 'empathy', 'conflict.resolution', 'negotiation',
    'customer.focus', 'client.relations', 'stakeholder.management', 'relationship.building'
  ];

  const foundSkills: string[] = [];

  softSkills.forEach(skill => {
    const regex = new RegExp(skill.replace('.', '\\.'), 'i');
    if (regex.test(text)) {
      foundSkills.push(skill.replace('.', ' '));
    }
  });

  return [...new Set(foundSkills)]; // Remove duplicates
}

/**
 * Extract job requirements
 */
function extractRequirements(text: string): string[] {
  const requirements: string[] = [];

  // Look for requirement indicators
  const requirementPatterns = [
    /requirements?:?\s*([^.!?]+[.!?])/gi,
    /qualifications?:?\s*([^.!?]+[.!?])/gi,
    /must have:?s*\s*([^.!?]+[.!?])/gi,
    /required:?s*\s*([^.!?]+[.!?])/gi
  ];

  requirementPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const requirement = match[1].trim();
      if (requirement.length > 10 && requirement.length < 200) {
        requirements.push(requirement);
      }
    }
  });

  // Extract bullet points that look like requirements
  const bulletRequirements = text
    .split('\n')
    .filter(line => line.trim().match(/^[-•*]\s/))
    .map(line => line.trim().substring(1).trim())
    .filter(line => line.length > 10 && line.length < 150)
    .slice(0, 5); // Limit to 5

  return [...requirements, ...bulletRequirements];
}

/**
 * Extract job responsibilities
 */
function extractResponsibilities(text: string): string[] {
  const responsibilities: string[] = [];

  // Look for responsibility indicators
  const responsibilityPatterns = [
    /responsibilities?:?\s*([^.!?]+[.!?])/gi,
    /will:?s*\s*([^.!?]+[.!?])/gi,
    /duties?:?\s*([^.!?]+[.!?])/gi
  ];

  responsibilityPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const responsibility = match[1].trim();
      if (responsibility.length > 10 && responsibility.length < 200) {
        responsibilities.push(responsibility);
      }
    }
  });

  return responsibilities.slice(0, 5); // Limit to 5
}

/**
 * Determine experience level required
 */
function determineExperienceLevel(text: string, title?: string): string {
  const lowerText = text.toLowerCase();
  const lowerTitle = title?.toLowerCase() || '';

  // Check for senior/junior indicators
  if (lowerText.includes('senior') || lowerText.includes('lead') || lowerText.includes('principal') ||
      lowerTitle.includes('senior') || lowerTitle.includes('lead') || lowerTitle.includes('principal')) {
    return 'Senior (5+ years)';
  }

  if (lowerText.includes('junior') || lowerText.includes('entry') || lowerText.includes('graduate') ||
      lowerTitle.includes('junior') || lowerTitle.includes('entry')) {
    return 'Junior (0-2 years)';
  }

  // Check for year requirements
  const yearPatterns = [
    /(\d+)\+?\s*years?/i,
    /(\d+)\+?\s*yrs?/i,
    /minimum\s+(\d+)\s+years?/i
  ];

  for (const pattern of yearPatterns) {
    const match = text.match(pattern);
    if (match) {
      const years = parseInt(match[1]);
      if (years >= 5) return 'Senior (5+ years)';
      if (years >= 3) return 'Mid-level (3-5 years)';
      if (years >= 1) return 'Junior (0-2 years)';
    }
  }

  // Default based on common patterns
  if (lowerText.includes('architect') || lowerText.includes('manager')) {
    return 'Senior (5+ years)';
  }

  return 'Mid-level (3-5 years)'; // Default
}

/**
 * Extract keywords for ATS optimization
 */
function extractKeywords(text: string): string[] {
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];

  // Common stop words to exclude
  const stopWords = new Set([
    'that', 'with', 'have', 'this', 'will', 'your', 'from', 'they', 'know', 'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when', 'come', 'here', 'just', 'like', 'long', 'make', 'many', 'over', 'such', 'take', 'than', 'them', 'well', 'were', 'what', 'where', 'which', 'their', 'said', 'each', 'also', 'about', 'would', 'there', 'could', 'other', 'after', 'first', 'never', 'these', 'work', 'being', 'through', 'before', 'great', 'looking', 'join', 'team', 'company', 'looking', 'candidate', 'ideal', 'role', 'position', 'responsibilities', 'requirements', 'qualifications', 'skills', 'experience', 'ability', 'knowledge', 'understanding', 'strong', 'excellent', 'proven', 'track', 'record'
  ]);

  // Technical and industry-specific terms that should be prioritized
  const technicalTerms = new Set([
    'javascript', 'python', 'java', 'react', 'node', 'aws', 'docker', 'kubernetes', 'api', 'database', 'sql', 'nosql', 'rest', 'graphql', 'microservices', 'agile', 'scrum', 'ci/cd', 'testing', 'automation', 'security', 'performance', 'scalability', 'architecture', 'design', 'patterns', 'algorithms', 'data', 'structures', 'machine', 'learning', 'artificial', 'intelligence', 'cloud', 'infrastructure', 'devops', 'monitoring', 'logging', 'debugging', 'optimization', 'frontend', 'backend', 'fullstack', 'mobile', 'web', 'application', 'software', 'engineering', 'development', 'programming', 'coding', 'deployment', 'maintenance', 'support', 'integration', 'implementation', 'configuration'
  ]);

  // Filter for potential keywords
  const potentialKeywords = words.filter(word => {
    // Must be longer than 3 characters
    if (word.length < 4) return false;

    // Exclude stop words
    if (stopWords.has(word)) return false;

    // Include if it's a technical term or has technical significance
    if (technicalTerms.has(word)) return true;

    // Include compound words or technical-looking terms
    if (word.includes('-') || word.includes('_') || /\d/.test(word)) return true;

    // Include longer words that might be domain-specific
    if (word.length > 6) return true;

    return false;
  });

  // Get unique keywords with frequency
  const keywordFreq: { [key: string]: number } = {};
  potentialKeywords.forEach(word => {
    keywordFreq[word] = (keywordFreq[word] || 0) + 1;
  });

  // Score keywords based on importance
  const scoredKeywords = Object.entries(keywordFreq).map(([word, freq]) => {
    let score = freq;

    // Boost technical terms
    if (technicalTerms.has(word)) score *= 2;

    // Boost longer, more specific terms
    if (word.length > 8) score *= 1.5;

    // Boost terms with numbers or special chars
    if (/\d/.test(word) || word.includes('-') || word.includes('_')) score *= 1.5;

    return { word, score, freq };
  });

  // Return top keywords by score, then by frequency
  return scoredKeywords
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return b.freq - a.freq;
    })
    .slice(0, 25)
    .map(item => item.word);
}

/**
 * Calculate ATS compatibility score
 */
function calculateATSScore(keywords: string[], technicalSkills: string[]): number {
  let score = 0;

  // Base score for having any keywords
  if (keywords.length > 0) score += 15;

  // Keyword diversity and relevance score (0-35 points)
  const keywordScore = Math.min(keywords.length * 1.4, 35);
  score += keywordScore;

  // Technical skills score (0-30 points)
  const skillScore = Math.min(technicalSkills.length * 2, 30);
  score += skillScore;

  // Bonus for comprehensive keyword coverage
  if (keywords.length > 15) score += 5;
  if (keywords.length > 20) score += 5;

  // Bonus for technical skill diversity
  if (technicalSkills.length > 5) score += 5;
  if (technicalSkills.length > 8) score += 5;

  // Penalty for very few keywords (likely poor job description)
  if (keywords.length < 3) score = Math.max(score - 10, 0);

  return Math.min(Math.round(score), 100);
}

/**
 * Generate optimization recommendations
 */
function generateRecommendations(technicalSkills: string[], softSkills: string[], experienceLevel: string): string[] {
  const recommendations: string[] = [];

  // Technical skills recommendations
  if (technicalSkills.length === 0) {
    recommendations.push('Add a technical skills section with relevant technologies from the job description');
  } else if (technicalSkills.length < 3) {
    recommendations.push('Expand technical skills section - this job requires expertise in multiple technologies');
    recommendations.push(`Prioritize these key skills: ${technicalSkills.join(', ')}`);
  } else {
    recommendations.push(`Lead with these critical technical skills: ${technicalSkills.slice(0, 4).join(', ')}`);
  }

  // Soft skills recommendations
  if (softSkills.length === 0) {
    recommendations.push('Include relevant soft skills that demonstrate cultural fit for this role');
  } else {
    recommendations.push(`Highlight these soft skills: ${softSkills.slice(0, 3).join(', ')}`);
  }

  // Experience level specific recommendations
  if (experienceLevel.includes('Senior')) {
    recommendations.push('Emphasize leadership, architecture decisions, and mentoring experience');
    recommendations.push('Include metrics showing impact on team performance and project outcomes');
    recommendations.push('Highlight complex problem-solving and strategic thinking');
  } else if (experienceLevel.includes('Mid-level')) {
    recommendations.push('Show progression of responsibilities and increasing complexity of projects');
    recommendations.push('Include both individual contributions and team collaboration examples');
    recommendations.push('Demonstrate technical depth alongside practical application');
  } else if (experienceLevel.includes('Junior')) {
    recommendations.push('Focus on relevant projects, coursework, and eagerness to learn');
    recommendations.push('Highlight transferable skills and quick learning ability');
    recommendations.push('Include academic achievements and relevant certifications');
  }

  // General ATS optimization
  recommendations.push('Incorporate exact keywords from job description naturally throughout resume');
  recommendations.push('Use quantifiable achievements (numbers, percentages, scale) wherever possible');
  recommendations.push('Ensure consistent formatting and avoid complex graphics or tables');

  // Industry-specific advice
  if (technicalSkills.some(skill => ['react', 'angular', 'vue', 'javascript', 'typescript'].includes(skill))) {
    recommendations.push('For frontend roles, include responsive design and modern framework experience');
  }
  if (technicalSkills.some(skill => ['node', 'python', 'java', 'docker', 'kubernetes'].includes(skill))) {
    recommendations.push('For backend/fullstack roles, emphasize system design and scalability');
  }
  if (technicalSkills.some(skill => ['aws', 'azure', 'gcp', 'terraform'].includes(skill))) {
    recommendations.push('For cloud roles, highlight infrastructure as code and automation experience');
  }

  return recommendations.slice(0, 8); // Limit to top 8 recommendations
}

export default router;
