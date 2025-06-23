import React from "react";
import * as Icons from "react-feather";

export default function InterviewPanel({ interviewState, currentQuestion, isSessionActive }) {
  // Interview stages
  const renderContent = () => {
    if (!isSessionActive) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
          <Icons.HelpCircle size={48} className="text-gray-400" />
          <h2 className="text-xl font-bold">React Mock Interview</h2>
          <p>Start the session to begin your mock interview</p>
        </div>
      );
    }

    switch (interviewState) {
      case "mic-check":
        return (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <Icons.Mic size={48} className="text-blue-500 animate-pulse" />
            <h2 className="text-xl font-bold">Microphone Check</h2>
            <p className="mb-2">Please say "Hello" to verify your microphone is working</p>
            <div className="bg-yellow-50 p-3 rounded-lg text-sm border border-yellow-200 w-full">
              <p className="font-medium text-yellow-700">Important:</p>
              <p className="text-yellow-600">After your microphone is confirmed, the React interview will begin automatically.</p>
            </div>
          </div>
        );
      case "interviewing":
        return (
          <div className="flex flex-col h-full gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h2 className="text-xl font-bold">React Interview in Progress</h2>
              <div className="flex items-center justify-between mt-4">
                <span className="text-lg font-medium">Question</span>
                <span className="text-lg font-bold text-blue-600">{currentQuestion}/10</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                <div
                  className="bg-blue-600 h-2.5 rounded-full"
                  style={{ width: `${(currentQuestion / 10) * 100}%` }}
                ></div>
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg flex-1">
              <h3 className="font-bold">Interview Tips:</h3>
              <ul className="list-disc pl-5 mt-2 space-y-2">
                <li>Speak clearly and at a moderate pace</li>
                <li>If you don't know something, it's okay to say so</li>
                <li>Try to provide examples when possible</li>
                <li>Explain your thought process</li>
                <li>Ask for clarification if a question is unclear</li>
              </ul>
              
              <h3 className="font-bold mt-4">Common React Topics:</h3>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                <li>Components & Props</li>
                <li>State & Lifecycle</li>
                <li>Hooks</li>
                <li>Context API</li>
                <li>Performance Optimization</li>
                <li>Error Boundaries</li>
                <li>Virtual DOM</li>
              </ul>
            </div>
          </div>
        );
      case "completed":
        return (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <Icons.Award size={48} className="text-green-500" />
            <h2 className="text-xl font-bold">Interview Completed!</h2>
            <p>Thank you for completing your mock React interview.</p>
            <p>Review the feedback provided and consider areas for improvement.</p>
            <div className="mt-4 p-4 bg-green-50 rounded-lg w-full">
              <p className="font-medium">Want to try again?</p>
              <p className="text-sm">Start a new session to practice with different questions.</p>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <Icons.CheckCircle size={48} className="text-gray-400" />
            <h2 className="text-xl font-bold">Ready to Begin</h2>
            <p>Press "Start Interview" to begin the session</p>
          </div>
        );
    }
  };

  return (
    <section className="h-full w-full flex flex-col gap-4 bg-white rounded-lg p-4 shadow-sm">
      {renderContent()}
    </section>
  );
}
