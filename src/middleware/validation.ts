import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

const resumeDataSchema = Joi.object({
  personalInfo: Joi.object({
    name: Joi.string().allow('').required(),
    email: Joi.string().email().allow('').required(),
    phone: Joi.string().allow(''),
    location: Joi.string().allow(''),
    linkedin: Joi.string().allow(''),
    github: Joi.string().allow(''),
    website: Joi.string().allow('')
  }).required(),
  summary: Joi.string().allow(''),
  experience: Joi.array().items(Joi.object({
    company: Joi.string().allow('').required(),
    position: Joi.string().allow('').required(),
    location: Joi.string().allow(''),
    startDate: Joi.string().allow('').required(),
    endDate: Joi.string().allow(''),
    bullets: Joi.array().items(Joi.string().allow('')).required()
  })).required(),
  education: Joi.array().items(Joi.object({
    institution: Joi.string().allow('').required(),
    degree: Joi.string().allow('').required(),
    field: Joi.string().allow(''),
    graduationDate: Joi.string().allow(''),
    gpa: Joi.string().allow('')
  })).required(),
  skills: Joi.array().items(Joi.object({
    category: Joi.string().allow('').required(),
    skills: Joi.array().items(Joi.string().allow('')).required()
  })).required(),
  projects: Joi.array().items(Joi.object()).optional(),
  certifications: Joi.array().items(Joi.object()).optional(),
  awards: Joi.array().items(Joi.object()).optional()
});

// Validation schemas
export const resumeUploadSchema = Joi.object({
  file: Joi.object().required().messages({
    'any.required': 'Resume file is required'
  })
});

export const conversationCreateSchema = Joi.object({
  jobTitle: Joi.string().min(1).max(200).required().messages({
    'string.empty': 'Job title is required',
    'string.max': 'Job title must be less than 200 characters'
  }),
  company: Joi.string().min(1).max(200).required().messages({
    'string.empty': 'Company name is required',
    'string.max': 'Company name must be less than 200 characters'
  }),
  jobDescription: Joi.string().min(10).max(10000).required().messages({
    'string.empty': 'Job description is required',
    'string.min': 'Job description must be at least 10 characters',
    'string.max': 'Job description must be less than 10,000 characters'
  }),
  resumeData: resumeDataSchema.optional()
});

export const messageSendSchema = Joi.object({
  content: Joi.string().min(1).max(2000).required().messages({
    'string.empty': 'Message content is required',
    'string.max': 'Message must be less than 2,000 characters'
  }),
  role: Joi.string().valid('user', 'assistant', 'system').optional().default('user')
});

export const pdfGenerateSchema = Joi.object({
  resumeData: resumeDataSchema.required(),
  template: Joi.string().valid('default', 'compact', 'creative').optional().default('default'),
  options: Joi.object({
    company: Joi.string().optional()
  }).optional()
});

export const jobAnalysisSchema = Joi.object({
  jobDescription: Joi.string().min(10).max(10000).required().messages({
    'string.empty': 'Job description is required',
    'string.min': 'Job description must be at least 10 characters',
    'string.max': 'Job description must be less than 10,000 characters'
  }),
  jobTitle: Joi.string().max(200).optional()
});

// Validation middleware
export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // For file uploads, validate the file separately
    if (req.file && schema === resumeUploadSchema) {
      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      const maxSize = 10 * 1024 * 1024; // 10MB

      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          error: 'Invalid file type',
          message: 'Only PDF and DOCX files are allowed'
        });
      }

      if (req.file.size > maxSize) {
        return res.status(400).json({
          error: 'File too large',
          message: 'File must be less than 10MB'
        });
      }

      return next();
    }

    // For other requests, validate body/query/params
    const { error, value } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Validation failed',
        message: 'Please check your input data',
        details: errors
      });
    }

    // Replace request body with validated data
    req.body = value;
    next();
  };
};

// Error handling middleware
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Custom error class
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Global error handler
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new AppError(message, 404);
  }

  // Mongoose duplicate key
  if (err.name === 'MongoError' && (err as any).code === 11000) {
    const message = 'Duplicate field value entered';
    error = new AppError(message, 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values((err as any).errors).map((val: any) => val.message).join(', ');
    error = new AppError(message, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = new AppError(message, 401);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = new AppError(message, 401);
  }

  res.status((error as AppError).statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Not found middleware
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new AppError(`Not found - ${req.originalUrl}`, 404);
  next(error);
};
