import { agentCall } from "./openai";
import type {
  JobAnalysis,
  VenueProfile,
  LocationIntel,
  InterviewQuestion,
  AnswerEvaluation,
} from "./types";

// ── Agent 1: Job Scout / Listing Analyst ──────────────────────────
export async function analyzeJob(listingText: string): Promise<JobAnalysis> {
  const result = await agentCall(
    `You are an expert bartender job analyst. Analyze the following job listing and extract every useful detail.
Return a JSON object with these exact fields:
- title: string (job title)
- restaurant: string (restaurant/bar name, infer from context if not explicit)
- location: string (city, neighborhood — infer from context clues if needed)
- pay: string (pay range or "Not listed")
- schedule: string (hours/shifts mentioned or "Not specified")
- type: string (full-time/part-time/seasonal)
- description: string (1-2 sentence summary of the role)
- requirements: string[] (list of requirements)
- responsibilities: string[] (list of duties)
- perks: string[] (benefits mentioned)
- redFlags: string[] (concerning aspects — be honest and specific)
- greenFlags: string[] (positive aspects)
- payVerdict: string (is the pay fair? compare to market rates)
- difficultyLevel: string (Easy/Medium/Hard to land)
- tips: string[] (3-5 actionable tips for applying to THIS specific job)

If information is missing, make realistic inferences based on the venue type and location. Be specific and practical, not generic.`,
    listingText,
    { jsonMode: true, maxTokens: 2000 }
  );
  return JSON.parse(result);
}

// ── Agent 2: Venue Researcher ─────────────────────────────────────
export async function researchVenue(
  restaurantName: string,
  location: string
): Promise<VenueProfile> {
  const result = await agentCall(
    `You are a restaurant industry intelligence agent. Generate a comprehensive venue profile.
Based on the name and location, provide your best assessment using your knowledge of restaurants, bars, and the hospitality industry.
Return a JSON object with these exact fields:
- name: string
- type: string (cocktail bar, dive bar, sports bar, fine dining, casual dining, nightclub, rooftop bar, etc.)
- cuisine: string (if applicable, or "N/A — bar focused")
- priceRange: string ($, $$, $$$, or $$$$)
- rating: string (estimated rating with brief note)
- atmosphere: string (detailed 2-sentence description of the vibe)
- clientele: string (who goes there — age range, type of crowd)
- popularDrinks: string[] (5-8 drinks likely popular at this type of venue)
- menuHighlights: string[] (3-5 likely menu items or specialties)
- dressCode: string (expected dress code for staff)
- busyTimes: string (when it's busiest — days and hours)
- managementStyle: string (what to expect from management based on venue type)
- tipsAverage: string (estimated tip range per shift based on venue type and area)
- knownFor: string (what makes this place stand out or what it's known for)

Be specific and realistic. If you know the actual venue, use that knowledge. If not, make strong inferences from the name, type, and location.`,
    `Restaurant/Bar: ${restaurantName}\nLocation: ${location}`,
    { jsonMode: true, maxTokens: 1500 }
  );
  return JSON.parse(result);
}

// ── Agent 3: Location Intel ───────────────────────────────────────
export async function analyzeLocation(
  location: string,
  venueName: string
): Promise<LocationIntel> {
  const result = await agentCall(
    `You are an urban neighborhood analyst specializing in the hospitality industry. Analyze a location from a bartender/server's perspective.
Return a JSON object with these exact fields:
- neighborhood: string (neighborhood name and 1-sentence description)
- vibe: string (the character of this area)
- transitAccess: string (how to get there — subway lines, bus routes, driving/parking)
- walkScore: string (estimated walkability — high/medium/low with note)
- footTraffic: string (pedestrian traffic levels and when)
- nearbyCompetition: string (density and type of other bars/restaurants nearby)
- avgBarPay: string (average bartender hourly + tips in this specific area)
- nightlifeRating: string (rating out of 10 with brief note)
- safetyNote: string (safety at night for workers leaving late shifts)
- prosForWorkers: string[] (3-4 advantages of working in this area)
- consForWorkers: string[] (2-3 disadvantages or watch-outs)

Be practical and honest. Focus on what actually matters for someone commuting to work shifts here.`,
    `Location: ${location}\nVenue: ${venueName}`,
    { jsonMode: true, maxTokens: 1200 }
  );
  return JSON.parse(result);
}

