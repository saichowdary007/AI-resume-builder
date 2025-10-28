import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Conversation, ResumeData, Message, ResumeSnapshot } from '../types';

export class LocalStorageService {
  private dataDir: string;
  private conversationsFile: string;
  private uploadsDir: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.conversationsFile = path.join(this.dataDir, 'conversations.json');
    this.uploadsDir = path.join(process.cwd(), 'uploads');

    // Initialize storage synchronously for constructor
    this.initializeStorageSync();
  }

  private initializeStorageSync(): void {
    try {
      // Use synchronous methods for constructor
      fs.ensureDirSync(this.dataDir);
      fs.ensureDirSync(this.uploadsDir);

      // Initialize conversations file if it doesn't exist
      if (!fs.existsSync(this.conversationsFile)) {
        fs.writeJsonSync(this.conversationsFile, []);
      }
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      // Don't throw in constructor, just log the error
    }
  }

  private async initializeStorage(): Promise<void> {
    try {
      await fs.ensureDir(this.dataDir);
      await fs.ensureDir(this.uploadsDir);

      // Initialize conversations file if it doesn't exist
      const exists = await fs.pathExists(this.conversationsFile);
      if (!exists) {
        await fs.writeJson(this.conversationsFile, []);
      }
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      throw error;
    }
  }

  // Conversation management
  async createConversation(
    jobTitle?: string,
    company?: string,
    jobDescription?: string,
    initialResume?: ResumeData
  ): Promise<Conversation> {
    const resume = initialResume ? this.cloneResume(initialResume) : this.getEmptyResume();

    const conversation: Conversation = {
      id: uuidv4(),
      jobTitle,
      company,
      jobDescription,
      messages: [],
      resumeSnapshots: [],
      currentResume: resume,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const conversations = await this.getAllConversations();
    conversations.push(conversation);
    await fs.writeJson(this.conversationsFile, conversations);

    return conversation;
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const conversations = await this.getAllConversations();
    return conversations.find(conv => conv.id === id) || null;
  }

  async getAllConversations(): Promise<Conversation[]> {
    try {
      const data = await fs.readJson(this.conversationsFile);
      return data.map((conv: any) => ({
        ...conv,
        createdAt: new Date(conv.createdAt),
        updatedAt: new Date(conv.updatedAt),
        messages: conv.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })),
        resumeSnapshots: conv.resumeSnapshots.map((snap: any) => ({
          ...snap,
          timestamp: new Date(snap.timestamp)
        }))
      }));
    } catch (error) {
      console.error('Failed to read conversations:', error);
      return [];
    }
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | null> {
    const conversations = await this.getAllConversations();
    const index = conversations.findIndex(conv => conv.id === id);

    if (index === -1) return null;

    conversations[index] = {
      ...conversations[index],
      ...updates,
      updatedAt: new Date()
    };

    await fs.writeJson(this.conversationsFile, conversations);
    return conversations[index];
  }

  async updateConversationLatex(id: string, latexResume: string): Promise<Conversation | null> {
    return this.updateConversation(id, { currentLatexResume: latexResume });
  }

  async getConversationLatex(id: string): Promise<string | null> {
    const conversation = await this.getConversation(id);
    return conversation?.currentLatexResume || null;
  }

  async deleteConversation(id: string): Promise<boolean> {
    const conversations = await this.getAllConversations();
    const filtered = conversations.filter(conv => conv.id !== id);

    if (filtered.length === conversations.length) return false;

    await fs.writeJson(this.conversationsFile, filtered);
    return true;
  }

  async addMessage(conversationId: string, message: Omit<Message, 'id' | 'timestamp'>): Promise<Message | null> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) return null;

    const newMessage: Message = {
      id: uuidv4(),
      ...message,
      timestamp: new Date()
    };

    conversation.messages.push(newMessage);
    await this.updateConversation(conversationId, conversation);

    return newMessage;
  }

  async addResumeSnapshot(conversationId: string, resumeData: ResumeData): Promise<ResumeSnapshot | null> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) return null;

    const snapshot: ResumeSnapshot = {
      version: conversation.resumeSnapshots.length + 1,
      data: this.cloneResume(resumeData),
      timestamp: new Date()
    };

    conversation.resumeSnapshots.push(snapshot);
    conversation.currentResume = this.cloneResume(resumeData);
    await this.updateConversation(conversationId, conversation);

    return snapshot;
  }

  // File management
  async saveUploadedFile(file: Express.Multer.File): Promise<string> {
    const fileId = uuidv4();
    const extension = path.extname(file.originalname);
    const filename = `${fileId}${extension}`;
    const filePath = path.join(this.uploadsDir, filename);

    await fs.move(file.path, filePath);

    return filename;
  }

  async getFilePath(filename: string): Promise<string> {
    return path.join(this.uploadsDir, filename);
  }

  async deleteFile(filename: string): Promise<void> {
    const filePath = path.join(this.uploadsDir, filename);
    await fs.remove(filePath);
  }

  // Utility methods
  private getEmptyResume(): ResumeData {
    return {
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
  }

  private cloneResume(resume: ResumeData): ResumeData {
    return JSON.parse(JSON.stringify(resume));
  }

  // Cleanup old conversations (older than 30 days)
  async cleanupOldConversations(): Promise<void> {
    const conversations = await this.getAllConversations();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeConversations = conversations.filter(conv =>
      conv.status === 'active' || conv.updatedAt > thirtyDaysAgo
    );

    if (activeConversations.length !== conversations.length) {
      await fs.writeJson(this.conversationsFile, activeConversations);
      console.log(`Cleaned up ${conversations.length - activeConversations.length} old conversations`);
    }
  }
}

// Singleton instance
export const storageService = new LocalStorageService();
