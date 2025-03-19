
import { DocumentMetadata, FileType } from "@/types/document";
import * as pdfjs from 'pdfjs-dist';

// Set worker path for PDF.js
const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.entry');
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

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

// Process PDF files using PDF.js
async function extractPdfText(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument(arrayBuffer).promise;
    
    let fullText = '';
    const maxPages = pdf.numPages;
    
    // Extract text from each page
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n\n';
    }
    
    return fullText;
  } catch (error) {
    console.error("Error extracting PDF text:", error);
    return `Failed to extract text from PDF. Error: ${error}`;
  }
}

// Extract document text based on file type
export const extractDocumentText = async (file: File): Promise<string> => {
  try {
    const fileType = extractFileType(file.name);
    
    if (fileType === 'PDF') {
      return await extractPdfText(file);
    } else if (fileType === 'TXT') {
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string || '');
        reader.onerror = reject;
        reader.readAsText(file);
      });
    } else if (fileType === 'DOCX') {
      // Use FileReader for DOCX (basic approach)
      // In a production app, you would use mammoth.js or similar
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            let content = e.target?.result as string || '';
            // Strip any binary data for basic text extraction
            content = content.replace(/[^\x20-\x7E\r\n]/g, ' ');
            resolve(content);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = reject;
        reader.readAsText(file);
      });
    } else {
      return `Document type ${fileType} is not supported for text extraction.`;
    }
  } catch (error) {
    console.error("Error extracting document text:", error);
    return `Failed to extract text from document. Error: ${error}`;
  }
};

// Estimate document stats from actual content
export const estimateDocumentStats = (text: string): { wordCount: number; pageCount: number } => {
  const words = text.trim().split(/\s+/).length;
  // Rough estimate: ~500 words per page
  const pages = Math.max(1, Math.ceil(words / 500));
  
  return { wordCount: words, pageCount: pages };
};

// Function to truncate document to a manageable size for API processing
export const prepareDocumentForAI = (text: string, maxTokens: number = 100000): string => {
  // Rough estimate: 1 token ≈ 4 characters for English text
  const maxChars = maxTokens * 4;
  
  if (text.length <= maxChars) {
    return text;
  }
  
  // If document is too large, truncate it
  const truncatedText = text.substring(0, maxChars);
  return truncatedText + "\n\n[Document truncated due to size limitations]";
};
