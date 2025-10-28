import fs from 'fs';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { ResumeData, PersonalInfo, Experience, Education, Skill, Project, Certification, Award } from '../types';

export class ResumeParser {
  /**
   * Parse a PDF resume file
   */
  async parsePDF(filePath: string): Promise<ResumeData> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      const text = data.text;

      return this.extractResumeData(text);
    } catch (error) {
      console.error('Error parsing PDF:', error);
      throw new Error('Failed to parse PDF file');
    }
  }

  /**
   * Parse a DOCX resume file
   */
  async parseDOCX(filePath: string): Promise<ResumeData> {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      const text = result.value;

      return this.extractResumeData(text);
    } catch (error) {
      console.error('Error parsing DOCX:', error);
      throw new Error('Failed to parse DOCX file');
    }
  }

  /**
   * Extract structured resume data from plain text
   */
  private extractResumeData(text: string): ResumeData {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    const resume: ResumeData = {
      personalInfo: this.extractPersonalInfo(lines),
      summary: this.extractSummary(lines),
      experience: this.extractExperience(lines),
      education: this.extractEducation(lines),
      skills: this.extractSkills(lines),
      projects: [],
      certifications: [],
      awards: []
    };

    return resume;
  }

  /**
   * Extract personal information from resume text
   */
  private extractPersonalInfo(lines: string[]): PersonalInfo {
    const personalInfo: PersonalInfo = {
      name: '',
      email: '',
      phone: '',
      location: '',
      linkedin: '',
      github: '',
      website: ''
    };

    // Look for name (usually first line or line with all caps)
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      if (line.length > 0 && line.length < 50 && !line.includes('@') && !/\d/.test(line)) {
        // Check if it's likely a name (no special chars, reasonable length)
        if (!line.includes('|') && !line.includes('•') && !line.includes(' - ')) {
          personalInfo.name = line;
          break;
        }
      }
    }

    // Look for contact information
    const contactPatterns = {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
      linkedin: /linkedin\.com\/in\/[A-Za-z0-9_-]+/gi,
      github: /github\.com\/[A-Za-z0-9_-]+/gi
    };

    const fullText = lines.join(' ');

    const emailMatch = fullText.match(contactPatterns.email);
    if (emailMatch) personalInfo.email = emailMatch[0];

    const phoneMatch = fullText.match(contactPatterns.phone);
    if (phoneMatch) personalInfo.phone = phoneMatch[0];

    const linkedinMatch = fullText.match(contactPatterns.linkedin);
    if (linkedinMatch) personalInfo.linkedin = linkedinMatch[0];

    const githubMatch = fullText.match(contactPatterns.github);
    if (githubMatch) personalInfo.github = githubMatch[0];

    // Look for location (often after email/phone)
    for (const line of lines.slice(0, 10)) {
      if (line.includes(',') && line.length < 50 && !line.includes('@')) {
        // Simple heuristic for location
        if (line.split(',').length === 2) {
          personalInfo.location = line;
          break;
        }
      }
    }

    return personalInfo;
  }

  /**
   * Extract professional summary
   */
  private extractSummary(lines: string[]): string {
    const summaryKeywords = ['summary', 'objective', 'profile', 'about'];
    let summaryStart = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (summaryKeywords.some(keyword => line.includes(keyword))) {
        summaryStart = i + 1;
        break;
      }
    }

    if (summaryStart === -1) return '';

    // Collect summary lines until next section
    const summaryLines: string[] = [];
    for (let i = summaryStart; i < lines.length; i++) {
      const line = lines[i];
      if (this.isSectionHeader(line)) break;
      if (line.length > 10) summaryLines.push(line);
      if (summaryLines.length >= 3) break; // Limit summary to a few lines
    }

    return summaryLines.join(' ');
  }

  /**
   * Extract work experience
   */
  private extractExperience(lines: string[]): Experience[] {
    const experience: Experience[] = [];
    const experienceKeywords = ['experience', 'work', 'employment', 'professional'];
    let experienceStart = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (experienceKeywords.some(keyword => line.includes(keyword))) {
        experienceStart = i + 1;
        break;
      }
    }

    if (experienceStart === -1) return experience;

    let currentExp: Partial<Experience> = {};
    let collectingBullets = false;

    for (let i = experienceStart; i < lines.length; i++) {
      const line = lines[i];

      if (this.isSectionHeader(line) && line.toLowerCase() !== 'experience') break;

      // Check if this is a job title/company line
      if (!line.startsWith('•') && !line.startsWith('-') && line.length > 5) {
        // Save previous experience if it exists
        if (currentExp.position && currentExp.company) {
          experience.push(currentExp as Experience);
        }

        // Parse job title and company
        const jobMatch = line.match(/^(.+?)\s*(?:at|@)\s*(.+?)(?:\s*\|.*)?$/i);
        if (jobMatch) {
          currentExp = {
            position: jobMatch[1].trim(),
            company: jobMatch[2].trim(),
            bullets: []
          };
        } else if (line.includes('|') || line.includes(' - ')) {
          // Try alternative format: "Position - Company | Dates"
          const parts = line.split(/[|\-]/).map(p => p.trim());
          if (parts.length >= 2) {
            currentExp = {
              position: parts[0],
              company: parts[1],
              bullets: []
            };
          }
        }

        collectingBullets = false;
      } else if ((line.startsWith('•') || line.startsWith('-')) && currentExp.position) {
        // This is a bullet point
        if (!collectingBullets) {
          collectingBullets = true;
        }
        const bullet = line.substring(1).trim();
        if (bullet.length > 0) {
          currentExp.bullets = currentExp.bullets || [];
          currentExp.bullets.push(bullet);
        }
      }
    }

    // Add the last experience
    if (currentExp.position && currentExp.company) {
      experience.push(currentExp as Experience);
    }

    return experience;
  }

  /**
   * Extract education information
   */
  private extractEducation(lines: string[]): Education[] {
    const education: Education[] = [];
    const educationKeywords = ['education', 'academic', 'university', 'college'];
    let educationStart = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (educationKeywords.some(keyword => line.includes(keyword))) {
        educationStart = i + 1;
        break;
      }
    }

    if (educationStart === -1) return education;

    for (let i = educationStart; i < lines.length; i++) {
      const line = lines[i];

      if (this.isSectionHeader(line) && !educationKeywords.some(k => line.toLowerCase().includes(k))) break;

      if (line.length > 10 && !line.startsWith('•') && !line.startsWith('-')) {
        // Parse degree and institution
        const eduMatch = line.match(/^(.+?),\s*(.+?)(?:,\s*(.+?))?$/);
        if (eduMatch) {
          education.push({
            degree: eduMatch[1].trim(),
            institution: eduMatch[2].trim(),
            field: eduMatch[3]?.trim() || ''
          });
        } else {
          // Fallback: assume first part is degree, second is institution
          const parts = line.split(',').map(p => p.trim());
          if (parts.length >= 2) {
            education.push({
              degree: parts[0],
              institution: parts[1],
              field: parts.slice(2).join(', ')
            });
          }
        }
      }
    }

    return education;
  }

  /**
   * Extract skills information
   */
  private extractSkills(lines: string[]): Skill[] {
    const skills: Skill[] = [];
    const skillsKeywords = ['skills', 'technologies', 'competencies'];
    let skillsStart = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (skillsKeywords.some(keyword => line.includes(keyword))) {
        skillsStart = i + 1;
        break;
      }
    }

    if (skillsStart === -1) return skills;

    // Collect all skills text until next section
    const skillsText: string[] = [];
    for (let i = skillsStart; i < lines.length; i++) {
      const line = lines[i];
      if (this.isSectionHeader(line)) break;
      if (line.length > 0) skillsText.push(line);
    }

    // Group skills by category (simple approach)
    const allSkillsText = skillsText.join(' ');
    const skillItems = allSkillsText.split(/[•,\n]/).map(s => s.trim()).filter(s => s.length > 0);

    // Categorize skills
    const technicalSkills = skillItems.filter(skill =>
      /\b(javascript|python|java|react|node|sql|html|css|aws|docker|git)\b/i.test(skill)
    );

    const softSkills = skillItems.filter(skill =>
      /\b(communication|leadership|teamwork|problem.solving|analytical)\b/i.test(skill)
    );

    const otherSkills = skillItems.filter(skill =>
      !technicalSkills.includes(skill) && !softSkills.includes(skill)
    );

    if (technicalSkills.length > 0) {
      skills.push({
        category: 'Technical Skills',
        skills: technicalSkills
      });
    }

    if (softSkills.length > 0) {
      skills.push({
        category: 'Soft Skills',
        skills: softSkills
      });
    }

    if (otherSkills.length > 0) {
      skills.push({
        category: 'Other Skills',
        skills: otherSkills
      });
    }

    return skills;
  }

  /**
   * Check if a line is likely a section header
   */
  private isSectionHeader(line: string): boolean {
    const sectionHeaders = [
      'experience', 'education', 'skills', 'projects', 'certifications',
      'awards', 'summary', 'objective', 'professional', 'academic'
    ];

    const lowerLine = line.toLowerCase();
    return sectionHeaders.some(header => lowerLine.includes(header)) ||
           (line.length < 30 && /^[A-Z\s]+$/.test(line));
  }

  /**
   * Generate LaTeX from resume data using the provided template
   */
  generateLatexFromResume(resumeData: ResumeData, templateLatex: string): string {
    const beginDelimiter = '\\begin{document}';
    const endDelimiter = '\\end{document}';

    const hasBegin = templateLatex.includes(beginDelimiter);
    const hasEnd = templateLatex.includes(endDelimiter);

    const [preambleSection, bodyAndAfter] = hasBegin
      ? templateLatex.split(beginDelimiter)
      : [this.getDefaultPreamble(), ''];

    const afterBegin = bodyAndAfter || '';
    const postDocument = hasEnd
      ? afterBegin.split(endDelimiter).slice(1).join(endDelimiter)
      : '';

    const latexBody = this.buildLatexBody(resumeData);

    const preamble = hasBegin ? preambleSection : this.getDefaultPreamble();
    const documentCore = `${preamble}${beginDelimiter}\n${latexBody}\n${endDelimiter}`;

    return postDocument ? `${documentCore}${postDocument}` : documentCore;
  }

  private buildLatexBody(resumeData: ResumeData): string {
    const sections: string[] = [];

    sections.push(this.buildHeader(resumeData.personalInfo));

    const summarySection = this.buildSummary(resumeData.summary);
    if (summarySection) sections.push(summarySection);

    const experienceSection = this.buildExperienceSection(resumeData.experience);
    if (experienceSection) sections.push(experienceSection);

    const projectsSection = this.buildProjectsSection(resumeData.projects);
    if (projectsSection) sections.push(projectsSection);

    const skillsSection = this.buildSkillsSection(resumeData.skills);
    if (skillsSection) sections.push(skillsSection);

    const educationSection = this.buildEducationSection(resumeData.education);
    if (educationSection) sections.push(educationSection);

    const certificationsSection = this.buildCertificationsSection(resumeData.certifications);
    if (certificationsSection) sections.push(certificationsSection);

    const awardsSection = this.buildAwardsSection(resumeData.awards);
    if (awardsSection) sections.push(awardsSection);

    return sections.filter(Boolean).join('\n\n');
  }

  private buildHeader(personalInfo: PersonalInfo): string {
    const name = personalInfo.name?.trim() ? personalInfo.name.trim() : 'Your Name';
    const contactParts: string[] = [];

    if (personalInfo.location) {
      contactParts.push(this.escapeLatex(personalInfo.location));
    }
    if (personalInfo.phone) {
      contactParts.push(this.escapeLatex(personalInfo.phone));
    }
    if (personalInfo.email) {
      const email = personalInfo.email.trim();
      contactParts.push(`\\href{mailto:${email}}{${this.escapeLatex(email)}}`);
    }
    if (personalInfo.linkedin) {
      const linkedin = this.normalizeUrl(personalInfo.linkedin);
      if (linkedin) {
        contactParts.push(`\\href{${linkedin}}{LinkedIn}`);
      }
    }
    if (personalInfo.github) {
      const github = this.normalizeUrl(personalInfo.github);
      if (github) {
        contactParts.push(`\\href{${github}}{GitHub}`);
      }
    }
    if (personalInfo.website) {
      const website = this.normalizeUrl(personalInfo.website);
      if (website) {
        contactParts.push(`\\href{${website}}{Portfolio}`);
      }
    }

    if (contactParts.length === 0) {
      contactParts.push('Add your preferred contact details');
    }

    return `\\begin{center}\n    {\\Huge \\scshape ${this.escapeLatex(name)}} \\ \\vspace{1pt}\n    ${contactParts.join(' $|$ ')} \\\n\\end{center}`;
  }

  private buildSummary(summary?: string): string {
    const trimmedSummary = summary?.trim();
    if (!trimmedSummary) {
      return '';
    }

    return `\\section{Professional Summary}\n\\small{${this.escapeLatex(trimmedSummary)}}`;
  }

  private buildExperienceSection(experience: Experience[]): string {
    if (!experience || experience.length === 0) {
      return '';
    }

    const entries = experience.map(exp => {
      const bullets = this.toBulletLines(exp.bullets || [], 'Describe your impact with quantified achievements and relevant skills.');
      const dateRange = this.formatDateRange(exp.startDate, exp.endDate);
      const company = this.escapeLatex(exp.company || 'Company Name');
      const role = this.escapeLatex(exp.position || 'Role Title');
      const location = this.escapeLatex(exp.location || '');

      return `    \\resumeSubheading\n      {${role}}{${this.escapeLatex(dateRange)}}\n      {${company}}{${location}}\n      \\resumeItemListStart\n${bullets}\n      \\resumeItemListEnd`;
    }).join('\n\\vspace{-16pt}\n');

    return `%-----------PROFESSIONAL EXPERIENCE-----------\n\\section{Professional Experience}\n  \\resumeSubHeadingListStart\n${entries}\n  \\resumeSubHeadingListEnd\n\\vspace{-16pt}`;
  }

  private buildProjectsSection(projects?: Project[]): string {
    if (!projects || projects.length === 0) {
      return '';
    }

    const entries = projects.map(project => {
      const projectName = this.escapeLatex(project.name || 'Project Name');
      const techStack = project.technologies && project.technologies.length > 0
        ? ` $|$ \\emph{${this.escapeLatex(project.technologies.join(', '))}}`
        : '';

      const metaParts: string[] = [];
      if (project.startDate || project.endDate) {
        metaParts.push(this.escapeLatex(this.formatDateRange(project.startDate, project.endDate)));
      }
      if (project.url) {
        const url = this.normalizeUrl(project.url);
        if (url) {
          metaParts.push(`\\href{${url}}{Link}`);
        }
      }

      const rightColumn = metaParts.join(' $|$ ');

      const descriptionLines = project.description
        ? project.description.split(/\n+/).map(item => item.trim()).filter(Boolean)
        : [];

      const bullets = this.toBulletLines(descriptionLines, 'Summarize the project outcome, your contribution, and measurable impact.');

      return `      \\resumeProjectHeading\n          {\\textbf{${projectName}}${techStack}}{${rightColumn}}\n          \\resumeItemListStart\n${bullets}\n          \\resumeItemListEnd\n          \\vspace{-13pt}`;
    }).join('\n');

    return `%-----------PROJECTS-----------\n\\section{Projects}\n    \\vspace{-5pt}\n    \\resumeSubHeadingListStart\n${entries}\n    \\resumeSubHeadingListEnd\n\\vspace{-15pt}`;
  }

  private buildSkillsSection(skills: Skill[]): string {
    if (!skills || skills.length === 0) {
      return '';
    }

    const skillLines = skills.map(skillGroup => {
      const skillsText = skillGroup.skills && skillGroup.skills.length > 0
        ? skillGroup.skills.join(', ')
        : 'Update this section with your core competencies.';
      return `     \\textbf{${this.escapeLatex(skillGroup.category || 'Skills')}}{: ${this.escapeLatex(skillsText)}}`;
    });

    return `%-----------TECHNICAL SKILLS-----------\n\\section{Technical Skills}\n \\begin{itemize}[leftmargin=0.15in, label={}]\n    \\small{\item{\n${skillLines.join(' \\\n')} \\\n    }}\n \\end{itemize}\n \\vspace{-16pt}`;
  }

  private buildEducationSection(education: Education[]): string {
    if (!education || education.length === 0) {
      return '';
    }

    const entries = education.map(edu => {
      const degreeLine = `${edu.degree || 'Degree'}${edu.field ? ` in ${edu.field}` : ''}`;
      const dateLine = edu.graduationDate ? this.escapeLatex(edu.graduationDate) : '';
      const institution = this.escapeLatex(edu.institution || 'Institution');
      const trailing = edu.honors && edu.honors.length > 0
        ? this.escapeLatex(edu.honors.join(', '))
        : edu.gpa
          ? this.escapeLatex(`GPA: ${edu.gpa}`)
          : '';

      return `    \\resumeSubheading\n      {${this.escapeLatex(degreeLine)}}{${dateLine}}\n      {${institution}}{${trailing}}`;
    }).join('\n');

    return `%-----------EDUCATION-----------\n\\section{Education}\n  \\resumeSubHeadingListStart\n${entries}\n  \\resumeSubHeadingListEnd`;
  }

  private buildCertificationsSection(certifications?: Certification[]): string {
    if (!certifications || certifications.length === 0) {
      return '';
    }

    const items = certifications.map(cert => {
      const meta: string[] = [];
      if (cert.issuer) meta.push(`Issued by ${cert.issuer}`);
      if (cert.date) meta.push(cert.date);
      if (cert.expiryDate) meta.push(`Expires ${cert.expiryDate}`);
      if (cert.credentialId) meta.push(`ID ${cert.credentialId}`);
      const metaText = meta.length ? ` (${meta.map(m => this.escapeLatex(m)).join('; ')})` : '';
      return `    \\item ${this.escapeLatex(cert.name)}${metaText}`;
    });

    return `%-----------CERTIFICATIONS-----------\n\\section{Certifications}\n  \\begin{itemize}[leftmargin=0.15in]\n${items.join('\n')}\n  \\end{itemize}`;
  }

  private buildAwardsSection(awards?: Award[]): string {
    if (!awards || awards.length === 0) {
      return '';
    }

    const items = awards.map(award => {
      const meta: string[] = [];
      if (award.issuer) meta.push(award.issuer);
      if (award.date) meta.push(award.date);
      const metaText = meta.length ? ` (${meta.map(m => this.escapeLatex(m)).join('; ')})` : '';
      const description = award.description ? ` -- ${this.escapeLatex(award.description)}` : '';
      return `    \\item ${this.escapeLatex(award.name)}${metaText}${description}`;
    });

    return `%-----------AWARDS-----------\n\\section{Awards}\n  \\begin{itemize}[leftmargin=0.15in]\n${items.join('\n')}\n  \\end{itemize}`;
  }

  private toBulletLines(items: string[], fallback: string): string {
    const normalized = items.map(item => item.trim()).filter(Boolean);
    if (normalized.length === 0) {
      normalized.push(fallback);
    }

    return normalized.map(item => `        \\resumeItem{${this.escapeLatex(item)}}`).join('\n');
  }

  private formatDateRange(start?: string, end?: string): string {
    const trimmedStart = start?.trim();
    const trimmedEnd = end?.trim();

    if (trimmedStart && trimmedEnd) {
      return `${trimmedStart} – ${trimmedEnd}`;
    }

    if (trimmedStart && !trimmedEnd) {
      return `${trimmedStart} – Present`;
    }

    if (!trimmedStart && trimmedEnd) {
      return trimmedEnd;
    }

    return 'Present';
  }

  private normalizeUrl(url?: string): string | null {
    if (!url) {
      return null;
    }

    const trimmed = url.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.startsWith('mailto:')) {
      return encodeURI(trimmed);
    }

    if (/^https?:\/\//i.test(trimmed)) {
      return encodeURI(trimmed);
    }

    return encodeURI(`https://${trimmed}`);
  }

  private getDefaultPreamble(): string {
    return '\\documentclass[letterpaper,11pt]{article}\n';
  }

  /**
   * Escape LaTeX special characters
   */
  private escapeLatex(text: string): string {
    if (text === undefined || text === null) {
      return '';
    }

    return String(text)
      .replace(/\r?\n/g, ' ')
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/[&%$#_{}~^]/g, '\\$&')
      .replace(/</g, '\\textless{}')
      .replace(/>/g, '\\textgreater{}');
  }

  /**
   * Validate and clean parsed resume data
   */
  validateResumeData(data: ResumeData): ResumeData {
    // Ensure required fields have defaults
    if (!data.personalInfo) {
      data.personalInfo = {
        name: '',
        email: '',
        phone: '',
        location: '',
        linkedin: '',
        github: '',
        website: ''
      };
    }

    // Ensure arrays exist
    data.experience = data.experience || [];
    data.education = data.education || [];
    data.skills = data.skills || [];
    data.projects = data.projects || [];
    data.certifications = data.certifications || [];
    data.awards = data.awards || [];

    return data;
  }
}

export const resumeParser = new ResumeParser();
