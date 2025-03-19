
export type FileType = 'PDF' | 'DOCX' | 'TXT' | 'Unknown';

export interface DocumentMetadata {
  fileName: string;
  fileType: FileType;
  wordCount?: number;
  pageCount?: number;
  uploadDate: Date;
  fileSize?: string;
  processing: 'idle' | 'processing' | 'complete' | 'error';
  content?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

export interface StudySession {
  id: string;
  title: string;
  description: string;
  estimatedTime: string;
  completed: boolean;
  day: number;
}

export interface StudyPlan {
  sessions: StudySession[];
}
