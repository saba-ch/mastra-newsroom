import { Classifier } from "@mastra/core/classifier";
import { createTypeSafeAi } from "@ai-sdk/typesafe-ai";

// Jev is TypeSafe's evaluation model: it answers typed questions with calibrated probabilities and writes no text.
// It replaces the planner's "is this a story?" verdict; the planner still writes the angles.
const jev = createTypeSafeAi({ apiKey: process.env.JEV_API_KEY }).evaluationModel("jev-latest");

export const isStory = new Classifier({
  id: "is-story",
  model: jev,
  questions: {
    isStory: {
      type: "boolean",
      instructions:
        "Is the topic a real public subject a daily news desk could assign a researcher to? Whether there is news about it today is checked later; accept quiet but real subjects.",
      criteria: {
        true: "A real public subject: a field, an industry, a company, a place, a public institution or service, a public event, or a person in public life. Includes small or obscure ones.",
        false: "Gibberish, random characters, placeholder text, a private or personal matter, or something about a non-public person.",
      },
    },
  },
});
