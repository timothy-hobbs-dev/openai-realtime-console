import { useState } from "react";
import { CloudLightning, CloudOff, MessageSquare, Mic, ArrowRight } from "react-feather";
import Button from "./Button";

function SessionStopped({ startSession }) {
  const [isActivating, setIsActivating] = useState(false);

  function handleStartSession() {
    if (isActivating) return;

    setIsActivating(true);
    startSession();
  }

  return (
    <div className="flex items-center justify-center w-full h-full">
      <Button
        onClick={handleStartSession}
        className={isActivating ? "bg-gray-600" : "bg-blue-600"}
        icon={<CloudLightning height={16} />}
      >
        {isActivating ? "starting interview..." : "start interview"}
      </Button>
    </div>
  );
}

function SessionActive({ 
  stopSession, 
  sendTextMessage, 
  interviewState,
  currentQuestion,
  nextQuestion
}) {
  const [message, setMessage] = useState("");

  function handleSendClientEvent() {
    sendTextMessage(message);
    setMessage("");
  }

  return (
    <div className="flex items-center justify-center w-full h-full gap-4">
      <input
        onKeyDown={(e) => {
          if (e.key === "Enter" && message.trim()) {
            handleSendClientEvent();
          }
        }}
        type="text"
        placeholder={interviewState === "mic-check" ? "or type your response..." : "type your answer..."}
        className="border border-gray-200 rounded-full p-4 flex-1"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      
      {interviewState === "mic-check" ? (
        <Button
          onClick={() => {
            if (message.trim()) {
              handleSendClientEvent();
            }
          }}
          icon={<Mic height={16} />}
          className="bg-blue-500"
        >
          Check Mic
        </Button>
      ) : interviewState === "interviewing" ? (
        <>
          <Button
            onClick={() => {
              if (message.trim()) {
                handleSendClientEvent();
              }
            }}
            icon={<MessageSquare height={16} />}
            className="bg-blue-500"
          >
            Answer
          </Button>
          <Button 
            onClick={nextQuestion} 
            icon={<ArrowRight height={16} />}
            className="bg-green-500"
          >
            Next ({currentQuestion}/10)
          </Button>
        </>
      ) : (
        <Button
          onClick={() => {
            if (message.trim()) {
              handleSendClientEvent();
            }
          }}
          icon={<MessageSquare height={16} />}
          className="bg-blue-500"
        >
          Send
        </Button>
      )}
      
      <Button onClick={stopSession} icon={<CloudOff height={16} />} className="bg-red-500">
        End Interview
      </Button>
    </div>
  );
}

export default function SessionControls({
  startSession,
  stopSession,
  sendClientEvent,
  sendTextMessage,
  isSessionActive,
  interviewState,
  currentQuestion,
  nextQuestion
}) {
  return (
    <div className="flex gap-4 border-t-2 border-gray-200 h-full rounded-md">
      {isSessionActive ? (
        <SessionActive
          stopSession={stopSession}
          sendClientEvent={sendClientEvent}
          sendTextMessage={sendTextMessage}
          interviewState={interviewState}
          currentQuestion={currentQuestion}
          nextQuestion={nextQuestion}
        />
      ) : (
        <SessionStopped startSession={startSession} />
      )}
    </div>
  );
}
