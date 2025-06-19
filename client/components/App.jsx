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
  }

  // Initialize the interview process
  function startInterview() {
    setInterviewState("interviewing");
    setCurrentQuestion(1);
    // Send initial instructions to GPT
    sendClientEvent({
      type: "response.create",
      response: {
        instructions: `
          You are now a mock interviewer for React developers. The interview will consist of 10 questions focusing on React fundamentals.
          The interview has just started. Ask one question at a time and wait for the user's response.
          After the user answers, provide brief feedback on their answer before moving to the next question.
          Keep track of how well they're doing to provide an overall assessment at the end.
          For the first question, ask about React components and their types.
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
            Ask the next question (question #${currentQuestion + 1} of 10).
            Remember to provide brief feedback on their previous answer first.
            Make this a fundamental React interview question appropriate for beginners to intermediate developers.
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
            The interview is now complete. Provide a comprehensive evaluation of the candidate's performance.
            Highlight their strengths and areas for improvement based on their responses to all 10 questions.
            Give them an overall rating and suggestions for further learning.
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

        // If this is a mic check response, check for confirmation
        if (interviewState === "mic-check" && event.type === "response.done") {
          const responseContent = event.response.output
            .filter((item) => item.type === "text")
            .map((item) => item.text)
            .join(" ")
            .toLowerCase();

            console.log("Mic check response:", responseContent);
          if (
            responseContent.includes("great") ||
            responseContent.includes("hear you") ||
            responseContent.includes("working") ||
            responseContent.includes("ready to begin")
          ) {
            // Mic check successful, proceed to interview
            startInterview();
          }
        }
      });

      // Set session active when the data channel is opened
      dataChannel.addEventListener("open", () => {
        setIsSessionActive(true);
        setEvents([]);

        // Initiate mic check
        setTimeout(() => {
          sendClientEvent({
            type: "response.create",
            response: {
              instructions: `
                You are a mock interviewer for React developers. First, we need to check if the user's microphone is working.
                Ask the user to say "Hi, I am ready to start" or something similar to check their microphone.
                Wait for their response. If you can hear them clearly, confirm that their microphone is working and that we're ready to begin the interview.
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
