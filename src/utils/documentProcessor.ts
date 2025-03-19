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

// Enhanced PDF processing for large documents
async function extractPdfText(file: File): Promise<string> {
  try {
    console.log("Starting PDF extraction for large document...");
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    
    const maxPages = pdf.numPages;
    console.log(`PDF has ${maxPages} pages, processing...`);
    
    // For very large documents, we'll process in chunks
    const CHUNK_SIZE = 50; // Process 50 pages at a time
    let fullText = '';
    
    // Process the document in chunks to avoid memory issues
    for (let i = 1; i <= maxPages; i += CHUNK_SIZE) {
      const endPage = Math.min(i + CHUNK_SIZE - 1, maxPages);
      console.log(`Processing pages ${i} to ${endPage}...`);
      
      // Process each chunk of pages
      const chunkPromises = [];
      for (let pageNum = i; pageNum <= endPage; pageNum++) {
        chunkPromises.push(extractPageText(pdf, pageNum));
      }
      
      // Wait for the current chunk to complete
      const chunkResults = await Promise.all(chunkPromises);
      fullText += chunkResults.join('\n\n');
      
      // Give the UI thread a chance to breathe between chunks
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    console.log("PDF extraction complete.");
    return fullText;
  } catch (error) {
    console.error("Error extracting PDF text:", error);
    return `Failed to extract text from PDF. Error: ${error}`;
  }
}

// Helper to extract text from a single page
async function extractPageText(pdf: any, pageNum: number): Promise<string> {
  try {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent({ normalizeWhitespace: true });
    
    // More sophisticated text extraction that preserves layout better
    let lastY = null;
    let text = '';
    
    for (const item of textContent.items) {
      const itemAny = item as any;
      
      // Check if we're on a new line
      if (lastY !== null && lastY !== itemAny.transform[5]) {
        text += '\n';
      }
      
      text += itemAny.str;
      lastY = itemAny.transform[5];
    }
    
    return text;
  } catch (error) {
    console.error(`Error extracting text from page ${pageNum}:`, error);
    return `[Page ${pageNum} extraction failed]`;
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

// Improved function to prepare document for AI processing
export const prepareDocumentForAI = (text: string, maxTokens: number = 100000): string => {
  // Rough estimate: 1 token ≈ 4 characters for English text
  const maxChars = maxTokens * 4;
  
  if (text.length <= maxChars) {
    return text;
  }
  
  console.log(`Document is very large: ${text.length} characters. Truncating to ~${maxChars} characters.`);
  
  // For large documents, we'll use a more intelligent truncation
  // that keeps both the beginning and end of the document
  const startChars = Math.floor(maxChars * 0.7); // 70% from start
  const endChars = Math.floor(maxChars * 0.3);   // 30% from end
  
  const startText = text.substring(0, startChars);
  const endText = text.substring(text.length - endChars);
  
  return startText + 
    "\n\n[...Document truncated due to size limitations...]\n\n" + 
    endText;
};

// Create a function to extract key topics from the document
export const extractDocumentTopics = (text: string): string[] => {
  // This is a simple implementation that looks for capitalized phrases
  // A more sophisticated approach would use NLP libraries
  const lines = text.split('\n');
  const potentialTopics = new Set<string>();
  
  // Look for lines that might be headings
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines and very long lines
    if (trimmedLine.length === 0 || trimmedLine.length > 100) continue;
    
    // Look for capitalized phrases that might be headings
    if (/^[A-Z][A-Za-z\s]{2,50}$/.test(trimmedLine) && 
        !trimmedLine.endsWith('.')) {
      potentialTopics.add(trimmedLine);
    }
    
    // Also check for numbered or bulleted headings
    if (/^[\d\.\-•\*]+\s+[A-Z][A-Za-z\s]{2,50}$/.test(trimmedLine) &&
        !trimmedLine.endsWith('.')) {
      const topic = trimmedLine.replace(/^[\d\.\-•\*]+\s+/, '');
      potentialTopics.add(topic);
    }
  }
  
  // Convert Set to Array and limit to top 20 topics
  return Array.from(potentialTopics).slice(0, 20);
};
