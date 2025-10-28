# Resume Builder - AI-Powered Resume Optimization Platform

An intelligent resume optimization platform that leverages MiniMax M3 API for dynamic LaTeX resume generation and ATS-optimized PDF outputs.

## Features

- **AI-Powered Resume Optimization**: Uses MiniMax M3 (Anthropic-compatible API) for intelligent resume tailoring
- **Dynamic LaTeX Generation**: Automatically generates ATS-optimized LaTeX resumes
- **Conversational Interface**: Natural language interaction for resume refinement
- **Local File Storage**: No database required - uses local JSON storage
- **Real-time PDF Generation**: Convert LaTeX to professional PDFs using Puppeteer

## Setup

### 1. Environment Configuration

Create a `.env` file in the root directory with your MiniMax API credentials:

```bash
# MiniMax M3 API Configuration (Anthropic-compatible)
MINIMAX_API_KEY=your_minimax_api_key_here
ANTHROPIC_API_KEY=your_minimax_api_key_here

# API Base URLs (Anthropic-compatible for M3)
MINIMAX_BASE_URL=https://api.minimax.io/anthropic
ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic

# Model Configuration
MINIMAX_MODEL=MiniMax-M3
MINIMAX_MODEL_FALLBACK=MiniMax-M2

# Server Configuration
PORT=3001
NODE_ENV=development
```

### 2. Get MiniMax API Key

1. Visit [MiniMax API](https://api.minimax.chat)
2. Sign up for an account
3. Generate an API key
4. Add the key to your `.env` file

### 3. Install Dependencies

```bash
npm install
cd frontend && npm install
```

### 4. Build and Run

```bash
# Build the backend
npm run build

# Run the backend
npm run dev

# In another terminal, run the frontend
cd frontend && npm run dev
```

## API Configuration

### MiniMax M3 Integration

The system uses MiniMax's Anthropic-compatible API for the M3 model:

- **Base URL**: `https://api.minimax.io/anthropic`
- **Model**: `MiniMax-M3` (primary), `MiniMax-M2` (fallback)
- **API Format**: Anthropic-compatible with `/messages` endpoint

### Alternative OpenAI-Compatible API

If needed, you can switch to OpenAI-compatible format:

```bash
MINIMAX_BASE_URL=https://api.minimax.io/v1
OPENAI_API_KEY=your_minimax_api_key_here
```

## Usage

1. **Upload Resume**: Upload your resume (PDF or DOCX)
2. **Enter Job Description**: Paste the target job description
3. **AI Optimization**: Use natural language to request resume optimizations
4. **Generate PDF**: Download your ATS-optimized resume as PDF

## Architecture

- **Backend**: Node.js + TypeScript + Express
- **Frontend**: Next.js + React + Tailwind CSS
- **AI**: MiniMax M3 API (Anthropic-compatible)
- **Storage**: Local JSON files (no database required)
- **PDF Generation**: Puppeteer for HTML-to-PDF conversion

## Key Components

- `src/services/minimaxService.ts`: MiniMax M3 API integration
- `src/services/resumeParser.ts`: Resume parsing and LaTeX generation
- `src/routes/conversation.ts`: Conversation management with LaTeX optimization
- `src/routes/pdf.ts`: PDF generation from LaTeX templates

## Testing

```bash
npm test
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MINIMAX_API_KEY` | Your MiniMax API key | - |
| `MINIMAX_BASE_URL` | API base URL | `https://api.minimax.io/anthropic` |
| `MINIMAX_MODEL` | Primary model | `MiniMax-M3` |
| `PORT` | Server port | `3001` |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
