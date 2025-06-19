import { ArrowUp, ArrowDown, User } from "react-feather";
import { Monitor } from "react-feather"; // Using Monitor as a replacement for Bot
import { useState, useEffect, useRef } from "react";

function Event({ event, timestamp }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [displayText, setDisplayText] = useState("");

  const isClient = event.event_id && !event.event_id.startsWith("event_");
  
  useEffect(() => {
    // Extract text from different event types
    if (event.type === "response.done" && event.response?.output) {
      const textContent = event.response.output
        .filter(item => item.type === "text")
        .map(item => item.text)
        .join("");
      setDisplayText(textContent);
    } else if (event.type === "conversation.item.create" && 
               event.item?.content?.[0]?.type === "input_text") {
      setDisplayText(event.item.content[0].text);
    }
  }, [event]);

  // If it's a message event with content, display in conversation format
  if ((event.type === "response.done" || 
       event.type === "conversation.item.create") && 
      displayText) {
    
    return (
      <div className={`flex gap-3 p-3 ${isClient ? 'bg-blue-50' : 'bg-gray-50'} rounded-lg my-2`}>
        <div className="flex-shrink-0">
          {isClient ? (
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
            {isClient ? "You" : "Interviewer"}
            <span className="text-xs text-gray-500 ml-2">{timestamp}</span>
          </div>
          <div className="text-gray-800 whitespace-pre-wrap">{displayText}</div>
        </div>
      </div>
    );
  }
  
  // Default view for technical events
  return (
    <div className="flex flex-col gap-2 p-2 rounded-md bg-gray-50 opacity-60 text-xs">
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isClient ? (
          <ArrowDown className="text-blue-400" />
        ) : (
          <ArrowUp className="text-green-400" />
        )}
        <div className="text-gray-500">
          {isClient ? "client:" : "server:"}
          &nbsp;{event.type} | {timestamp}
        </div>
      </div>
      <div
        className={`text-gray-500 bg-gray-200 p-2 rounded-md overflow-x-auto ${
          isExpanded ? "block" : "hidden"
        }`}
      >
        <pre className="text-xs">{JSON.stringify(event, null, 2)}</pre>
      </div>
    </div>
  );
}

export default function EventLog({ events }) {
  // Use a ref to maintain counter between renders
  const counterRef = useRef(0);
  const processedEventIds = useRef(new Set());
  const eventsToDisplay = [];
  let deltaEvents = {};

  // Reset the processed events set if events list changes length dramatically
  // This prevents the set from growing indefinitely
  useEffect(() => {
    if (events.length === 0) {
      processedEventIds.current = new Set();
    }
  }, [events.length === 0]);

  events.forEach((event, index) => {
    if (event.type.endsWith("delta")) {
      if (deltaEvents[event.type]) {
        // for now just log a single event per render pass
        return;
      } else {
        deltaEvents[event.type] = event;
      }
    }

    // Create a truly unique key using a combination of approaches
    // 1. Use a UUID if available in event_id
    // 2. Use the index in the array
    // 3. Use a timestamp if available
    // 4. Use an incrementing counter
    let uniqueKey;
    
    const eventId = event.event_id || 'unknown';
    const eventKey = `${eventId}_${event.timestamp || ''}_${index}`;
    
    // Check if we've already used this key
    if (processedEventIds.current.has(eventKey)) {
      // If duplicate, use the counter to make it unique
      uniqueKey = `event_${eventId}_${index}_${++counterRef.current}`;
    } else {
      uniqueKey = `event_${eventKey}`;
      processedEventIds.current.add(eventKey);
    }

    eventsToDisplay.push(
      <Event key={uniqueKey} event={event} timestamp={event.timestamp} />,
    );
  });

  return (
    <div className="flex flex-col gap-2 overflow-x-auto p-4">
      {events.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-gray-500 font-medium">Your interview will appear here</div>
          <div className="text-gray-400 text-sm mt-2">Start the session to begin</div>
        </div>
      ) : (
        eventsToDisplay
      )}
    </div>
  );
}
