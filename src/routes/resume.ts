import express from 'express';
import multer from 'multer';
import path from 'path';
import { resumeParser } from '../services/resumeParser';
import { storageService } from '../services/storage';
import { ResumeData } from '../types';
import { validateRequest, resumeUploadSchema, asyncHandler } from '../middleware/validation';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'temp/',
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and DOCX files are allowed.'));
    }
  }
});

/**
 * POST /api/resume/upload
 * Upload and parse a resume file (PDF or DOCX)
 */
router.post('/upload', upload.single('resume'), validateRequest(resumeUploadSchema), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new Error('No file uploaded. Please upload a PDF or DOCX file');
  }

  const file = req.file;
  let parsedData: ResumeData;

  // Parse based on file type
  if (file.mimetype === 'application/pdf') {
    parsedData = await resumeParser.parsePDF(file.path);
  } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    parsedData = await resumeParser.parseDOCX(file.path);
  } else {
    throw new Error('Unsupported file type. Only PDF and DOCX files are supported');
  }

  // Validate and clean the parsed data
  const validatedData = resumeParser.validateResumeData(parsedData);

  // Save the uploaded file for future reference
  const savedFilename = await storageService.saveUploadedFile(file);

  // Clean up temp file
  const fs = require('fs');
  try {
    fs.unlinkSync(file.path);
  } catch (cleanupError) {
    console.error('Failed to cleanup temp file:', cleanupError);
  }

  res.json({
    success: true,
    data: validatedData,
    fileId: savedFilename,
    message: 'Resume parsed successfully'
  });
}));

/**
 * POST /api/resume/parse
 * Parse resume data from JSON (for manual entry or corrections)
 */
router.post('/parse', async (req, res) => {
  try {
    const { resumeData } = req.body;

    if (!resumeData) {
      return res.status(400).json({
        error: 'Missing resume data',
        message: 'Please provide resume data to parse'
      });
    }

    // Validate the resume data structure
    const validatedData = resumeParser.validateResumeData(resumeData as ResumeData);

    res.json({
      success: true,
      data: validatedData,
      message: 'Resume data validated successfully'
    });

  } catch (error) {
    console.error('Resume parse error:', error);
    res.status(500).json({
      error: 'Failed to parse resume data',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * GET /api/resume/:id
 * Get resume data by ID (placeholder for future use)
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // For now, return empty resume structure
    // In future, this could retrieve saved resumes from storage
    const emptyResume: ResumeData = {
      personalInfo: {
        name: '',
        email: '',
        phone: '',
        location: '',
        linkedin: '',
        github: '',
        website: ''
      },
      summary: '',
      experience: [],
      education: [],
      skills: [],
      projects: [],
      certifications: [],
      awards: []
    };

    res.json({
      success: true,
      data: emptyResume
    });

  } catch (error) {
    console.error('Get resume error:', error);
    res.status(500).json({
      error: 'Failed to get resume',
      message: 'Internal server error'
    });
  }
});

export default router;
