import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@deco/ui/components/button.tsx";
import { Mic, MicOff } from 'lucide-react';
import type { SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionError } from '../../types/speech';

interface AudioButtonProps {
  onMessage: (message: string) => void;
}

export const AudioButton: React.FC<AudioButtonProps> = ({ onMessage }) => {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'pt-BR';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
          .map(result => result[0])
          .map(result => result.transcript)
          .join('');

        if (event.results[0].isFinal) {
          onMessage(transcript);
        }
      };

      recognition.onerror = (event: SpeechRecognitionError) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'aborted') {
          // Ignore aborted errors as they're expected when stopping recognition
          return;
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      setRecognition(recognition);

      return () => {
        if (recognition) {
          try {
            recognition.stop();
          } catch (e) {
            // Ignore errors when stopping recognition during cleanup
          }
        }
      };
    }
  }, [onMessage]);

  const toggleListening = useCallback(() => {
    if (!recognition) return;

    try {
      if (isListening) {
        recognition.stop();
      } else {
        recognition.start();
        setIsListening(true);
      }
    } catch (error) {
      console.error('Error toggling speech recognition:', error);
      setIsListening(false);
    }
  }, [recognition, isListening]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-4">
        <Button
          type="button"
          variant={isListening ? "destructive" : "default"}
          size="icon"
          onClick={toggleListening}
          className="h-8 w-8 rounded-full cursor-pointer"
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}; 