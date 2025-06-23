import React, { useEffect, useRef } from "react";
import { User, Monitor } from "react-feather";

export default function ChatInterface({ events }) {
  const chatEndRef = useRef(null);
  const chatMessages = [];
  
  // Process events to extract chat messages
  events.forEach((event) => {
    // Extract assistant messages
    if (event.type === "response.done" && event.response?.output) {
      const textContent = event.response.output
        .filter(item => item.type === "text")
        .map(item => item.text)
        .join("");
      
      // Also check for audio transcripts
      const audioTranscript = event.response.output
        .filter(item => item.type === "audio" && item.transcript)
        .map(item => item.transcript)
        .join("");
        
      const content = textContent || audioTranscript;
      
      if (content) {
        chatMessages.push({
          id: event.event_id,
          role: "assistant",
          content: content,
          timestamp: event.timestamp
        });
      }
    }
    // Extract audio transcripts from output items
    else if (event.type === "response.output_item.done" && 
             event.item?.content && 
             event.item.role === "assistant") {
      const transcript = event.item.content
        .filter(item => item.type === "audio" && item.transcript)
        .map(item => item.transcript)
        .join("");
        
      if (transcript) {
        chatMessages.push({
          id: event.event_id,
          role: "assistant",
          content: transcript,
          timestamp: event.timestamp
        });
      }
    }
    // Extract user messages
    else if (event.type === "conversation.item.create" && 
             event.item?.content?.[0]?.type === "input_text" &&
             event.item.role === "user") {
      chatMessages.push({
        id: event.event_id,
        role: "user",
        content: event.item.content[0].text,
        timestamp: event.timestamp
      });
    }
  });
  
  // Deduplicate messages (sometimes events can contain duplicates)
  const uniqueMessages = [];
  const seenIds = new Set();
  
  // Process in reverse order to get chronological display
  chatMessages.reverse().forEach(msg => {
    // Create a composite key from content + role to detect duplicates
    const contentKey = `${msg.role}:${msg.content}`;
    if (!seenIds.has(contentKey)) {
      uniqueMessages.push(msg);
      seenIds.add(contentKey);
    }
  });
  
  // Scroll to bottom whenever messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [uniqueMessages.length]);
  
  if (uniqueMessages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center text-gray-500">
        <p className="text-xl font-medium mb-2">Your interview conversation will appear here</p>
        <p>Start the session to begin the interview</p>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full overflow-y-auto p-4">
      {uniqueMessages.map((message, index) => (
        <div 
          key={index}
          className={`flex gap-3 p-4 mb-4 rounded-lg max-w-[85%] ${
            message.role === "user" 
              ? "bg-blue-50 ml-auto" 
              : "bg-gray-50"
          }`}
        >
          <div className="flex-shrink-0">
            {message.role === "user" ? (
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <User size={16} className="text-blue-600" />
              </div>
            ) : (
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Monitor size={16} className="text-green-600" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="font-medium mb-1">
              {message.role === "user" ? "You" : "Interviewer"}
              <span className="text-xs text-gray-500 ml-2">{message.timestamp}</span>
            </div>
            <div className="text-gray-800 whitespace-pre-wrap">{message.content}</div>
          </div>
        </div>
      ))}
      <div ref={chatEndRef} />
    </div>
  );
}
