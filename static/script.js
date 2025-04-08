// Configuration object
const CONFIG = {
    API_URL: process.env.API_URL || 'http://localhost:3002',
    TIMEOUT: 30000 // 30 seconds timeout
};

document.getElementById('resumeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const loading = document.getElementById('loading');
    const toast = document.getElementById('toast');
    loading.classList.remove('hidden');
    toast.classList.add('hidden');

    const form = document.getElementById('resumeForm');
    const resumeFile = form.querySelector('#resumeUpload').files[0];
    const linkedinUrl = form.querySelector('#linkedinUrl').value;

    // Input validation
    if (!resumeFile) {
        showError('Please upload a resume file');
        return;
    }
    if (!resumeFile.name.endsWith('.pdf')) {
        showError('Please upload a PDF file');
        return;
    }
    if (!linkedinUrl || !isValidUrl(linkedinUrl)) {
        showError('Please enter a valid LinkedIn URL');
        return;
    }

    const formData = new FormData();
    formData.append('resume', resumeFile);
    formData.append('linkedinUrl', linkedinUrl);
    formData.set('enhanceSummary', form.querySelector('[name="enhanceSummary"]').checked.toString());
    formData.set('enhanceExperience', form.querySelector('[name="enhanceExperience"]').checked.toString());
    formData.set('enhanceSkills', form.querySelector('[name="enhanceSkills"]').checked.toString());

    try {
        const response = await fetch(`${CONFIG.API_URL}/generate`, {
            method: 'POST',
            body: formData,
            timeout: CONFIG.TIMEOUT
        });

        if (!response.ok) throw new Error(`Generation failed: ${response.statusText}`);
        
        const result = await response.json();
        console.log('Server response:', result);
        
        displayPreview(result.preview);
        await downloadPDF(result.pdf);
        
        loading.classList.add('hidden');
        showToast('✅ Resume downloaded successfully!');
    } catch (error) {
        loading.classList.add('hidden');
        showError(`Error generating resume: ${error.message}`);
    }
});

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

function displayPreview(previewData) {
    const previewContainer = document.getElementById('preview');
    document.getElementById('previewSummary').textContent = previewData.summary || 'Not updated';
    document.getElementById('previewSkills').textContent = previewData.skills.length ? previewData.skills.join(', ') : 'Not updated';
    document.getElementById('previewExperience').textContent = previewData.experience.length ? previewData.experience.join('\n') : 'Not updated';
    previewContainer.classList.remove('hidden');
}

async function downloadPDF(pdfData) {
    const byteCharacters = atob(pdfData);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
        const slice = byteCharacters.slice(offset, offset + 1024);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        byteArrays.push(new Uint8Array(byteNumbers));
    }

    const blob = new Blob(byteArrays, { type: 'application/pdf' });
    const downloadUrl = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `generated_resume_${new Date().toISOString().slice(0,10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    document.getElementById('downloadLink').href = downloadUrl;
    document.getElementById('output').classList.remove('hidden');
}

function showToast(message) {
    const toast = document.getElementById('toast');
    document.getElementById('toastMessage').textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 5000);
}

function showError(message) {
    alert(message);
    document.getElementById('loading').classList.add('hidden');
}