import { ChatMessage, DocumentMetadata, StudyPlan, StudySession } from "@/types/document";
import { toast } from "sonner";
import { prepareDocumentForAI, extractDocumentTopics } from "./documentProcessor";

// Update API key to use Mistral API
const API_KEY = "DjyJA9MFtGcViA7SvdgIp3Fg4iH7tPrW"; 
const API_URL = "https://api.mistral.ai/v1/chat/completions"; 

// Constants for token management
const MAX_CONTEXT_TOKENS = 90000; // Maximum context size for Mistral model
const MAX_RESPONSE_TOKENS = 8192; // Maximum response size

export async function processQuery(
  query: string, 
  documentContent: string,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
): Promise<string> {
  try {
    // Create a unique message ID with timestamp to avoid duplicate keys
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Add a loading message from the assistant
    setMessages(prev => [
      ...prev, 
      { 
        id: messageId,
        role: 'assistant', 
        content: '', 
        timestamp: new Date(),
        isLoading: true 
      }
    ]);

    // For very large documents, use enhanced context selection
    console.log(`Original document size: ${documentContent.length} characters`);
    const preparedDocument = prepareDocumentForQuerySpecific(query, documentContent);
    console.log(`Prepared document size after smart selection: ${preparedDocument.length} characters`);
    
    // Create a system prompt that instructs the model how to behave
    const systemPrompt = `You are a helpful AI assistant that answers questions based on the provided document. 
    Only answer questions based on the document content. If the answer is not in the document, 
    politely state that you couldn't find the information in the document.
    
    If the user asks about a specific topic that exists in the document, focus your answer on that topic's content.
    
    Document content: 
    ${preparedDocument}`;
    
    // Call the Mistral API with progressive fallbacks for large documents
    const response = await callMistralAPIWithFallbacks(systemPrompt, query);
    
    // Update the message with the response
    setMessages(prev => 
      prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, content: response, isLoading: false } 
          : msg
      )
    );
    
    return response;
  } catch (error) {
    console.error("Error processing query:", error);
    
    // Update error message in chat
    setMessages(prev => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage && lastMessage.isLoading) {
        return prev.map(msg => 
          msg.id === lastMessage.id 
            ? { ...msg, content: "I encountered an error while processing your request. Please try again with a more specific question.", isLoading: false } 
            : msg
        );
      }
      return prev;
    });
    
    toast.error("Failed to process your query. Please try again.");
    return "I'm sorry, I encountered an error processing your question. Please try again.";
  }
}

