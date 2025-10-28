import express from 'express';
import path from 'path';
import fs from 'fs-extra';
import puppeteer from 'puppeteer';
import latex from 'node-latex';
import { ResumeData } from '../types';
import { validateRequest, pdfGenerateSchema, asyncHandler } from '../middleware/validation';

const router = express.Router();

/**
 * POST /api/pdf/generate
 * Generate PDF from resume data
 */
router.post('/generate', validateRequest(pdfGenerateSchema), asyncHandler(async (req, res) => {
  const { resumeData, template = 'default', options = {} } = req.body;

  // Validate resume data structure
  const resume = resumeData as ResumeData;

  const rawLatexContent = typeof options.latexContent === 'string' ? options.latexContent : '';
  const latexCandidate = rawLatexContent.trimStart();
  const company = options.company || 'General';
  const filename = buildPdfFilename(resume, company);

  if (latexCandidate.startsWith('\\documentclass')) {
    try {
      const pdfBuffer = await compileLatexToPdf(rawLatexContent);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
      return;
    } catch (latexError) {
      console.error('LaTeX compilation failed, falling back to HTML rendering:', latexError);
    }
  }

  const htmlContent = rawLatexContent && !latexCandidate.startsWith('\\documentclass')
    ? rawLatexContent
    : generateHTMLContent(resume, template);

  const pdfBuffer = await renderHtmlToPdf(htmlContent);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(pdfBuffer);
}));

/**
 * GET /api/pdf/download/:filename
 * Download generated PDF file
 */
