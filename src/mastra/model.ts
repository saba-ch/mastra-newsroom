export const MODEL = "openai/gpt-6-luna";
// The planner's output shapes every downstream step and is under a thousand tokens, so it gets the stronger model.
export const PLANNER_MODEL = "openai/gpt-6-sol";
