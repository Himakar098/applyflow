import OpenAI from "openai";
import type { Profile, JobApplication } from "@/lib/types";

/** AI-powered career profile analysis and personalization */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface CareerProfile {
  userId: string;
  summary: string; // 2-3 sentence career summary
  strengths: string[]; // Key strengths extracted from profile
  careerGoals: string[]; // Inferred career aspirations
  preferredCompanySize: "startup" | "scale-up" | "mid-market" | "enterprise" | "non-profit";
  preferredIndustries: string[];
  growthAreas: string[]; // Areas the user wants to develop
  learningFocus: string[]; // Technologies/skills they want to learn
  successFactors: string[]; // What tends to lead to interviews/offers
  generatedAt: string;
  expiresAt: string;
}

export interface PersonalizationScore {
  score: number; // 0-100
  career_growth_potential: number; // How much will this role help career growth?
  cultural_fit: number; // Does role align with preferences?
  skill_development: number; // Will they learn new skills?
  growth_trajectory: number; // Does role represent career progression?
  interest_alignment: number; // How well does role align with interests?
}

/**
 * Builds a career profile from user data using AI
 * This is cached and updated weekly to reduce API calls
 */
export async function buildCareerProfile(
  userId: string,
  profile: Profile,
  recentApplications: JobApplication[]
): Promise<CareerProfile> {
  const successfulApplications = recentApplications.filter(
    (job) =>
      job.feedback?.outcome === "interview" ||
      job.feedback?.outcome === "offer" ||
      job.feedback?.outcome === "accepted"
  );

  const rejectedApplications = recentApplications.filter(
    (job) => job.feedback?.outcome === "rejected" || job.feedback?.outcome === "ghosted"
  );

  const profileSummary = `
Profile:
- Target Roles: ${profile.targetRoles.join(", ")}
- Years of Experience: ${profile.yearsExperienceApprox || "Not specified"}
- Skills: ${[...profile.skills.languages, ...profile.skills.tools].join(", ")}
- Work Experience: ${profile.workExperience.map((w) => w.role).join(", ")}
- Education: ${profile.education.map((e) => e.degree).join(", ")}

Recent Successful Applications (${successfulApplications.length}):
${successfulApplications.map((job) => `- ${job.title} at ${job.company}`).join("\n")}

Rejected/Ghosted Applications (${rejectedApplications.length}):
${rejectedApplications.map((job) => `- ${job.title} at ${job.company}`).join("\n")}
`;

  const prompt = `You are a career coach. Analyze this professional profile and application history to create a brief career profile.

${profileSummary}

Provide the response in JSON format with these fields:
{
  "summary": "2-3 sentence professional summary",
  "strengths": ["strength1", "strength2", "strength3"],
  "careerGoals": ["goal1", "goal2"],
  "preferredCompanySize": "startup|scale-up|mid-market|enterprise|non-profit",
  "preferredIndustries": ["industry1", "industry2"],
  "growthAreas": ["area1", "area2"],
  "learningFocus": ["skill1", "skill2"],
  "successFactors": ["what leads to interviews/offers"]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse JSON response");
    }

    const careerData = JSON.parse(jsonMatch[0]);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    return {
      userId,
      summary: careerData.summary,
      strengths: careerData.strengths || [],
      careerGoals: careerData.careerGoals || [],
      preferredCompanySize: careerData.preferredCompanySize || "mid-market",
      preferredIndustries: careerData.preferredIndustries || [],
      growthAreas: careerData.growthAreas || [],
      learningFocus: careerData.learningFocus || [],
      successFactors: careerData.successFactors || [],
      generatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error) {
    console.error("Error building career profile:", error);
    // Return a default profile if AI fails
    return {
      userId,
      summary: `Professional with ${profile.yearsExperienceApprox || "some"} years of experience in ${profile.targetRoles[0] || "various"} roles.`,
      strengths: profile.skills.tools.slice(0, 3),
      careerGoals: profile.targetRoles,
      preferredCompanySize: "mid-market",
      preferredIndustries: [],
      growthAreas: [],
      learningFocus: profile.skills.languages.slice(0, 2),
      successFactors: [],
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
}

/**
 * Generates AI-powered personalization score for a job
 */
export async function scoreJobWithAI(
  jobData: {
    title: string;
    description: string;
    company: string;
    industry?: string;
    seniority?: string;
  },
  careerProfile: CareerProfile
): Promise<PersonalizationScore> {
  const prompt = `You are a career advisor. Score how well this job aligns with someone's career profile on several dimensions.

Career Profile:
- Summary: ${careerProfile.summary}
- Strengths: ${careerProfile.strengths.join(", ")}
- Growth Areas: ${careerProfile.growthAreas.join(", ")}
- Career Goals: ${careerProfile.careerGoals.join(", ")}
- Learning Focus: ${careerProfile.learningFocus.join(", ")}

Job Opportunity:
- Title: ${jobData.title}
- Company: ${jobData.company}
- Industry: ${jobData.industry || "Unknown"}
- Seniority: ${jobData.seniority || "Unknown"}
- Description: ${jobData.description.substring(0, 500)}

Return a JSON object with scores (0-100) for:
{
  "career_growth_potential": score,
  "cultural_fit": score,
  "skill_development": score,
  "growth_trajectory": score,
  "interest_alignment": score,
  "reasoning": "brief explanation"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 300,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse JSON response");
    }

    const scores = JSON.parse(jsonMatch[0]);

    const avgScore = Math.round(
      (scores.career_growth_potential +
        scores.cultural_fit +
        scores.skill_development +
        scores.growth_trajectory +
        scores.interest_alignment) /
        5
    );

    return {
      score: avgScore,
      career_growth_potential: scores.career_growth_potential || 50,
      cultural_fit: scores.cultural_fit || 50,
      skill_development: scores.skill_development || 50,
      growth_trajectory: scores.growth_trajectory || 50,
      interest_alignment: scores.interest_alignment || 50,
    };
  } catch (error) {
    console.error("Error scoring job with AI:", error);
    // Return neutral scores if AI fails
    return {
      score: 50,
      career_growth_potential: 50,
      cultural_fit: 50,
      skill_development: 50,
      growth_trajectory: 50,
      interest_alignment: 50,
    };
  }
}

/**
 * Generates a personalized match explanation
 */
export async function explainJobMatch(
  jobData: {
    title: string;
    description: string;
    company: string;
  },
  careerProfile: CareerProfile,
  traditionalScore: number,
  aiScore: number
): Promise<string> {
  void traditionalScore;
  void aiScore;

  const prompt = `Write a brief (2-3 sentence) explanation of why this job is a good match for someone with this career profile. Mention specific aspects of the job that align with their goals and strengths.

Career Profile: ${careerProfile.summary}
Strengths: ${careerProfile.strengths.join(", ")}
Career Goals: ${careerProfile.careerGoals.join(", ")}

Job: ${jobData.title} at ${jobData.company}

Avoid generic language. Be specific and personal.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 150,
    });

    return (
      response.choices[0].message.content ||
      "This role aligns well with your career goals and skill set."
    );
  } catch (error) {
    console.error("Error generating match explanation:", error);
    return `This role at ${jobData.company} appears to be a strong match for your profile.`;
  }
}

/**
 * Checks if career profile is still valid (not expired)
 */
export function isCareerProfileValid(careerProfile: CareerProfile): boolean {
  return new Date(careerProfile.expiresAt) > new Date();
}
