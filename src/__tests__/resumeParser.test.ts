import { resumeParser } from '../services/resumeParser';
import { ResumeData } from '../types';

describe('ResumeParser', () => {
  describe('validateResumeData', () => {
    it('should ensure required fields exist', () => {
      const input = {} as ResumeData;
      const result = resumeParser.validateResumeData(input);

      expect(result).toHaveProperty('personalInfo');
      expect(result).toHaveProperty('experience');
      expect(result).toHaveProperty('education');
      expect(result).toHaveProperty('skills');
      expect(result.personalInfo).toHaveProperty('name', '');
      expect(Array.isArray(result.experience)).toBe(true);
      expect(Array.isArray(result.education)).toBe(true);
      expect(Array.isArray(result.skills)).toBe(true);
    });

    it('should preserve existing data', () => {
      const input: ResumeData = {
        personalInfo: {
          name: 'John Doe',
          email: 'john@example.com'
        },
        experience: [],
        education: [],
        skills: []
      };

      const result = resumeParser.validateResumeData(input);

      expect(result.personalInfo.name).toBe('John Doe');
      expect(result.personalInfo.email).toBe('john@example.com');
    });
  });

  describe('extractPersonalInfo', () => {
    it('should extract name from first line', () => {
      const lines = ['John Doe', 'john@example.com', 'New York, NY'];
      const result = (resumeParser as any).extractPersonalInfo(lines);

      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
    });

    it('should extract contact information', () => {
      const lines = [
        'Jane Smith',
        'jane.smith@email.com | (555) 123-4567 | linkedin.com/in/janesmith'
      ];
      const result = (resumeParser as any).extractPersonalInfo(lines);

      expect(result.name).toBe('Jane Smith');
      expect(result.email).toBe('jane.smith@email.com');
      expect(result.phone).toBe('(555) 123-4567');
      expect(result.linkedin).toBe('linkedin.com/in/janesmith');
    });
  });

  describe('extractExperience', () => {
    it('should parse job experience entries', () => {
      const lines = [
        'Experience',
        'Senior Developer at Tech Corp | Jan 2020 - Present',
        '• Developed web applications using React and Node.js',
        '• Led a team of 5 developers',
        'Software Engineer at Startup Inc | Jun 2018 - Dec 2019',
        '• Built RESTful APIs',
        '• Implemented CI/CD pipelines'
      ];

      const result = (resumeParser as any).extractExperience(lines);

      expect(result).toHaveLength(2);
      expect(result[0].position).toBe('Senior Developer');
      expect(result[0].company).toBe('Tech Corp');
      expect(result[0].bullets).toHaveLength(2);
      expect(result[1].position).toBe('Software Engineer');
      expect(result[1].company).toBe('Startup Inc');
    });
  });

  describe('extractSkills', () => {
    it('should categorize skills appropriately', () => {
      const lines = [
        'Skills',
        'JavaScript, Python, React, Node.js, SQL, Git, Docker, AWS'
      ];

      const result = (resumeParser as any).extractSkills(lines);

      expect(result.length).toBeGreaterThan(0);
      const technicalSkills = result.find((group: any) => group.category === 'Technical Skills');
      expect(technicalSkills).toBeDefined();
      expect(technicalSkills.skills).toContain('JavaScript');
      expect(technicalSkills.skills).toContain('React');
    });
  });
});
