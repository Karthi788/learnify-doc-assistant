import { ChatMessage, DocumentMetadata, StudyPlan, StudySession } from "@/types/document";
import { toast } from "sonner";

const API_KEY = "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"; // Note: This is not secure for production
const API_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2";

// In a production application, this key should be stored securely,
// preferably on the server-side, not in the client-side code

export async function processQuery(
  query: string, 
  documentContent: string,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
): Promise<string> {
  try {
    // Create a system prompt that instructs the model how to behave
    const systemPrompt = `You are a helpful AI assistant that answers questions based on the provided document. 
    Only answer questions based on the document content. If the answer is not in the document, 
    politely state that you couldn't find the information in the document.
    
    Document content: 
    ${documentContent}`;
    
    // Create a unique message ID
    const messageId = Date.now().toString();
    
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

    // In a real application, we would call the Hugging Face API here
    // For now, we'll simulate a delay and response
    
    // Simulated API call
    const response = await simulateAiResponse(query, documentContent);
    
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
    toast.error("Failed to process your query. Please try again.");
    return "I'm sorry, I encountered an error processing your question. Please try again.";
  }
}

// For demonstration purposes, we'll simulate the AI response
// In a real application, this would be replaced with actual API calls
async function simulateAiResponse(query: string, documentContent: string): Promise<string> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Simple keyword matching to simulate document-based answering
  const queryLower = query.toLowerCase();
  const documentLower = documentContent.toLowerCase();
  
  if (documentLower.includes(queryLower)) {
    // Find a sentence containing the query keywords
    const sentences = documentContent.split('.');
    const relevantSentence = sentences.find(s => s.toLowerCase().includes(queryLower));
    
    return `Based on the document: ${relevantSentence || 'I found relevant information but cannot extract a specific sentence.'}`;
  } else {
    return "I'm sorry, but I couldn't find information related to your question in the document.";
  }
}

// In a real implementation, this would call an API
export async function callHuggingFaceAPI(prompt: string): Promise<string> {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
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
  
  const defaultSessions: StudySession[] = [
    {
      id: "1",
      title: "Document Content",
      description: "Study the concepts related to document content.",
      estimatedTime: "30 mins",
      completed: false,
      day: 1
    },
    {
      id: "2",
      title: "Final Review",
      description: "Synthesize all concepts and prepare summary notes.",
      estimatedTime: "30 mins",
      completed: false,
      day: 2
    }
  ];
  
  return { sessions: defaultSessions };
}
