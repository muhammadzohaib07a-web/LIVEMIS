/**
 * Pulls a JSON object out of a model reply.
 *
 * Groq's remaining vision model is a reasoning model: it narrates its working
 * in a <think> block and wraps the answer in a code fence, and it rejects the
 * API's strict `response_format: json_object`. So the reply has to be cleaned
 * here rather than being guaranteed by the request.
 */
export function extractJson(content: string): unknown {
  const withoutThinking = content.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const withoutFences = withoutThinking.replace(/```(?:json)?\s*|\s*```/gi, "").trim();

  try {
    return JSON.parse(withoutFences);
  } catch {
    // Fall back to the outermost {...}, in case the model added a sentence
    // either side of the object.
    const first = withoutFences.indexOf("{");
    const last = withoutFences.lastIndexOf("}");
    if (first === -1 || last <= first) {
      throw new Error("The AI reply did not contain any JSON.");
    }
    return JSON.parse(withoutFences.slice(first, last + 1));
  }
}
