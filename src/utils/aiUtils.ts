
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

    // For very large documents, we need to be smarter about context selection
    const preparedDocument = prepareDocumentForQuerySpecific(query, documentContent);
    
    // Create a system prompt that instructs the model how to behave
    const systemPrompt = `You are a helpful AI assistant that answers questions based on the provided document. 
    Only answer questions based on the document content. If the answer is not in the document, 
    politely state that you couldn't find the information in the document.
    
    If the user asks about a specific topic that exists in the document, focus your answer on that topic's content.
    
    Document content: 
    ${preparedDocument}`;
    
    // Call the Mistral API
    const response = await callMistralAPI(systemPrompt, query);
    
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
function prepareDocumentForQuerySpecific(query: string, documentContent: string): string {
  console.log("Preparing document context for query:", query);
  
  // If document is small enough, use it completely
  if (documentContent.length < 300000) {
    return prepareDocumentForAI(documentContent);
  }
  
  // For large documents, we need to be smarter
  // 1. Extract potential topics from the query
  const queryWords = query.toLowerCase().split(/\s+/);
  const queryImportantWords = queryWords.filter(word => 
    word.length > 3 && 
    !['what', 'when', 'where', 'which', 'how', 'why', 'who', 'and', 'that', 'this', 'with', 'from'].includes(word)
  );
  
  console.log("Important query words:", queryImportantWords);
  
  // 2. Split document into sections (paragraphs)
  const sections = documentContent.split(/\n\s*\n/);
  
  // 3. Score each section based on query relevance
  const scoredSections = sections.map(section => {
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
    
    return { section, score };
  });
  
  // 4. Sort sections by relevance score
  scoredSections.sort((a, b) => b.score - a.score);
  
  // 5. Take top relevant sections plus some context from beginning of document
  let contextContent = "";
  
  // Always include the introduction (first few paragraphs)
  const introSize = Math.min(5, Math.floor(sections.length * 0.1));
  const introSections = sections.slice(0, introSize).join('\n\n');
  contextContent += introSections + '\n\n';
  
  // Add the most relevant sections
  const relevantSections = scoredSections
    .filter(item => item.score > 0)
    .slice(0, 20)
    .map(item => item.section)
    .join('\n\n');
  
  contextContent += relevantSections;
  
  // Final check on size and truncate if needed
  return prepareDocumentForAI(contextContent, MAX_CONTEXT_TOKENS - 2000); // Leave room for system context
}

// Function to call the Mistral API
async function callMistralAPI(systemPrompt: string, userQuery: string): Promise<string> {
  try {
    // Log token estimate to help with debugging
    const totalPromptLength = systemPrompt.length + userQuery.length;
    console.log(`Estimated prompt length: ${totalPromptLength} characters (roughly ${Math.ceil(totalPromptLength/4)} tokens)`);
    
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
            content: systemPrompt
          },
          {
            role: "user",
            content: userQuery
          }
        ],
        max_tokens: MAX_RESPONSE_TOKENS,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Mistral API error:", errorData);
      
      // If token limit exceeded, try with a shorter context
      if (errorData.message && errorData.message.includes("too large for model")) {
        console.log("Token limit exceeded, retrying with shorter context");
        
        // Create a shorter system prompt
        const shorterPrompt = `You are a helpful AI assistant answering questions about a document.
        I can only provide limited context due to size limitations.
        If you need more specific information, please ask a more targeted question.
        
        Document excerpt:
        ${systemPrompt.substring(systemPrompt.indexOf("Document content:") + 16, systemPrompt.indexOf("Document content:") + 30000)}
        [Document truncated due to size limitations]`;
        
        // Try again with shorter context
        return await callMistralAPI(shorterPrompt, userQuery);
      }
      
      throw new Error(`API request failed with status ${response.status}: ${errorData.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "I couldn't generate a response.";
  } catch (error) {
    console.error("Error calling Mistral API:", error);
    return "I encountered an error while processing your request. Please try asking a more specific question about the document.";
  }
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
