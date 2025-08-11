export interface SessionResponse {
  session_id: string;
  question: string;
}

export interface MessageResponse {
  question: string;
  options?: string[];
  is_finished: boolean;
  final_answer?: string;
  retrieved_context_preview?: string;
  requires_file_upload?: boolean;
}

export declare function startSession(): Promise<SessionResponse>;
export declare function sendMessage(sessionId: string, answer: string, llmDetail?: string): Promise<MessageResponse>;
export declare function uploadImage(sessionId: string, file: File): Promise<MessageResponse>; 