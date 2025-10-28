import { analyzeJobDescription } from '../routes/job';

describe('Job Analysis', () => {
  describe('analyzeJobDescription', () => {
    it('should extract technical skills from job description', () => {
      const jobDescription = `
        We are looking for a Senior Software Engineer with experience in:
        - JavaScript, React, Node.js
        - Python for backend services
        - AWS cloud infrastructure
        - Docker containerization
        The ideal candidate will have strong problem-solving skills and excellent communication abilities.
      `;

      const result = analyzeJobDescription(jobDescription, 'Senior Software Engineer');

      expect(result.skills).toContain('JavaScript');
      expect(result.skills).toContain('React');
      expect(result.skills).toContain('Node.js');
      expect(result.skills).toContain('Python');
      expect(result.skills).toContain('AWS');
      expect(result.skills).toContain('Docker');
    });

    it('should determine experience level correctly', () => {
      const seniorJob = `
        Senior Software Engineer role requiring 5+ years of experience.
        Must have led development teams and architected complex systems.
      `;

      const juniorJob = `
        Junior Developer position for recent graduates.
        0-2 years experience required.
      `;

      const seniorResult = analyzeJobDescription(seniorJob, 'Senior Software Engineer');
      const juniorResult = analyzeJobDescription(juniorJob, 'Junior Developer');

      expect(seniorResult.experienceLevel).toContain('Senior');
      expect(juniorResult.experienceLevel).toContain('Junior');
    });

    it('should extract keywords for ATS optimization', () => {
      const jobDescription = `
        Seeking talented software engineer to join our dynamic team.
        Must have experience with modern web technologies and cloud platforms.
        Strong background in agile development methodologies required.
      `;

      const result = analyzeJobDescription(jobDescription, 'Software Engineer');

      expect(result.keywords.length).toBeGreaterThan(0);
      expect(result.keywords).toContain('software');
      expect(result.keywords).toContain('engineer');
      expect(result.keywords).toContain('experience');
    });

    it('should calculate ATS score', () => {
      const jobDescription = `
        Senior Python Developer needed for our AI team.
        Experience with machine learning frameworks required.
        Strong background in data science and statistics.
      `;

      const result = analyzeJobDescription(jobDescription, 'Senior Python Developer');

      expect(result.atsScore).toBeGreaterThanOrEqual(0);
      expect(result.atsScore).toBeLessThanOrEqual(100);
    });

    it('should provide optimization recommendations', () => {
      const jobDescription = `
        Frontend Developer position requiring React expertise.
        Must have experience with modern JavaScript frameworks.
      `;

      const result = analyzeJobDescription(jobDescription, 'Frontend Developer');

      expect(result.recommendations).toHaveLength(5); // Should have 5 recommendations
      expect(result.recommendations[0]).toContain('keywords');
    });
  });
});
