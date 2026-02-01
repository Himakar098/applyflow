export type AIResponse = {
  text: string;
};

export interface AIProvider {
  summarizeResume(text: string): Promise<AIResponse>;
  improveSummary?(text: string): Promise<AIResponse>;
}