// Enhanced function to prepare document content based on the specific query
// This is critical for handling 200-500 page documents
function prepareDocumentForQuerySpecific(query: string, documentContent: string): string {
  console.log("Preparing document context for query:", query);
  
  // If document is small enough, use it completely
  if (documentContent.length < 100000) {
    return prepareDocumentForAI(documentContent);
  }
  
  // For large documents, we need to be smarter
  console.log("Document is very large. Implementing topic-based search.");
  
  // 1. Extract potential topics from the query
  const queryWords = query.toLowerCase().split(/\s+/);
  const queryImportantWords = queryWords.filter(word => 
    word.length > 3 && 
    !['what', 'when', 'where', 'which', 'how', 'why', 'who', 'and', 'that', 'this', 'with', 'from'].includes(word)
  );
  
  console.log("Important query words:", queryImportantWords);
  
  // 2. Split document into sections (paragraphs) more efficiently
  // For very large documents, we use a more aggressive chunking approach
  const sections = documentContent.split(/\n\s*\n/);
  console.log(`Document split into ${sections.length} sections`);
  
  // 3. Score each section based on query relevance with improved efficiency
  // Create a limited array of scored sections to avoid memory issues
  const MAX_SECTIONS_TO_SCORE = 1000;
  const sectionSampleSize = Math.min(sections.length, MAX_SECTIONS_TO_SCORE);
  const samplingInterval = Math.max(1, Math.floor(sections.length / sectionSampleSize));
  
  const scoredSections = [];
  
  // Process sections in batches to avoid blocking the main thread
  const BATCH_SIZE = 100;
  
  for (let batchStart = 0; batchStart < sections.length; batchStart += BATCH_SIZE * samplingInterval) {
    const batchSections = [];
    
    // Create a batch of sections to score
    for (let i = 0; i < BATCH_SIZE && (batchStart + i * samplingInterval) < sections.length; i++) {
      const sectionIndex = batchStart + i * samplingInterval;
      batchSections.push({
        index: sectionIndex,
        section: sections[sectionIndex]
      });
    }
    
    // Score each section in this batch
    for (const {index, section} of batchSections) {
      const sectionLower = section.toLowerCase();
      let score = 0;
      
      // Score based on query word occurrences
      for (const word of queryImportantWords) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = sectionLower.match(regex);
        if (matches) {
          score += matches.length * 2;
        }
      }
      
      // Boost score for sections that look like headings
      if (section.trim().length < 100 && /^[A-Z]/.test(section.trim())) {
        score += 5;
      }
      
      if (score > 0) {
        scoredSections.push({ index, section, score });
      }
    }
  }
  
  // 4. Sort sections by relevance score
  scoredSections.sort((a, b) => b.score - a.score);
  
  // 5. Take top relevant sections plus some context
  let contextContent = "";
  
  // Always include the introduction (first few paragraphs)
  const introSize = Math.min(5, Math.floor(sections.length * 0.05));
  const introSections = sections.slice(0, introSize).join('\n\n');
  contextContent += introSections + '\n\n';
  
  // For topic-specific queries, focus heavily on relevant sections
  // Get more relevant sections for a large document
  const relevantSectionCount = Math.min(40, Math.ceil(scoredSections.length * 0.2));
  
  // Get the most relevant sections and also some context around them
  let processedIndices = new Set<number>();
  for (let i = 0; i < Math.min(relevantSectionCount, scoredSections.length); i++) {
    const { index, section } = scoredSections[i];
    
    // Add the highly relevant section
    if (!processedIndices.has(index)) {
      contextContent += section + '\n\n';
      processedIndices.add(index);
      
      // Also add some context (sections before and after)
      for (let j = Math.max(0, index - 1); j <= Math.min(sections.length - 1, index + 1); j++) {
        if (!processedIndices.has(j)) {
          contextContent += sections[j] + '\n\n';
          processedIndices.add(j);
        }
      }
    }
  }
  
  // Final check on size and truncate if needed
  return prepareDocumentForAI(contextContent, MAX_CONTEXT_TOKENS - 2000); // Leave room for system context
}

