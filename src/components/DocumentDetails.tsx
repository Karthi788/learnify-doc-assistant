
import { DocumentMetadata } from "@/types/document";
import { Button } from "@/components/ui/button";
import { FileText, Upload, X, Clock, FileType } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface DocumentDetailsProps {
  document: DocumentMetadata;
  onNewUpload: () => void;
  onClose: () => void;
}

const DocumentDetails = ({ document, onNewUpload, onClose }: DocumentDetailsProps) => {
  return (
    <div className="animate-fade-in flex flex-col min-h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <FileText size={18} className="text-primary" />
          {document.fileName}
        </h3>
        <button 
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close document details"
        >
          <X size={18} />
        </button>
      </div>
      
      <div className="text-sm text-muted-foreground mb-4">
        Processed document
      </div>
      
      <div className="bg-accent/50 rounded-lg p-4 mb-6">
        <h4 className="font-medium mb-2">Preview:</h4>
        <p className="text-sm text-muted-foreground">
          Document processed successfully.
          Use the chat to ask questions or check your study plan.
        </p>
      </div>
      
      <div className="mb-6">
        <h4 className="font-medium mb-3">Document Info:</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">File Type:</span>
            <span className="font-medium">{document.fileType}</span>
          </div>
          
          {document.pageCount && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Pages:</span>
              <span className="font-medium">{document.pageCount}</span>
            </div>
          )}
          
          {document.wordCount && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Words:</span>
              <span className="font-medium">{document.wordCount.toLocaleString()}</span>
            </div>
          )}
          
          {document.fileSize && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Size:</span>
              <span className="font-medium">{document.fileSize}</span>
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Uploaded:</span>
            <span className="font-medium">{formatDistanceToNow(document.uploadDate, { addSuffix: true })}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Processing:</span>
            <span className={cn(
              "font-medium",
              document.processing === "complete" ? "text-green-600" : 
              document.processing === "error" ? "text-red-600" : 
              "text-amber-600"
            )}>
              {document.processing === "complete" ? "Complete" : 
               document.processing === "error" ? "Failed" : 
               "Processing"}
            </span>
          </div>
        </div>
      </div>
      
      <div className="mt-auto">
        <Button 
          onClick={onNewUpload} 
          variant="outline" 
          className="w-full flex items-center gap-2 transition-all hover:bg-primary/5"
        >
          <Upload size={16} /> Upload New Document
        </Button>
      </div>
    </div>
  );
};

export default DocumentDetails;
