export interface PdfDocument {
  file: File;
  text: string;
}

export interface ImagePayload {
    data: string; // base64
    mimeType: string;
    name: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
}

export interface ConversationTurn {
  role: 'user' | 'model';
  content: string;
}

export interface Profile {
  name: string;
  title: string;
  picture: string | null; // base64 data URL
}
