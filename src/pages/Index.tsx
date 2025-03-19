
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { MessageSquare, BookOpen } from "lucide-react";
import { DocumentMetadata } from "@/types/document";
import FileUploader from "@/components/FileUploader";
import DocumentDetails from "@/components/DocumentDetails";
import ChatInterface from "@/components/ChatInterface";
import StudyPlan from "@/components/StudyPlan";
import { createDocumentMetadata, extractDocumentText, estimateDocumentStats } from "@/utils/documentProcessor";

const Index = () => {
  const [document, setDocument] = useState<DocumentMetadata | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("chat");
  
  const handleFileSelected = async (file: File) => {
    setIsUploading(true);
    
    try {
      // Create initial metadata
      const metadata = createDocumentMetadata(file);
      metadata.processing = 'processing';
      setDocument(metadata);
      
      // Extract text content
      const content = await extractDocumentText(file);
      
      // Update document with stats and content
      const { wordCount, pageCount } = estimateDocumentStats(content);
      
      setDocument(prev => {
        if (!prev) return null;
        return {
          ...prev,
          wordCount,
          pageCount,
          content,
          processing: 'complete'
        };
      });
      
      toast.success("Document uploaded and processed successfully!");
    } catch (error) {
      console.error("Error processing document:", error);
      toast.error("Failed to process document. Please try again.");
      
      setDocument(prev => {
        if (!prev) return null;
        return {
          ...prev,
          processing: 'error'
        };
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleNewUpload = () => {
    setDocument(null);
  };
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="container mx-auto py-8 text-center animate-fade-in">
        <p className="text-sm font-medium text-primary mb-1">AI-Learning</p>
        <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
          Document Learning Assistant
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto text-balance">
          Upload any document and our AI will help you understand it,
          answer your questions, and create a personalized study plan.
        </p>
      </header>
      
      <main className="container mx-auto flex-1 py-6 px-4 md:py-10 md:px-8">
        {!document ? (
          <div className="max-w-2xl mx-auto">
            <FileUploader 
              onFileSelected={handleFileSelected} 
              isUploading={isUploading} 
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[70vh] max-h-[800px] overflow-hidden">
            {/* Document Details - Left Panel */}
            <div className="md:col-span-3 bg-card rounded-lg border p-5 shadow-sm overflow-y-auto">
              <DocumentDetails 
                document={document} 
                onNewUpload={handleNewUpload} 
                onClose={handleNewUpload}
              />
            </div>
            
            {/* Main Interface - Center/Right Panel */}
            <div className="md:col-span-9 bg-card rounded-lg border p-5 shadow-sm flex flex-col overflow-hidden">
              <Tabs 
                defaultValue="chat"
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full h-full flex flex-col"
              >
                <TabsList className="grid grid-cols-2 mb-6">
                  <TabsTrigger value="chat" className="flex items-center gap-2">
                    <MessageSquare size={16} />
                    <span>Document Chat</span>
                  </TabsTrigger>
                  <TabsTrigger value="study" className="flex items-center gap-2">
                    <BookOpen size={16} />
                    <span>Study Plan</span>
                  </TabsTrigger>
                </TabsList>
                
                <div className="flex-1 overflow-hidden">
                  <TabsContent value="chat" className="h-full m-0 animate-fade-in">
                    <ChatInterface 
                      document={document} 
                      isDocumentReady={document.processing === 'complete'} 
                    />
                  </TabsContent>
                  
                  <TabsContent value="study" className="h-full m-0 animate-fade-in">
                    <StudyPlan 
                      document={document} 
                      isDocumentReady={document.processing === 'complete'} 
                    />
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </div>
        )}
      </main>
      
      <footer className="py-6 border-t">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>Document Learning Assistant &copy; {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
