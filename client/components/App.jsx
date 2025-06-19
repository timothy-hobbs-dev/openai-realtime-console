import { useEffect, useRef, useState } from "react";
import logo from "/assets/openai-logomark.svg";
import EventLog from "./EventLog";
import SessionControls from "./SessionControls";
import InterviewPanel from "./InterviewPanel";

export default function App() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);
  const [interviewState, setInterviewState] = useState("idle"); // idle, mic-check, interviewing, completed
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const peerConnection = useRef(null);
  const audioElement = useRef(null);
  const micCheckComplete = useRef(false);

  async function startSession() {
    // Get a session token for OpenAI Realtime API
    const tokenResponse = await fetch("/token");
    const data = await tokenResponse.json();
    const EPHEMERAL_KEY = data.client_secret.value;

    // Create a peer connection
    const pc = new RTCPeerConnection();

    // Set up to play remote audio from the model
    audioElement.current = document.createElement("audio");
    audioElement.current.autoplay = true;
    pc.ontrack = (e) => (audioElement.current.srcObject = e.streams[0]);

    // Add local audio track for microphone input in the browser
    const ms = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    pc.addTrack(ms.getTracks()[0]);

    // Set up data channel for sending and receiving events
    const dc = pc.createDataChannel("oai-events");
    setDataChannel(dc);

    // Start the session using the Session Description Protocol (SDP)
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const baseUrl = "https://api.openai.com/v1/realtime";
    const model = "gpt-4o-realtime-preview-2024-12-17";
    const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${EPHEMERAL_KEY}`,
        "Content-Type": "application/sdp",
      },
    });

    const answer = {
      type: "answer",
      sdp: await sdpResponse.text(),
    };
    await pc.setRemoteDescription(answer);

    peerConnection.current = pc;
    setInterviewState("mic-check");
    micCheckComplete.current = false;
  }

  // Stop current session, clean up peer connection and data channel
  function stopSession() {
    if (dataChannel) {
      dataChannel.close();
    }

    peerConnection.current?.getSenders().forEach((sender) => {
      if (sender.track) {
        sender.track.stop();
      }
    });

    if (peerConnection.current) {
      peerConnection.current.close();
    }

    setIsSessionActive(false);
    setDataChannel(null);
    peerConnection.current = null;
    setInterviewState("idle");
    setCurrentQuestion(0);
    micCheckComplete.current = false;
  }

  // Send a message to the model
  function sendClientEvent(message) {
    if (dataChannel) {
      const timestamp = new Date().toLocaleTimeString();
      message.event_id = message.event_id || crypto.randomUUID();

      // send event before setting timestamp since the backend peer doesn't expect this field
      dataChannel.send(JSON.stringify(message));

      // if guard just in case the timestamp exists by miracle
      if (!message.timestamp) {
        message.timestamp = timestamp;
      }
      setEvents((prev) => [message, ...prev]);
    } else {
      console.error(
        "Failed to send message - no data channel available",
        message,
      );
    }
  }

  // Send a text message to the model
  function sendTextMessage(message) {
    const event = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: message,
          },
        ],
      },
    };

    sendClientEvent(event);
    sendClientEvent({ type: "response.create" });
    
    // Check if this is a response to the mic check
    if (interviewState === "mic-check" && !micCheckComplete.current) {
      console.log("User responded to mic check, proceeding to interview");
      micCheckComplete.current = true;
      
      // Use a slight delay to allow the model to process the user's response
      setTimeout(() => {
        startInterview();
      }, 1500);
    }
  }

  // Initialize the interview process
  function startInterview() {
    setInterviewState("interviewing");
    setCurrentQuestion(1);
    
    // Send initial instructions to GPT with very explicit role guidance
    sendClientEvent({
      type: "response.create",
      response: {
        instructions: `
          IMPORTANT: You are now running in interview mode as a React developer interviewer.
          Your sole purpose is to conduct a structured technical interview about React.
          
          Instructions:
          1. You MUST immediately begin the interview by introducing yourself as "React Interview Bot".
          2. You MUST ask the first React question now - specifically about React components and their types.
          3. You MUST NOT ask "What can I help you with today?" or similar open-ended questions.
          4. You MUST NOT deviate from the interview format or respond to general assistance requests.
          5. You MUST stay focused on the React interview process.
          
          First question format: "Let's begin the React interview. Question 1: What are the different types of React components, and when would you use each type?"
        `,
      },
    });
  }

  // Proceed to the next interview question
  function nextQuestion() {
    if (currentQuestion < 10) {
      setCurrentQuestion((prevQuestion) => prevQuestion + 1);
      sendClientEvent({
        type: "response.create",
        response: {
          instructions: `
            You are a React technical interviewer.
            
            IMPORTANT: You MUST continue with the structured React interview.
            
            1. First, provide brief feedback on their previous answer.
            2. Then, ask question #${currentQuestion + 1} of 10.
            3. Make this a fundamental React interview question.
            4. Do NOT ask if they need help with anything else.
            5. Stay firmly in the role of a React technical interviewer.
            
            Example format: "Regarding your previous answer... [brief feedback]. Now for question ${currentQuestion + 1}: [specific React question]"
          `,
        },
      });
    } else {
      // Interview completed
      setInterviewState("completed");
      sendClientEvent({
        type: "response.create",
        response: {
          instructions: `
            The React technical interview is now complete. 
            
            Please provide:
            1. A comprehensive evaluation of the candidate's performance
            2. Highlight specific strengths demonstrated during the interview
            3. Identify areas for improvement based on their responses
            4. Give an overall rating out of 10
            5. Suggest specific resources or topics for further learning
            
            Begin with: "Thank you for completing the React technical interview. Here's my evaluation of your performance:"
          `,
        },
      });
    }
  }

  // Attach event listeners to the data channel when a new one is created
  useEffect(() => {
    if (dataChannel) {
      // Append new server events to the list
      dataChannel.addEventListener("message", (e) => {
        const event = JSON.parse(e.data);
        if (!event.timestamp) {
          event.timestamp = new Date().toLocaleTimeString();
        }

        setEvents((prev) => [event, ...prev]);

        // If this is a mic check response that contains an open-ended question
        // It means the model didn't properly understand it was doing a mic check
        if (interviewState === "mic-check" && event.type === "response.done" && !micCheckComplete.current) {
          const responseContent = event.response?.output
            ?.filter((item) => item.type === "text" || (item.type === "audio" && item.transcript))
            .map((item) => item.text || item.transcript || "")
            .join(" ")
            .toLowerCase();

          console.log("Mic check response:", responseContent);
          
          // If model asks "what can I help you with" or similar, it's not in interview mode
          // Force it into interview mode
          if (
            responseContent.includes("what can i help you with") ||
            responseContent.includes("how can i assist you") ||
            responseContent.includes("how may i help")
          ) {
            console.log("Model in assistant mode, forcing to interview mode");
            micCheckComplete.current = true;
            setTimeout(() => {
              startInterview();
            }, 500);
          }
          // If it properly confirms the mic works, also proceed
          else if (
            responseContent.includes("great") ||
            responseContent.includes("hear you") ||
            responseContent.includes("working") ||
            responseContent.includes("ready to begin")
          ) {
            console.log("Mic check successful, proceeding to interview");
            micCheckComplete.current = true;
            setTimeout(() => {
              startInterview();
            }, 500);
          }
        }
      });

      // Set session active when the data channel is opened
      dataChannel.addEventListener("open", () => {
        setIsSessionActive(true);
        setEvents([]);

        // Initiate mic check with clearer instructions
        setTimeout(() => {
          sendClientEvent({
            type: "response.create",
            response: {
              instructions: `
                You are specifically performing a microphone check before a React technical interview.
                
                1. Ask the user to say "Hello" or a short phrase to check their microphone.
                2. Listen for their response.
                3. If you can hear them, confirm their microphone is working.
                4. Tell them we'll begin the React interview immediately after this check.
                5. Do NOT ask "What can I help you with" or similar general questions.
                
                Say exactly: "Hello! I need to check your microphone before we begin the React interview. Please say 'Hello' or a short phrase so I can confirm your microphone is working."
              `,
            },
          });
        }, 1000);
      });
    }
  }, [dataChannel, interviewState]);

  return (
    <>
      <nav className="absolute top-0 left-0 right-0 h-16 flex items-center">
        <div className="flex items-center gap-4 w-full m-4 pb-2 border-0 border-b border-solid border-gray-200">
          <img style={{ width: "24px" }} src={logo} />
          <h1>React Developer Mock Interviewer</h1>
        </div>
      </nav>
      <main className="absolute top-16 left-0 right-0 bottom-0">
        <section className="absolute top-0 left-0 right-[380px] bottom-0 flex">
          <section className="absolute top-0 left-0 right-0 bottom-32 px-4 overflow-y-auto">
            <EventLog events={events} />
          </section>
          <section className="absolute h-32 left-0 right-0 bottom-0 p-4">
            <SessionControls
              startSession={startSession}
              stopSession={stopSession}
              sendClientEvent={sendClientEvent}
              sendTextMessage={sendTextMessage}
              events={events}
              isSessionActive={isSessionActive}
              interviewState={interviewState}
              currentQuestion={currentQuestion}
              nextQuestion={nextQuestion}
            />
          </section>
        </section>
        <section className="absolute top-0 w-[380px] right-0 bottom-0 p-4 pt-0 overflow-y-auto">
          <InterviewPanel
            interviewState={interviewState}
            currentQuestion={currentQuestion}
            isSessionActive={isSessionActive}
          />
        </section>
      </main>
    </>
  );
}