// Enhanced Mistral API call with progressive fallbacks for large documents
async function callMistralAPIWithFallbacks(systemPrompt: string, userQuery: string, attemptNumber: number = 1): Promise<string> {
  try {
    console.log(`API Call attempt #${attemptNumber} - Calling Mistral API...`);
    
    // Log token estimate to help with debugging
    const totalPromptLength = systemPrompt.length + userQuery.length;
    console.log(`Estimated prompt length: ${totalPromptLength} characters (roughly ${Math.ceil(totalPromptLength/4)} tokens)`);
    
    // Progressive reductions for retries
    let currentSystemPrompt = systemPrompt;
    let maxTokens = MAX_RESPONSE_TOKENS;
    
    // For retry attempts, reduce context size
    if (attemptNumber > 1) {
      const reductionFactor = 0.7; // Reduce by 30% each time
      const reducedLength = Math.floor(systemPrompt.length * Math.pow(reductionFactor, attemptNumber - 1));
      
      // Extract document content only
      const docContentStart = systemPrompt.indexOf("Document content:") + 16;
      
      // Build a new prompt with reduced document content
      currentSystemPrompt = systemPrompt.substring(0, docContentStart) + 
        systemPrompt.substring(docContentStart, docContentStart + reducedLength) + 
        "\n\n[Document content was truncated due to size limitations]";
      
      console.log(`Retry attempt #${attemptNumber} - Reduced prompt to ${currentSystemPrompt.length} characters`);
      
      // Also reduce response length for faster processing
      maxTokens = Math.floor(MAX_RESPONSE_TOKENS * 0.8);
    }
    
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-small-latest", // Using Mistral's small model
        messages: [
          {
            role: "system",
            content: currentSystemPrompt
          },
          {
            role: "user",
            content: userQuery
          }
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Mistral API error:", errorData);
      
      // If token limit exceeded or context too large, try with a shorter context
      if (attemptNumber < 3 && 
          (errorData.message?.includes("too large for model") || 
          errorData.message?.includes("token limit") ||
          errorData.message?.includes("exceed"))) {
        
        console.log("Token limit or context size issue, retrying with smaller context...");
        
        // Wait a short time before retry to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Retry with a smaller context
        return await callMistralAPIWithFallbacks(systemPrompt, userQuery, attemptNumber + 1);
      }
      
      throw new Error(`API request failed with status ${response.status}: ${errorData.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "I couldn't generate a response.";
  } catch (error) {
    console.error("Error calling Mistral API:", error);
    
    // For retriable errors, attempt fallback to HuggingFace API
    if (attemptNumber < 3) {
      console.log("Error with Mistral API, retrying with reduced context...");
      return await callMistralAPIWithFallbacks(systemPrompt, userQuery, attemptNumber + 1);
    }
    
    // Final fallback for severe errors - try with minimal context
    if (attemptNumber === 3) {
      console.log("Multiple Mistral API failures, using minimal context fallback");
      
      // Create a minimal prompt
      const minimalPrompt = `You are a helpful AI assistant answering questions about a document.
      I can only provide very limited context due to technical limitations.
      
      Here's a brief excerpt from the document:
      ${systemPrompt.substring(systemPrompt.indexOf("Document content:") + 16, systemPrompt.indexOf("Document content:") + 5000)}
      [Document heavily truncated]`;
      
      try {
        return await callMistralAPIWithFallbacks(minimalPrompt, userQuery, 4);
      } catch (finalError) {
        return "I encountered multiple errors while processing your request. Please try asking a more specific question about a particular section of the document.";
      }
    }
    
    return "I encountered an error while processing your request. Please try asking a more specific question about the document.";
  }
}

// Use the original callMistralAPI function as a compatibility layer
async function callMistralAPI(systemPrompt: string, userQuery: string): Promise<string> {
  return await callMistralAPIWithFallbacks(systemPrompt, userQuery);
}

// In a real implementation, this would call an API
export async function callHuggingFaceAPI(prompt: string): Promise<string> {
  try {
    const response = await fetch("https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2", {
      method: "POST",
      headers: {
        "Authorization": `Bearer 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`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 1024,
          temperature: 0.7,
          top_p: 0.95,
          do_sample: true,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data[0].generated_text || "I couldn't generate a response.";
  } catch (error) {
    console.error("Error calling Hugging Face API:", error);
    return "I encountered an error while processing your request.";
  }
}

// Generate a study plan based on document content
export async function generateStudyPlan(documentContent: string): Promise<StudyPlan> {
  // In a real application, we would use AI to analyze the document and create a study plan
  // For now, we'll create a simulated study plan
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Try to extract some actual topics from the document
  const extractedTopics = extractDocumentTopics(documentContent);
  
  // Create sessions based on extracted topics or use defaults
  const sessions: StudySession[] = [];
  
  if (extractedTopics.length > 0) {
    // Use actually extracted topics
    extractedTopics.slice(0, 5).forEach((topic, index) => {
      sessions.push({
        id: (index + 1).toString(),
        title: topic,
        description: `Study the concepts related to ${topic}.`,
        estimatedTime: "30 mins",
        completed: false,
        day: Math.floor(index / 2) + 1
      });
    });
  } else {
    // Use default sessions
    sessions.push(
      {
        id: "1",
        title: "Document Overview",
        description: "Study the key concepts and gain familiarity with the document structure.",
        estimatedTime: "30 mins",
        completed: false,
        day: 1
      },
      {
        id: "2",
        title: "Main Concepts",
        description: "Focus on the core ideas presented in the document.",
        estimatedTime: "45 mins",
        completed: false,
        day: 1
      },
      {
        id: "3",
        title: "Supporting Details",
        description: "Examine the evidence and examples that support the main concepts.",
        estimatedTime: "30 mins",
        completed: false,
        day: 2
      },
      {
        id: "4",
        title: "Final Review",
        description: "Synthesize all concepts and prepare summary notes.",
        estimatedTime: "30 mins",
        completed: false,
        day: 2
      }
    );
  }
  
  return { sessions };
}
