
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

// Actual document text extraction - now reads file content
export const extractDocumentText = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const fileType = extractFileType(file.name);
        let content = '';
        
        if (e.target?.result) {
          if (fileType === 'TXT') {
            // For text files, we can directly use the result
            content = e.target.result as string;
          } else if (fileType === 'PDF') {
            // For PDF files in a real implementation, we would use PDF.js
            // For now, we'll just use the text content if it's a text-based PDF
            content = e.target.result as string;
            // Strip any binary data or use proper PDF.js parsing
            content = content.replace(/[^\x20-\x7E\r\n]/g, '');
          } else if (fileType === 'DOCX') {
            // For DOCX files in a real implementation, we would use mammoth.js
            // For now, we'll just use the text content if available
            content = e.target.result as string;
            // Strip any binary data or use proper docx parsing library
            content = content.replace(/[^\x20-\x7E\r\n]/g, '');
          }
          
          if (content) {
            resolve(content);
          } else {
            // If we couldn't extract content, create a meaningful message
            resolve(`Document content from ${file.name}. This file type (${fileType}) requires special processing. Please make sure you're uploading a text-based document for best results.`);
          }
        } else {
          reject(new Error("Failed to read file content"));
        }
      } catch (error) {
        console.error("Error extracting text:", error);
        reject(error);
      }
    };
    
    reader.onerror = (error) => {
      console.error("Error reading file:", error);
      reject(error);
    };
    
    // For text files, read as text
    if (file.type === 'text/plain') {
      reader.readAsText(file);
    } else {
      // For PDF and DOCX, in a full implementation we'd use specialized libraries
      // For now, try to read as text if possible, otherwise read as array buffer
      try {
        reader.readAsText(file);
      } catch (error) {
        reader.readAsArrayBuffer(file);
      }
    }
  });
};

// Estimate document stats from actual content
export const estimateDocumentStats = (text: string): { wordCount: number; pageCount: number } => {
  const words = text.trim().split(/\s+/).length;
  // Rough estimate: ~500 words per page
  const pages = Math.max(1, Math.ceil(words / 500));
  
  return { wordCount: words, pageCount: pages };
};