// ── Agent 4: Interview Coach (Question Generator) ─────────────────
export async function generateQuestions(
  job: JobAnalysis,
  venue: VenueProfile
): Promise<InterviewQuestion[]> {
  const result = await agentCall(
    `You are an expert bartender interview coach. Generate 8 realistic, challenging interview questions tailored to this specific job and venue.
Include a mix of:
- 2 Technical questions (cocktail knowledge, POS systems, drink recipes, speed)
- 2 Behavioral questions (teamwork, stress management, customer conflict)
- 2 Situational questions (real scenarios they'd face at THIS specific venue)
- 2 Venue-Specific questions (about the restaurant type, clientele, menu knowledge)

Return a JSON object with a "questions" key containing an array of objects:
- id: number (1-8)
- question: string (the interview question)
- category: string (Technical / Behavioral / Situational / Venue-Specific)
- difficulty: string (Easy / Medium / Hard)
- tip: string (brief 1-sentence coaching tip for answering well)`,
    `Position: ${job.title} at ${job.restaurant} in ${job.location}
Venue Type: ${venue.type}
Price Range: ${venue.priceRange}
Clientele: ${venue.clientele}
Atmosphere: ${venue.atmosphere}
Known For: ${venue.knownFor}
Requirements: ${job.requirements.join(", ")}
Responsibilities: ${job.responsibilities.join(", ")}`,
    { jsonMode: true, maxTokens: 2000 }
  );
  const parsed = JSON.parse(result);
  return Array.isArray(parsed) ? parsed : parsed.questions || [];
}

// ── Agent 5: Interview Coach (Answer Evaluator) ───────────────────
export async function evaluateAnswer(
  question: string,
  answer: string,
  jobContext: string,
  venueContext: string
): Promise<AnswerEvaluation> {
  const result = await agentCall(
    `You are a bartender interview coach providing detailed, honest feedback on interview answers.
Score on a 0-10 scale:
- 0-3: Poor (missing key points, unprofessional, off-topic)
- 4-5: Below average (generic, lacks specifics, surface-level)
- 6-7: Good (solid answer, shows competence, could be stronger)
- 8-9: Great (specific examples, confident, shows real experience)
- 10: Perfect (couldn't be better, would hire immediately)

Return a JSON object with:
- score: number (0-10, be honest — don't inflate)
- verdict: string (one-line summary like "Strong answer but needs specific examples")
- strengths: string[] (2-3 specific things they did well)
- improvements: string[] (2-3 specific, actionable ways to improve)
- sampleAnswer: string (a strong 2-3 sentence sample answer for comparison)`,
    `Interview Question: ${question}
Candidate's Answer: ${answer}
Job: ${jobContext}
Venue Context: ${venueContext}`,
    { jsonMode: true, maxTokens: 1000 }
  );
  return JSON.parse(result);
}

// ── Agent 6: Resume Agent ─────────────────────────────────────────
export async function enhanceResume(
  userInfo: {
    fullName: string;
    email: string;
    phone: string;
    experience: string;
    skills: string;
    summary: string;
  },
  job: JobAnalysis,
  venue: VenueProfile
): Promise<{
  summary: string;
  skills: string;
  experience: string;
  highlights: string[];
}> {
  const result = await agentCall(
    `You are an expert resume writer for the restaurant and bar industry.
Enhance the candidate's resume content to be optimized for this specific bartender job.
Make it professional, ATS-friendly, and tailored. Use action verbs and quantify where possible.
Do NOT fabricate experience — enhance and reframe what they actually have.

Return a JSON object with:
- summary: string (professional summary, 2-3 sentences, tailored to this specific role)
- skills: string (comma-separated relevant skills, prioritized for this job)
- experience: string (enhanced experience description with action verbs and metrics)
- highlights: string[] (3-4 bullet points highlighting why this candidate fits THIS specific job)`,
    `Candidate:
Name: ${userInfo.fullName}
Summary: ${userInfo.summary || "Not provided"}
Skills: ${userInfo.skills || "Not provided"}
Experience: ${userInfo.experience || "Not provided"}

Target Position: ${job.title} at ${job.restaurant}
Location: ${job.location}
Requirements: ${job.requirements.join(", ")}
Venue Type: ${venue.type}
Clientele: ${venue.clientele}
Atmosphere: ${venue.atmosphere}`,
    { jsonMode: true, maxTokens: 1500 }
  );
  return JSON.parse(result);
}
