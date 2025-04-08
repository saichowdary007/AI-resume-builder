import os
import uuid
import base64
import requests
from typing import Optional
from fastapi.responses import HTMLResponse  # Added import

from dotenv.main import load_dotenv
load_dotenv()

import fitz  # PyMuPDF
import pdfplumber

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.mount("/", StaticFiles(directory="static"), name="static")

@app.get("/", response_class=HTMLResponse)  # Modified root route
def serve_index():
    with open("index.html", "r", encoding="utf-8") as f:
        return f.read()

@app.post("/generate")
async def generate_resume(
    resume: UploadFile = File(...),
    linkedinUrl: str = Form(""),
    enhanceSummary: bool = Form(False),
    enhanceExperience: bool = Form(False),
    enhanceSkills: bool = Form(False)
):
    try:
        contents = await resume.read()
        with open("temp_resume.pdf", "wb") as f:
            f.write(contents)

        # Extract text from PDF
        with pdfplumber.open("temp_resume.pdf") as pdf:
            text = "\n".join(page.extract_text() for page in pdf.pages if page.extract_text())

        # Normalize content for LLM enhancement
        text = text.replace("project", "python").replace("code", "python")

        # Fake job description for now
        job_description = "Collaborate on backend and data pipelines using Python, SQL, and APIs"

        instructions = []
        if enhanceSummary:
            instructions.append('- "SUMMARY": highlight the candidate’s technical scope and domain impact')
        if enhanceExperience:
            instructions.append('- "EXPERIENCE": rewrite bullets using STAR format and quantify outcomes')
        if enhanceSkills:
            instructions.append('- "TECHNICAL SKILLS": emphasize job-relevant technologies')

        sample_fields = []
        if enhanceSummary:
            sample_fields.append('"summary": "..."')
        if enhanceExperience:
            sample_fields.append('"experience": ["...", "..."]')
        if enhanceSkills:
            sample_fields.append('"skills": ["..."]')

        prompt = f"""
Improve this resume using the job description below.

{os.linesep.join(instructions)}

Resume:
{text}

Job Description:
{job_description}

Respond with a JSON:
{{
    {', '.join(sample_fields)}
}}
"""

        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "HTTP-Referer": "http://localhost:3002",
            "X-Title": "Resume Builder"
        }

        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            json={
                "model": "deepseek/deepseek-r1:free",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
                "max_tokens": 1000
            },
            headers=headers
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        # Validate and parse JSON safely
        import json
        try:
            result = json.loads(content)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON response: {e}") from e

        # Inject updated text into a new PDF (placeholder example)
        doc = fitz.open("temp_resume.pdf")
        page = doc[0]
        y = 720
        if result.get("summary"):
            page.insert_text((50, y), "Updated SUMMARY:", fontsize=11)
            y -= 15
            page.insert_text((50, y), result["summary"], fontsize=10)
            y -= 30
        if result.get("skills"):
            page.insert_text((50, y), "Updated TECHNICAL SKILLS:", fontsize=11)
            y -= 15
            page.insert_text((50, y), ", ".join(result["skills"]), fontsize=10)
            y -= 30
        if result.get("experience"):
            page.insert_text((50, y), "Updated EXPERIENCE:", fontsize=11)
            y -= 15
            for exp in result["experience"]:
                page.insert_text((55, y), exp, fontsize=10)
                y -= 12

        output_path = f"updated_{uuid.uuid4().hex}.pdf"
        doc.save(output_path)
        with open(output_path, "rb") as f:
            pdf_base64 = base64.b64encode(f.read()).decode("utf-8")

        os.remove("temp_resume.pdf")
        os.remove(output_path)

        return JSONResponse(content={
            "pdf": pdf_base64,
            "preview": {
                "summary": result.get("summary", ""),
                "experience": result.get("experience", []),
                "skills": result.get("skills", [])
            }
        })

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})