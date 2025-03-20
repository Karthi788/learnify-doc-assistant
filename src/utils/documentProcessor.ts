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

// Enhanced PDF processing for large documents with progressive chunking
async function extractPdfText(file: File): Promise<string> {
  try {
    console.log("Starting PDF extraction for large document...");
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    
    const maxPages = pdf.numPages;
    console.log(`PDF has ${maxPages} pages, processing with enhanced chunking...`);
    
    // For very large documents, we'll process in adaptive chunks
    const CHUNK_SIZE = maxPages > 200 ? 25 : 50; // Smaller chunks for larger documents
    let fullText = '';
    
    // Process the document in chunks to avoid memory issues
    for (let i = 1; i <= maxPages; i += CHUNK_SIZE) {
      const endPage = Math.min(i + CHUNK_SIZE - 1, maxPages);
      console.log(`Processing pages ${i} to ${endPage} (${Math.floor((i/maxPages)*100)}% complete)...`);
      
      // Process each chunk of pages
      const chunkPromises = [];
      for (let pageNum = i; pageNum <= endPage; pageNum++) {
        chunkPromises.push(extractPageText(pdf, pageNum));
      }
      
      // Wait for the current chunk to complete
      const chunkResults = await Promise.all(chunkPromises);
      fullText += chunkResults.join('\n\n');
      
      // Give the UI thread a chance to breathe between chunks
      // Use longer pauses for very large documents
      await new Promise(resolve => setTimeout(resolve, maxPages > 300 ? 50 : 10));
    }
    
    console.log("PDF extraction complete.");
    return fullText;
  } catch (error) {
    console.error("Error extracting PDF text:", error);
    return `Failed to extract text from PDF. Error: ${error}`;
  }
}

// Improved page extraction for better text layout preservation
async function extractPageText(pdf: any, pageNum: number): Promise<string> {
  try {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent({ normalizeWhitespace: true });
    
    // Enhanced text extraction that preserves layout better
    const textItems = textContent.items;
    let lastY = null;
    let text = '';
    let lastX = 0;
    
    for (let i = 0; i < textItems.length; i++) {
      const item = textItems[i] as any;
      
      // Handle new lines based on Y position changes
      if (lastY !== null && Math.abs(lastY - item.transform[5]) > 1) {
        text += '\n';
        lastX = 0;
      } else if (i > 0) {
        // Check if we need to add space between words on the same line
        const xGap = item.transform[4] - lastX;
        if (xGap > 10) { // Threshold for adding space
          text += ' ';
        }
      }
      
      text += item.str;
      lastY = item.transform[5];
      lastX = item.transform[4] + (item.width || 0);
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

// Improved document stats estimation
export const estimateDocumentStats = (text: string): { wordCount: number; pageCount: number } => {
  const words = text.trim().split(/\s+/).length;
  // Rough estimate: ~500 words per page
  const pages = Math.max(1, Math.ceil(words / 500));
  
  return { wordCount: words, pageCount: pages };
};

// Enhanced document preparation for AI processing
export const prepareDocumentForAI = (text: string, maxTokens: number = 100000): string => {
  // Rough estimate: 1 token ≈ 4 characters for English text
  const maxChars = maxTokens * 4;
  
  if (text.length <= maxChars) {
    return text;
  }
  
  console.log(`Document is very large: ${text.length} characters. Implementing smart truncation to ~${maxChars} characters.`);
  
  // For large documents, implement semantic truncation
  // that preserves structure and important content
  
  // Split text into sections (paragraphs)
  const sections = text.split(/\n\s*\n/);
  
  // If we have identifiable sections, let's be smarter about what we keep
  if (sections.length > 1) {
    // Keep introduction (first 10% of sections)
    const introCount = Math.max(1, Math.floor(sections.length * 0.1));
    let result = sections.slice(0, introCount).join('\n\n');
    
    // Determine how many chars we've used and how many we have left
    const remainingChars = maxChars - result.length;
    
    // Reserve some space for our truncation message
    const truncationMsg = "\n\n[...Document truncated due to size limitations...]\n\n";
    const availableChars = remainingChars - truncationMsg.length;
    
    if (availableChars > 0) {
      // Distribute remaining characters between middle and end sections
      const middleEndSplit = 0.7; // 70% to middle, 30% to end
      
      // Calculate characters for middle and end
      const middleChars = Math.floor(availableChars * middleEndSplit);
      const endChars = availableChars - middleChars;
      
      // Select sections from the middle (sampling)
      const middleStart = introCount;
      const middleSectionCount = Math.floor(sections.length * 0.6);
      const samplingRate = Math.max(1, Math.floor(middleSectionCount / (middleChars / 100)));
      
      let middleText = '';
      for (let i = middleStart; i < middleStart + middleSectionCount; i += samplingRate) {
        if (i < sections.length && middleText.length < middleChars) {
          middleText += sections[i] + '\n\n';
        }
      }
      
      // Get end sections
      const endStart = Math.max(middleStart + middleSectionCount, sections.length - Math.floor(sections.length * 0.1));
      let endText = '';
      
      for (let i = endStart; i < sections.length; i++) {
        if (endText.length + sections[i].length < endChars) {
          endText += sections[i] + '\n\n';
        }
      }
      
      result += middleText + truncationMsg + endText;
    }
    
    return result;
  }
  
  // Fallback to simple truncation if we can't identify good section breaks
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
  // Improved topic extraction for large documents
  // Split by lines for more efficient processing
  const lines = text.split('\n');
  const potentialTopics = new Set<string>();
  
  // Look for patterns that suggest headings or key topics
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines and very long lines
    if (line.length === 0 || line.length > 100) continue;
    
    // Improved patterns for heading detection
    // Check for capitalized phrases that might be headings
    if (/^[A-Z][A-Za-z0-9\s\-]{2,50}$/.test(line) && 
        !line.endsWith('.')) {
      potentialTopics.add(line);
    }
    
    // Also check for numbered or bulleted headings
    if (/^[\d\.\-•\*]+\s+[A-Z][A-Za-z0-9\s\-]{2,50}$/.test(line) &&
        !line.endsWith('.')) {
      const topic = line.replace(/^[\d\.\-•\*]+\s+/, '');
      potentialTopics.add(topic);
    }
    
    // Check for short line followed by blank line (potential heading)
    if (line.length < 50 && line.length > 0 && i < lines.length - 1 && lines[i + 1].trim() === '') {
      if (/^[A-Za-z]/.test(line) && !line.endsWith('.')) {
        potentialTopics.add(line);
      }
    }
  }
  
  // Convert Set to Array and limit to top 20 topics
  return Array.from(potentialTopics).slice(0, 20);
};
