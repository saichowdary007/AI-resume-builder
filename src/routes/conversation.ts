import express from 'express';
import winston from 'winston';
import { storageService } from '../services/storage';
import { minimaxService } from '../services/minimaxService';
import { resumeParser } from '../services/resumeParser';
import { Conversation, Message } from '../types';
import { validateRequest, conversationCreateSchema, messageSendSchema, asyncHandler } from '../middleware/validation';

const router = express.Router();

/**
 * POST /api/conversation/create
 * Create a new conversation thread for a job application
 */
router.post('/create', validateRequest(conversationCreateSchema), asyncHandler(async (req, res) => {
  const { jobTitle, company, jobDescription, resumeData } = req.body;

  const initialResume = resumeData
    ? resumeParser.validateResumeData(JSON.parse(JSON.stringify(resumeData)))
    : undefined;

  let conversation = await storageService.createConversation(
    jobTitle,
    company,
    jobDescription,
    initialResume
  );

  if (initialResume) {
    await storageService.addResumeSnapshot(conversation.id, initialResume);
  }

  // Generate initial LaTeX from resume data
  const templateLatex = getDefaultLatexTemplate();
  const latexResume = resumeParser.generateLatexFromResume(
    initialResume ? initialResume : conversation.currentResume,
    templateLatex
  );

  // Update conversation with LaTeX
  await storageService.updateConversationLatex(conversation.id, latexResume);

  const refreshedConversation = await storageService.getConversation(conversation.id);
  if (refreshedConversation) {
    conversation = refreshedConversation;
  }

  conversation.currentLatexResume = latexResume;

  res.json({
    success: true,
    data: conversation,
    message: 'Conversation created successfully'
  });
}));

/**
 * GET /api/conversation/list
 * Get all conversations (with optional filtering)
 */
router.get('/list', async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;

    let conversations = await storageService.getAllConversations();

    // Filter by status if provided
    if (status) {
      conversations = conversations.filter(conv => conv.status === status);
    }

    // Sort by updated date (most recent first)
    conversations.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    // Limit results
    conversations = conversations.slice(0, parseInt(limit as string));

    res.json({
      success: true,
      data: conversations,
      count: conversations.length
    });

  } catch (error) {
    console.error('List conversations error:', error);
    res.status(500).json({
      error: 'Failed to list conversations',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * GET /api/conversation/:id
 * Get a specific conversation by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const conversation = await storageService.getConversation(id);

    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation not found',
        message: `No conversation found with ID: ${id}`
      });
    }

    res.json({
      success: true,
      data: conversation
    });

  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      error: 'Failed to get conversation',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * POST /api/conversation/:id/message
 * Add a message to a conversation (user input)
 */
router.post('/:id/message', validateRequest(messageSendSchema), asyncHandler(async (req, res) => {
  console.log('=== MESSAGE ROUTE HIT ===', req.params.id);
  const { id } = req.params;
  const { content, role = 'user' } = req.body;

  // Check if conversation exists
  const existingConversation = await storageService.getConversation(id);
  if (!existingConversation) {
    const error = new Error(`Conversation not found with ID: ${id}`);
    (error as any).statusCode = 404;
    throw error;
  }

  // Add the user message
  const userMessage = await storageService.addMessage(id, {
    role: role as 'user' | 'assistant' | 'system',
    content
  });

  if (!userMessage) {
    throw new Error('Could not add message to conversation');
  }

  // Get conversation history for context
  const currentConversation = await storageService.getConversation(id);
  if (!currentConversation) {
    throw new Error('Conversation disappeared during processing');
  }

  // Prepare conversation history for LLM
  const history = currentConversation.messages.slice(-10).map(msg => `${msg.role}: ${msg.content}`);

  let llmResponse;

  try {
    // Check if this is a resume optimization request
    const isOptimizationRequest = content.toLowerCase().includes('optimize') ||
                              content.toLowerCase().includes('tailor') ||
                              content.toLowerCase().includes('update') ||
                              content.toLowerCase().includes('improve') ||
                              !!currentConversation.jobDescription;

    winston.info('Optimization check:', {
      isOptimizationRequest,
      content: content.toLowerCase(),
      hasJobDescription: !!currentConversation.jobDescription,
      hasLatexResume: !!currentConversation.currentLatexResume,
      jobDescriptionLength: currentConversation.jobDescription?.length || 0,
      latexResumeLength: currentConversation.currentLatexResume?.length || 0,
      conditionResult: isOptimizationRequest && !!currentConversation.currentLatexResume
    });

    if (isOptimizationRequest && currentConversation.currentLatexResume) {
      winston.info('Using LaTeX optimization path');
      require('fs').appendFileSync('/tmp/route_debug.log', `About to call MiniMax service\n`);
      // Use LaTeX optimization
      llmResponse = await minimaxService.processUserMessage(
        content,
        currentConversation.currentResume,
        currentConversation.jobDescription || '',
        history,
        currentConversation.currentLatexResume,
        'NONE' // User notes - could be expanded
      );

      // Update the stored LaTeX with the optimized version
      if (llmResponse.message && llmResponse.action === 'latex_update') {
        winston.info('Updating LaTeX resume with optimized version, length:', llmResponse.message.length);
        await storageService.updateConversationLatex(currentConversation.id, llmResponse.message);
        currentConversation.currentLatexResume = llmResponse.message;
      }
    } else {
      winston.info('Using regular conversation path');
      // Use regular conversation
      llmResponse = await minimaxService.processUserMessage(
        content,
        currentConversation.currentResume,
        currentConversation.jobDescription || '',
        history
      );
    }
  } catch (error) {
    console.error('LLM processing error:', error);
    // Use fallback response
    llmResponse = await minimaxService.processUserMessage(
      content,
      currentConversation.currentResume,
      currentConversation.jobDescription || '',
      history
    );
  }

  // Add AI response to conversation
  const aiMessage = await storageService.addMessage(id, {
    role: 'assistant',
    content: llmResponse.message
  });

  // Update resume if changes were made
  if (llmResponse.updatedResume) {
    await storageService.addResumeSnapshot(id, llmResponse.updatedResume);
  }

  res.json({
    success: true,
    data: {
      userMessage,
      aiMessage,
      llmResponse,
      conversationId: id
    },
    message: 'Message processed and resume updated'
  });
}));

/**
 * PUT /api/conversation/:id
 * Update conversation metadata
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Validate updates
    const allowedFields = ['jobTitle', 'company', 'jobDescription', 'status'];
    const filteredUpdates: Partial<Conversation> = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        (filteredUpdates as any)[field] = updates[field];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({
        error: 'No valid updates provided',
        message: 'Please provide at least one valid field to update'
      });
    }

    const updatedConversation = await storageService.updateConversation(id, filteredUpdates);

    if (!updatedConversation) {
      return res.status(404).json({
        error: 'Conversation not found',
        message: `No conversation found with ID: ${id}`
      });
    }

    res.json({
      success: true,
      data: updatedConversation,
      message: 'Conversation updated successfully'
    });

  } catch (error) {
    console.error('Update conversation error:', error);
    res.status(500).json({
      error: 'Failed to update conversation',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * DELETE /api/conversation/:id
 * Delete a conversation
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await storageService.deleteConversation(id);

    if (!deleted) {
      return res.status(404).json({
        error: 'Conversation not found',
        message: `No conversation found with ID: ${id}`
      });
    }

    res.json({
      success: true,
      message: 'Conversation deleted successfully'
    });

  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({
      error: 'Failed to delete conversation',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

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
