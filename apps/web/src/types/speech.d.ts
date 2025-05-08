export interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

export interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

export interface SpeechRecognitionError extends Event {
  readonly error: string;
  readonly message: string;
}

export interface SpeechRecognition extends SpeechRecognitionEvent {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onaudioend?: (event: Event) => void;
  onaudiostart?: (event: Event) => void;
  onend?: (event: Event) => void;
  onerror?: (event: SpeechRecognitionError) => void;
  onnomatch?: (event: SpeechRecognitionEvent) => void;
  onresult?: (event: SpeechRecognitionEvent) => void;
  onsoundstart?: (event: Event) => void;
  onsoundend?: (event: Event) => void;
  onspeechstart?: (event: Event) => void;
  onspeechend?: (event: Event) => void;
  onstart?: (event: Event) => void;
}

declare global {
  interface Window {
    SpeechRecognition: {
      prototype: SpeechRecognition;
      new (): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      prototype: SpeechRecognition;
      new (): SpeechRecognition;
    };
  }
}
