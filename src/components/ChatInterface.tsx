
import { useState, useRef, useEffect } from "react";
import { ChatMessage, DocumentMetadata } from "@/types/document";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { processQuery } from "@/utils/aiUtils";

interface ChatInterfaceProps {
  document: DocumentMetadata;
  isDocumentReady: boolean;
}

const ChatInterface = ({ document, isDocumentReady }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentMessage.trim() || !isDocumentReady || isProcessing) return;
    
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: currentMessage,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage("");
    setIsProcessing(true);
    
    try {
      // Process with AI
      await processQuery(
        currentMessage, 
        document.content || "No document content available.", 
        setMessages
      );
    } catch (error) {
      console.error("Error in chat:", error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-center gap-2 border-b pb-4 mb-4">
        <MessageSquare size={18} className="text-primary" />
        <h2 className="text-lg font-medium">Document Chat</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto px-1">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground animate-fade-in">
            <MessageSquare size={40} className="text-muted-foreground/50 mb-4" />
            <p className="mb-2 text-lg font-medium">Ask questions about the document and I'll help you understand it better.</p>
            <p className="text-sm max-w-md">I'll use the content of your uploaded document to provide accurate answers.</p>
          </div>
        ) : (
          <div className="space-y-4 pb-2">
            {messages.map((message) => (
              <div 
                key={message.id}
                className={cn(
                  "flex w-max max-w-[80%] animate-scale-in",
                  message.role === "user" ? "ml-auto" : "mr-auto"
                )}
              >
                <div className={cn(
                  "rounded-lg px-4 py-3",
                  message.role === "user" 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-secondary text-secondary-foreground"
                )}>
                  {message.isLoading ? (
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-2 bg-secondary-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="h-2 w-2 bg-secondary-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="h-2 w-2 bg-secondary-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  ) : (
                    <p className="text-sm">{message.content}</p>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="mt-4 relative">
        <Input
          value={currentMessage}
          onChange={(e) => setCurrentMessage(e.target.value)}
          placeholder="Ask a question about the document..."
          disabled={!isDocumentReady || isProcessing}
          className="pr-12"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!isDocumentReady || isProcessing || !currentMessage.trim()}
          className="absolute right-1 top-1 h-8 w-8"
        >
          <Send size={16} />
        </Button>
      </form>
    </div>
  );
};

export default ChatInterface;
