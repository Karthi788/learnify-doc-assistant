
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

interface FileUploaderProps {
  onFileSelected: (file: File) => void;
  isUploading: boolean;
}

const FileUploader = ({ onFileSelected, isUploading }: FileUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      validateAndProcessFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  const validateAndProcessFile = (file: File) => {
    // Check file type
    const validTypes = ['.pdf', '.docx', '.doc', '.txt'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!validTypes.includes(fileExtension)) {
      toast.error("Invalid file type. Please upload PDF, Word, or text files.");
      return;
    }
    
    // Check file size (limit to 10MB for this demo)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error("File size is too large. Please upload files smaller than 10MB.");
      return;
    }
    
    // Pass the file to the parent component
    onFileSelected(file);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div 
      className={cn(
        "w-full p-10 flex flex-col items-center justify-center rounded-xl transition-all duration-300 animate-fade-in",
        "border-2 border-dashed hover:border-primary/40 card-shadow",
        "bg-white/80 backdrop-blur-sm",
        isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,.docx,.doc,.txt"
        className="hidden"
      />
      
      <div className="mb-5 p-4 rounded-full bg-primary/10 text-primary">
        <Upload size={36} strokeWidth={1.5} />
      </div>
      
      <h3 className="text-xl font-medium mb-2">Upload Learning Material</h3>
      <p className="text-muted-foreground text-center mb-6 max-w-md text-balance">
        Upload a PDF, Word document, or text file to get started.
        Our AI will analyze the content and help you learn effectively.
      </p>
      
      <Button 
        onClick={handleButtonClick} 
        className="relative overflow-hidden group transition-all"
        size="lg"
        disabled={isUploading}
      >
        <span className={cn(
          "flex items-center gap-2 transition-all",
          isUploading ? "opacity-0" : "opacity-100"
        )}>
          <Upload size={16} /> Upload Document
        </span>
        
        {isUploading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <div className="h-5 w-5 border-2 border-background border-t-transparent rounded-full animate-spin"></div>
          </span>
        )}
      </Button>
    </div>
  );
};

export default FileUploader;
