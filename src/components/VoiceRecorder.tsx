'use client';

import { useState, useEffect } from 'react';

interface VoiceRecorderProps {
  onTranscriptionComplete: (text: string) => void;
}

export default function VoiceRecorder({ onTranscriptionComplete }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');

  const startRecording = async () => {
    try {
      setIsRecording(true);
      // Implement recording logic here
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = async () => {
    try {
      setIsRecording(false);
      // Implement stop recording logic here
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  };

  return (
    <div className="flex items-center space-x-4">
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
          isRecording
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
      >
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </button>
      {transcript && (
        <p className="text-sm text-gray-600">
          Transcript: {transcript}
        </p>
      )}
    </div>
  );
}