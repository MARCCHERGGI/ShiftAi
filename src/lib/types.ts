export interface JobAnalysis {
  title: string;
  restaurant: string;
  location: string;
  pay: string;
  schedule: string;
  type: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  perks: string[];
  redFlags: string[];
  greenFlags: string[];
  payVerdict: string;
  difficultyLevel: string;
  tips: string[];
}

export interface VenueProfile {
  name: string;
  type: string;
  cuisine: string;
  priceRange: string;
  rating: string;
  atmosphere: string;
  clientele: string;
  popularDrinks: string[];
  menuHighlights: string[];
  dressCode: string;
  busyTimes: string;
  managementStyle: string;
  tipsAverage: string;
  knownFor: string;
}

export interface LocationIntel {
  neighborhood: string;
  vibe: string;
  transitAccess: string;
  walkScore: string;
  footTraffic: string;
  nearbyCompetition: string;
  avgBarPay: string;
  nightlifeRating: string;
  safetyNote: string;
  prosForWorkers: string[];
  consForWorkers: string[];
}

export interface InterviewQuestion {
  id: number;
  question: string;
  category: string;
  difficulty: string;
  tip: string;
}

export interface AnswerEvaluation {
  score: number;
  verdict: string;
  strengths: string[];
  improvements: string[];
  sampleAnswer: string;
}

export interface ResearchPackage {
  id: string;
  rawListing: string;
  job: JobAnalysis;
  venue: VenueProfile;
  location: LocationIntel;
  questions: InterviewQuestion[];
  createdAt: string;
}

export interface InterviewResult {
  questionId: number;
  question: string;
  answer: string;
  evaluation: AnswerEvaluation;
}
