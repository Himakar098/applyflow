export type ExternalJob = {
  id: string;
  title: string;
  company: string;
  location?: string;
  description?: string;
  url?: string;
  source: string;
  postedAt?: string;
};

export type MatchBreakdown = {
  role: number;
  skills: number;
  tech: number;
  seniority: number;
  location: number;
};

export type RecommendedJob = ExternalJob & {
  matchScore: number;
  matchReasons: string[];
  matchBreakdown: MatchBreakdown;
};

export type RecommendationCache = {
  date: string;
  createdAt?: string;
  items: RecommendedJob[];
  hiddenIds?: string[];
  savedIds?: string[];
  savedMap?: Record<string, string>;
};
