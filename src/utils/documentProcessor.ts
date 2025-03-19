
import { DocumentMetadata, FileType } from "@/types/document";

export const extractFileType = (fileName: string): FileType => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  switch (extension) {
    case 'pdf':
      return 'PDF';
    case 'docx':
    case 'doc':
      return 'DOCX';
    case 'txt':
      return 'TXT';
    default:
      return 'Unknown';
  }
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const createDocumentMetadata = (file: File): DocumentMetadata => {
  return {
    fileName: file.name,
    fileType: extractFileType(file.name),
    uploadDate: new Date(),
    fileSize: formatFileSize(file.size),
    processing: 'idle',
  };
};

// Mock function to simulate document text extraction
// In a real app, this would use a PDF parser or similar
export const extractDocumentText = async (file: File): Promise<string> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // This is a mock implementation
      // For real implementation, use PDF.js, mammoth.js (for DOCX), etc.
      const simulatedText = `This is simulated text content from ${file.name}. 
      In a real implementation, we would extract the actual text content from the document.
      The document would be processed using appropriate libraries for the file type.`;
      
      resolve(simulatedText);
    }, 1500); // Simulate processing time
  });
};

// Mock function to estimate word and page count
export const estimateDocumentStats = (text: string): { wordCount: number; pageCount: number } => {
  const words = text.trim().split(/\s+/).length;
  // Rough estimate: ~500 words per page
  const pages = Math.max(1, Math.ceil(words / 500));
  
  return { wordCount: words, pageCount: pages };
};
