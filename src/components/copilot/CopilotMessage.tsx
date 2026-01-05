import React from 'react';
import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';
import type { CopilotMessage as CopilotMessageType } from '@/hooks/useCopilot';

interface CopilotMessageProps {
  message: CopilotMessageType;
}

// Simple markdown-like renderer for tables and lists
function renderContent(content: string) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let tableLines: string[] = [];
  let inTable = false;
  let listItems: string[] = [];
  let inList = false;

  const flushTable = () => {
    if (tableLines.length >= 2) {
      const headers = tableLines[0].split('|').filter(h => h.trim());
      const rows = tableLines.slice(2).map(row => 
        row.split('|').filter(c => c.trim())
      );
      
      elements.push(
        <div key={`table-${elements.length}`} className="overflow-x-auto my-2">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/50">
                {headers.map((h, i) => (
                  <th key={i} className="border border-border px-2 py-1 text-left font-medium">
                    {h.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="hover:bg-muted/30">
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-border px-2 py-1">
                      {cell.trim()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    tableLines = [];
    inTable = false;
  };

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-inside my-2 space-y-1">
          {listItems.map((item, i) => (
            <li key={i} className="text-sm">{item}</li>
          ))}
        </ul>
      );
    }
    listItems = [];
    inList = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for table
    if (line.includes('|') && line.trim().startsWith('|')) {
      if (!inTable) {
        flushList();
        inTable = true;
      }
      tableLines.push(line);
      continue;
    } else if (inTable) {
      flushTable();
    }
    
    // Check for list items
    if (line.match(/^[-•*]\s/)) {
      if (!inList) {
        inList = true;
      }
      listItems.push(line.replace(/^[-•*]\s/, ''));
      continue;
    } else if (inList) {
      flushList();
    }
    
    // Regular text
    if (line.trim()) {
      // Handle bold text
      const formattedLine = line
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/📌|💡|⚠️|✅|❌|🔍/g, match => `<span class="mr-1">${match}</span>`);
      
      elements.push(
        <p 
          key={`p-${elements.length}`} 
          className="text-sm my-1"
          dangerouslySetInnerHTML={{ __html: formattedLine }}
        />
      );
    } else if (elements.length > 0) {
      elements.push(<div key={`br-${elements.length}`} className="h-2" />);
    }
  }

  // Flush remaining
  if (inTable) flushTable();
  if (inList) flushList();

  return elements;
}

export default function CopilotMessage({ message }: CopilotMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn(
      "flex gap-2 py-2",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      <div className={cn(
        "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
        isUser ? "bg-primary text-primary-foreground" : "bg-muted"
      )}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      
      <div className={cn(
        "flex-1 max-w-[85%] rounded-lg px-3 py-2",
        isUser 
          ? "bg-primary text-primary-foreground" 
          : "bg-muted"
      )}>
        {isUser ? (
          <p className="text-sm">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {message.content ? renderContent(message.content) : (
              <span className="text-muted-foreground animate-pulse">Pensando...</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
