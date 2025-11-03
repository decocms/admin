import type {
  LanguageModel,
  LanguageModelUsage,
  CoreMessage,
} from "ai";
import { generateText } from "ai";

export interface RSAConfig {
  k?: number; // Aggregation set size
  n?: number; // Population size  
  t?: number; // Number of iterations
  temperature?: number;
  maxTokens?: number;
  taskKind?: "general" | "math" | "code";
}

const DEFAULT_RSA_CONFIG: Required<RSAConfig> = {
  k: 4,
  n: 16,
  t: 10,
  temperature: 1.0,
  maxTokens: 2048,
  taskKind: "general",
};

function buildAggregatePrompt(
  question: string,
  candidates: string[],
  kind: "general" | "math" | "code",
): string {
  let problemKind: string;
  let formatHint: string;

  switch (kind) {
    case "math":
      problemKind = "math problem";
      formatHint = "\\boxed{}";
      break;
    case "code":
      problemKind = "code implementation problem";
      formatHint = "```language\n...\n```";
      break;
    default:
      problemKind = "problem";
      formatHint = "your final answer";
  }

  const parts: string[] = [];

  if (candidates.length === 1) {
    parts.push(
      `You are given a ${problemKind} and a candidate solution. ` +
        "The candidate may be incomplete or contain errors. " +
        "Refine this trajectory and produce an improved, higher-quality solution. " +
        "If it is entirely wrong, attempt a new strategy. " +
        `End with the final result in ${formatHint}.\n`,
    );
  } else {
    parts.push(
      `You are given a ${problemKind} and several candidate solutions. ` +
        "Some candidates may be incorrect or contain errors. " +
        "Aggregate the useful ideas and produce a single, high-quality solution. " +
        "Reason carefully; if candidates disagree, choose the correct path. " +
        "If all are incorrect, then attempt a different strategy. " +
        `End with the final result in ${formatHint}.\n`,
    );
  }

  parts.push("Problem:\n");
  parts.push(question.trim() + "\n");

  if (candidates.length === 1) {
    parts.push("Candidate solution (may contain mistakes):\n");
    parts.push(`---- Candidate ----\n${candidates[0].trim()}\n`);
    parts.push(
      `Now refine the candidate into an improved solution. Provide clear reasoning and end with the final answer in ${formatHint}.`,
    );
  } else {
    parts.push("Candidate solutions (may contain mistakes):\n");
    for (let i = 0; i < candidates.length; i++) {
      parts.push(`---- Solution ${i + 1} ----\n${candidates[i].trim()}\n`);
    }
    parts.push(
      `Now write a single improved solution. Provide clear reasoning and end with the final answer in ${formatHint}.`,
    );
  }

  return parts.join("\n");
}

function generateCandidateSets(
  population: string[] | null,
  n: number,
  k: number,
): (string[] | null)[] {
  if (!population || population.length === 0) {
    return Array(n).fill(null);
  }

  const result: (string[] | null)[] = [];
  for (let i = 0; i < n; i++) {
    const sampled: string[] = [];
    const available = [...population];
    const sampleSize = Math.min(k, available.length);

    for (let j = 0; j < sampleSize; j++) {
      const idx = Math.floor(Math.random() * available.length);
      sampled.push(available[idx]);
      available.splice(idx, 1);
    }

    result.push(sampled);
  }

  return result;
}

/**
 * Run Recursive Self-Aggregation (RSA) on any LanguageModel
 * 
 * This wraps a language model with RSA inference, running N candidates
 * for T iterations with aggregation of K solutions at each step.
 * 
 * Returns the final population and aggregated token usage.
 */
export async function runRSA(
  model: LanguageModel,
  messages: CoreMessage[],
  config: RSAConfig = {},
): Promise<{
  population: string[];
  usage: LanguageModelUsage;
}> {
  const {
    k,
    n,
    t,
    temperature,
    maxTokens,
    taskKind,
  } = { ...DEFAULT_RSA_CONFIG, ...config };

  // Extract the user's question from messages
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUserMessage || typeof lastUserMessage.content !== "string") {
    throw new Error("No user message found for RSA");
  }
  const question = lastUserMessage.content;

  let currentPopulation: string[] | null = null;
  let totalUsage: LanguageModelUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  for (let step = 0; step < t; step++) {
    const candidateSets = generateCandidateSets(currentPopulation, n, k);

    // Run all N inferences in parallel
    const promises = candidateSets.map(async (candidates) => {
      const prompt = candidates === null
        ? question
        : buildAggregatePrompt(question, candidates, taskKind);

      const result = await generateText({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature,
        maxTokens,
      });

      return {
        text: result.text,
        usage: result.usage,
      };
    });

    const results = await Promise.all(promises);

    // Update population
    currentPopulation = results.map((r) => r.text);

    // Aggregate usage
    for (const result of results) {
      totalUsage.promptTokens += result.usage.promptTokens;
      totalUsage.completionTokens += result.usage.completionTokens;
      totalUsage.totalTokens += result.usage.totalTokens;
    }
  }

  return {
    population: currentPopulation || [],
    usage: totalUsage,
  };
}

/**
 * Run RSA and return a single answer (random sample from final population)
 */
export async function runRSASingleAnswer(
  model: LanguageModel,
  messages: CoreMessage[],
  config: RSAConfig = {},
): Promise<{
  text: string;
  usage: LanguageModelUsage;
}> {
  const { population, usage } = await runRSA(model, messages, config);

  if (population.length === 0) {
    throw new Error("RSA produced no results");
  }

  // Random sample from final population
  const randomIdx = Math.floor(Math.random() * population.length);
  return {
    text: population[randomIdx],
    usage,
  };
}

