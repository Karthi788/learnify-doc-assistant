
import { useEffect, useState } from "react";
import { DocumentMetadata, StudyPlan as StudyPlanType, StudySession } from "@/types/document";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BookOpen, Clock, Download, Plus, ExternalLink } from "lucide-react";
import { generateStudyPlan } from "@/utils/aiUtils";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

interface StudyPlanProps {
  document: DocumentMetadata;
  isDocumentReady: boolean;
}

const StudyPlan = ({ document, isDocumentReady }: StudyPlanProps) => {
  const [studyPlan, setStudyPlan] = useState<StudyPlanType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    if (isDocumentReady && document.content) {
      loadStudyPlan();
    }
  }, [isDocumentReady, document]);
  
  const loadStudyPlan = async () => {
    if (!document.content) return;
    
    setIsLoading(true);
    try {
      const plan = await generateStudyPlan(document.content);
      setStudyPlan(plan);
    } catch (error) {
      console.error("Error generating study plan:", error);
      toast.error("Failed to generate study plan. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const toggleSessionCompletion = (sessionId: string) => {
    if (!studyPlan) return;
    
    setStudyPlan(prevPlan => {
      if (!prevPlan) return prevPlan;
      
      return {
        ...prevPlan,
        sessions: prevPlan.sessions.map(session => 
          session.id === sessionId 
            ? { ...session, completed: !session.completed } 
            : session
        )
      };
    });
  };
  
  const handleDownload = () => {
    if (!studyPlan) return;
    
    // Create a text representation of the study plan
    let planText = `# Study Plan for ${document.fileName}\n\n`;
    
    studyPlan.sessions.forEach(session => {
      planText += `## Day ${session.day}: ${session.title}\n`;
      planText += `${session.description}\n`;
      planText += `Estimated time: ${session.estimatedTime}\n`;
      planText += `Status: ${session.completed ? 'Completed' : 'Pending'}\n\n`;
    });
    
    // Create a downloadable file
    const blob = new Blob([planText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    // Create a temporary link and click it
    const a = document.createElement('a');
    a.href = url;
    a.download = `StudyPlan-${document.fileName.split('.')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Study plan downloaded successfully!");
  };
  
  const addCustomSession = () => {
    if (!studyPlan) return;
    
    const newSession: StudySession = {
      id: Date.now().toString(),
      title: "Custom Study Session",
      description: "Add your own notes and study goals here.",
      estimatedTime: "30 mins",
      completed: false,
      day: Math.max(...studyPlan.sessions.map(s => s.day)) + 1
    };
    
    setStudyPlan(prevPlan => {
      if (!prevPlan) return prevPlan;
      
      return {
        ...prevPlan,
        sessions: [...prevPlan.sessions, newSession]
      };
    });
    
    toast.success("Custom study session added!");
  };
  
  if (!isDocumentReady) {
    return (
      <div className="h-full flex items-center justify-center text-center p-6">
        <p className="text-muted-foreground">
          Please upload a document to generate a study plan.
        </p>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex items-center justify-center gap-2 border-b pb-4 mb-4">
        <BookOpen size={18} className="text-primary" />
        <h2 className="text-lg font-medium">Your Personalized Study Plan</h2>
      </div>
      
      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
          <p className="text-muted-foreground">Generating your personalized study plan...</p>
        </div>
      ) : studyPlan ? (
        <>
          <div className="mb-4 text-sm text-muted-foreground px-1">
            <p>Based on the document content, we've created a study plan to help you learn the material efficiently.</p>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {studyPlan.sessions.map((session) => (
              <div 
                key={session.id}
                className={cn(
                  "border rounded-lg p-4 transition-all",
                  session.completed ? "bg-secondary/50" : "bg-card",
                  "hover:shadow-md"
                )}
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="text-xs rounded-full px-2 py-0.5 bg-muted text-muted-foreground">
                    Day {session.day}
                  </div>
                  
                  <div className="flex items-center">
                    <Checkbox 
                      id={`session-${session.id}`} 
                      checked={session.completed}
                      onCheckedChange={() => toggleSessionCompletion(session.id)}
                      className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                    />
                  </div>
                </div>
                
                <h3 className={cn(
                  "text-lg font-medium mb-1 transition-all",
                  session.completed && "text-muted-foreground line-through"
                )}>
                  {session.title}
                </h3>
                
                <p className={cn(
                  "text-sm mb-3",
                  session.completed ? "text-muted-foreground/70" : "text-muted-foreground"
                )}>
                  {session.description}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock size={12} />
                    <span>Estimated time: {session.estimatedTime}</span>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs h-7 px-2"
                    disabled={session.completed}
                  >
                    <span className="mr-1">Start learning</span>
                    <ExternalLink size={12} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-auto space-y-2">
            <Button
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              onClick={addCustomSession}
            >
              <Plus size={14} /> Add Custom Study Session
            </Button>
            
            <Button
              variant="default"
              className="w-full flex items-center justify-center gap-2"
              onClick={handleDownload}
            >
              <Download size={14} /> Download Study Plan
            </Button>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <p className="text-muted-foreground mb-4">Failed to generate study plan.</p>
          <Button onClick={loadStudyPlan}>Try Again</Button>
        </div>
      )}
    </div>
  );
};

export default StudyPlan;