router.get('/download/:filename', async (req, res) => {
  try {
    const { filename } = req.params;

    // For now, return a placeholder response
    // TODO: Implement actual PDF file serving

    res.json({
      success: false,
      message: 'PDF download not yet implemented',
      filename
    });

  } catch (error) {
    console.error('PDF download error:', error);
    res.status(500).json({
      error: 'Failed to download PDF',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * POST /api/pdf/preview
 * Generate preview data and LaTeX content for resume
 */
router.post('/preview', async (req, res) => {
  try {
    const { resumeData, template = 'default' } = req.body;

    if (!resumeData) {
      return res.status(400).json({
        error: 'Missing resume data',
        message: 'Please provide resume data for preview'
      });
    }

    const resume = resumeData as ResumeData;

    // Generate HTML content for preview
    const latexContent = generateHTMLContent(resume, template);

    // Generate preview structure
    const preview = {
      personalInfo: resume.personalInfo,
      summary: resume.summary,
      experience: resume.experience.slice(0, 3), // Limit for preview
      education: resume.education,
      skills: resume.skills,
      template,
      sections: getResumeSections(resume),
      latexContent
    };

    res.json({
      success: true,
      data: preview,
      message: 'Resume preview generated successfully'
    });

  } catch (error) {
    console.error('PDF preview error:', error);
    res.status(500).json({
      error: 'Failed to generate preview',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * GET /api/pdf/templates
 * Get available LaTeX templates
 */
router.get('/templates', async (req, res) => {
  try {
    // Placeholder templates list
    const templates = [
      {
        id: 'default',
        name: 'Modern Professional',
        description: 'Clean, ATS-friendly template with professional styling'
      },
      {
        id: 'compact',
        name: 'Compact',
        description: 'Space-efficient template for maximizing content'
      },
      {
        id: 'creative',
        name: 'Creative',
        description: 'Modern design with visual elements (use with caution for ATS)'
      }
    ];

    res.json({
      success: true,
      data: templates
    });

  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({
      error: 'Failed to get templates',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

async function renderHtmlToPdf(htmlContent: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfData = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in'
      }
    });

    return Buffer.from(pdfData);
  } finally {
    await browser.close();
  }
}

async function compileLatexToPdf(latexContent: string): Promise<Buffer> {
  const logsDir = path.join(process.cwd(), 'logs');
  await fs.ensureDir(logsDir);

  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const pdfStream = latex(latexContent, {
      args: ['-interaction=nonstopmode', '-halt-on-error'],
      errorLogs: path.join(logsDir, 'latex-error.log')
    });

    pdfStream.on('data', (chunk: Uint8Array) => {
      const bufferChunk: Buffer = Buffer.from(chunk);
      chunks.push(bufferChunk);
    });
    pdfStream.on('error', reject);
    pdfStream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function buildPdfFilename(resume: ResumeData, company: string): string {
  const timestamp = new Date().toISOString().slice(0, 10);
  const rawName = resume.personalInfo.name || 'Resume';
  const sanitizedName = rawName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'Resume';
  const sanitizedCompany = company.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'General';
  return `${sanitizedName}_Resume_${sanitizedCompany}_${timestamp}.pdf`;
}

/**
 * Generate HTML content from resume data
 */
function generateHTMLContent(resume: ResumeData, template: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${resume.personalInfo.name || 'Resume'} - Professional Resume</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 20px;
        }
        .name {
            font-size: 28px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 10px;
        }
        .contact {
            font-size: 14px;
            color: #6b7280;
        }
        .section {
            margin-bottom: 25px;
        }
        .section-title {
            font-size: 18px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 15px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 5px;
        }
        .experience-item {
            margin-bottom: 20px;
        }
        .job-title {
            font-weight: bold;
            font-size: 16px;
        }
        .company {
            color: #2563eb;
            font-weight: 500;
        }
        .date {
            float: right;
            color: #6b7280;
            font-size: 14px;
        }
        .bullet-list {
            margin-top: 8px;
        }
        .bullet {
            margin-bottom: 4px;
            padding-left: 15px;
            position: relative;
        }
        .bullet:before {
            content: "•";
            color: #2563eb;
            position: absolute;
            left: 0;
        }
        .skills-container {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }
        .skill-tag {
            background: #eff6ff;
            color: #2563eb;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 14px;
        }
        .education-item {
            margin-bottom: 15px;
        }
        .degree {
            font-weight: bold;
        }
        .institution {
            color: #6b7280;
        }
        .summary {
            text-align: justify;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="name">${resume.personalInfo.name || 'Your Name'}</div>
        <div class="contact">
            ${[
              resume.personalInfo.email,
              resume.personalInfo.phone,
              resume.personalInfo.location
            ].filter(Boolean).join(' | ')}
        </div>
    </div>

    ${resume.summary ? `
    <div class="section">
        <div class="section-title">Professional Summary</div>
        <div class="summary">${resume.summary}</div>
    </div>
    ` : ''}

    ${resume.experience.length > 0 ? `
    <div class="section">
        <div class="section-title">Experience</div>
        ${resume.experience.map(exp => `
        <div class="experience-item">
            <div class="job-title">${exp.position}</div>
            <div class="company">${exp.company}${exp.location ? `, ${exp.location}` : ''}</div>
            <div class="date">${exp.startDate || ''} - ${exp.endDate || 'Present'}</div>
            ${exp.bullets.length > 0 ? `
            <div class="bullet-list">
                ${exp.bullets.map(bullet => `<div class="bullet">${bullet}</div>`).join('')}
            </div>
            ` : ''}
        </div>
        `).join('')}
    </div>
    ` : ''}

    ${resume.education.length > 0 ? `
    <div class="section">
        <div class="section-title">Education</div>
        ${resume.education.map(edu => `
        <div class="education-item">
            <div class="degree">${edu.degree}${edu.field ? ` in ${edu.field}` : ''}</div>
            <div class="institution">${edu.institution}${edu.graduationDate ? `, ${edu.graduationDate}` : ''}</div>
            ${edu.gpa ? `<div>GPA: ${edu.gpa}</div>` : ''}
        </div>
        `).join('')}
    </div>
    ` : ''}

    ${resume.skills.length > 0 ? `
    <div class="section">
        <div class="section-title">Skills</div>
        ${resume.skills.map(skillGroup => `
        <div style="margin-bottom: 15px;">
            <div style="font-weight: bold; margin-bottom: 8px;">${skillGroup.category}</div>
            <div class="skills-container">
                ${skillGroup.skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
            </div>
        </div>
        `).join('')}
    </div>
    ` : ''}
</body>
</html>
  `.trim();
}

/**
 * Get resume sections for preview
 */
function getResumeSections(resume: ResumeData): string[] {
  const sections: string[] = [];

  if (resume.summary) sections.push('summary');
  if (resume.experience.length > 0) sections.push('experience');
  if (resume.education.length > 0) sections.push('education');
  if (resume.skills.length > 0) sections.push('skills');
  if (resume.projects && resume.projects.length > 0) sections.push('projects');
  if (resume.certifications && resume.certifications.length > 0) sections.push('certifications');
  if (resume.awards && resume.awards.length > 0) sections.push('awards');

  return sections;
}

/**
 * Get the default LaTeX template
 */
function getDefaultLatexTemplate(): string {
  return `\\documentclass[letterpaper,11pt]{article}

\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
\\usepackage{fontawesome5}
\\usepackage{multicol}
\\setlength{\\multicolsep}{-3.0pt}
\\setlength{\\columnsep}{-1pt}
\\input{glyphtounicode}

\\pagestyle{fancy}
\\fancyhf{} % clear all header and footer fields
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

% Adjust margins
\\addtolength{\\oddsidemargin}{-0.6in}
\\addtolength{\\evensidemargin}{-0.5in}
\\addtolength{\\textwidth}{1.19in}
\\addtolength{\\topmargin}{-.7in}
\\addtolength{\\textheight}{1.4in}

\\urlstyle{same}

\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

% Sections formatting
\\titleformat{\\section}{
  \\vspace{-4pt}\\scshape\\raggedright\\large\\bfseries
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

% Ensure that generate pdf is machine readable/ATS parsable
\\pdfgentounicode=1

%-------------------------
% Custom commands
\\newcommand{\\resumeItem}[1]{
  \\item\\small{
    {#1 \\vspace{-2pt}}
  }
}

\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-2pt}\\item
    \\begin{tabular*}{1.0\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & \\textbf{\\small #2} \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeProjectHeading}[2]{
    \\item
    \\begin{tabular*}{1.001\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\small#1 & \\textbf{\\small #2}\\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\renewcommand\\labelitemi{$\\vcenter{\\hbox{\\tiny$\\bullet$}}$}
\\renewcommand\\labelitemii{$\\vcenter{\\hbox{\\tiny$\\bullet$}}$}

\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.0in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}

%-------------------------------------------
%%%%%%  RESUME STARTS HERE  %%%%%%%%%%%%%%%%%%%%%%%%%%%%

\\begin{document}

%----------HEADING----------
\\begin{center}
    {\\Huge \\scshape JANE A. DOE} \\\\ \\vspace{1pt}
    +1(555)123-4567 $|$ \\href{mailto:jane.doe.dev@email.com}{jane.doe.dev@email.com} $|$ \\href{https://github.com/janedoe}{GitHub} $|$ \\href{https://leetcode.com/janedoe}{LeetCode} $|$ \\href{https://janedoe.dev}{Portfolio} \\\\
\\end{center}

%-----------PROFESSIONAL SUMMARY-----------
\\section{Professional Summary}
\\small{Driven AI Engineer with 2+ years of experience in creating scalable machine learning solutions. Proficient in Python, TensorFlow, and cloud platforms (AWS, GCP). Proven ability to design and deploy end-to-end AI models, from RAG pipelines to predictive analytics, to solve complex business problems.}

%-----------PROFESSIONAL EXPERIENCE-----------
\\section{Professional Experience}
  \\resumeSubHeadingListStart
    \\resumeSubheading
      {AI Engineer}{07/2023 – Present}
      {TechSolutions Inc.}{San Francisco, CA}
      \\resumeItemListStart
        \\resumeItem{Engineered and deployed a company-wide semantic search (RAG) system using LangChain and vector databases (FAISS), improving internal knowledge retrieval speed by 40\\%.}
        \\resumeItem{Developed and maintained scalable data processing pipelines using Python (Pandas, Dask) for cleaning and preparing large datasets for model training.}
        \\resumeItem{Designed, trained, and fine-tuned various LLMs (e.g., Llama 2, Mistral) for specific business tasks, including text summarization and sentiment analysis.}
        \\resumeItem{Created robust RESTful APIs using FastAPI and Flask to serve model predictions, handling over 10,000 requests per minute with low latency.}
        \\resumeItem{Containerized AI applications using Docker and managed deployments on AWS (SageMaker, S3, EC2), ensuring scalability and reproducibility.}
        \\resumeItem{Worked closely with product managers and data scientists to define project requirements and deliver AI solutions aligned with key business objectives.}
      \\resumeItemListEnd
  \\resumeSubHeadingListEnd
\\vspace{-16pt}

%-----------PROJECTS-----------
\\section{Projects}
    \\vspace{-5pt}
    \\resumeSubHeadingListStart
      \\resumeProjectHeading
          {\\textbf{Predictive Analytics Dashboard} $|$ \\emph{Python, Scikit-learn, Flask, React, PostgreSQL}}{}
          \\resumeItemListStart
            \\resumeItem{Developed a full-stack web application to visualize real-time sales forecasts using a SARIMA time-series model.}
            \\resumeItem{Built a Flask backend to serve predictions and a React frontend with D3.js for interactive data visualization.}
            \\resumeItem{Achieved 92\\% forecast accuracy, enabling better inventory management for a mock e-commerce platform.}
          \\resumeItemListEnd
          \\vspace{-13pt}
      \\resumeProjectHeading
          {\\textbf{Neural Style Transfer (NST) Bot} $|$ \\emph{PyTorch, TensorFlow Hub, Docker, Telegram API}}{}
          \\resumeItemListStart
            \\resumeItem{Implemented a deep learning model using convolutional neural networks (CNNs) to apply artistic styles from one image to another.}
            \\resumeItem{Developed a Telegram bot that allows users to upload images and receive stylized versions in real-time, packaged as a Docker container.}
          \\resumeItemListEnd
          \\vspace{-13pt}
      \\resumeProjectHeading
          {\textbf{E-commerce Recommender System} $|$ \\emph{Python, Pandas, Surprise, FastAPI}}{}
          \\resumeItemListStart
            \\resumeItem{Designed and implemented a collaborative filtering model to provide personalized product recommendations for users.}
            \\resumeItem{Built a lightweight FastAPI service to deliver top-N recommendations based on user ID, tested on the MovieLens dataset.}
          \\resumeItemListEnd
          \\vspace{-13pt}
      \\resumeProjectHeading
          {\\textbf{Autonomous AI Agent for Web Research} $|$ \\emph{LangChain, Selenium, GPT-4, FastAPI}}{}
          \\resumeItemListStart
            \\resumeItem{Built an autonomous agent that can browse the web, scrape information, and compile detailed reports based on a single user prompt.}
            \\resumeItem{Utilized LangChain agents with custom tools (Selenium for web interaction) to perform multi-step research and summarization tasks.}
          \\resumeItemListEnd
          \\vspace{-13pt}
      \\resumeProjectHeading
          {\\textbf{Real-Time Object Detection} $|$ \\emph{OpenCV, YOLOv8, WebSockets, Flask}}{}
          \\resumeItemListStart
            \\resumeItem{Developed a system to perform real-time object detection on live video streams from a webcam.}
            \\resumeItem{Used YOLOv8 for high-performance detection and WebSockets to stream bounding box coordinates to a web-based dashboard.}
          \\resumeItemListEnd
    \\resumeSubHeadingListEnd
\\vspace{-15pt}

%-----------TECHNICAL SKILLS-----------
\\section{Technical Skills}
 \\begin{itemize}[leftmargin=0.15in, label={}]]
    \\small{\\item{
     \\textbf{Programming \\& Scripting}{: Python, Java, SQL, C++} \\\\
     \\textbf{AI \\& Machine Learning}{: TensorFlow, PyTorch, Scikit-learn, LangChain, Pandas, NumPy, OpenCV} \\\\
     \\textbf{Web Frameworks \\& Frontend}{: FastAPI, Flask, React, Node.js, HTML/CSS} \\\\
     \\textbf{DevOps \\& Cloud}{: Docker, Kubernetes, AWS (SageMaker, S3), GCP, Git, CI/CD} \\\\
     \\textbf{Databases}{: PostgreSQL, MongoDB, MySQL, Vector Databases (FAISS, Pinecone)} \\\\
     \\textbf{Concepts}{: Data Structures \\& Algorithms, OOP, ETL, Semantic Search, MLOps} \\\\
    }}
 \\end{itemize}
 \\vspace{-16pt}

%-----------EDUCATION-----------
\\section{Education}
  \\resumeSubHeadingListStart
    \\resumeSubheading
      {Master of Science in Computer Science}{08/2021 – 05/2023}
      {Stanford University}{Stanford, CA, USA}
    \resumeSubheading
      {Bachelor of Science in Data Science}{08/2017 – 05/2021}
      {University of Illinois Urbana-Champaign}{Urbana, IL, USA}
  \\resumeSubHeadingListEnd

\\end{document}`;
}

export default router;
