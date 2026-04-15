/**
 * Robustly parse a JSON string that may be wrapped in markdown code blocks.
 * Gemini occasionally wraps its JSON response in ```json ... ``` even when
 * responseMimeType is set. This strips those fences before parsing.
 */
export function parseJsonRobustly(raw: string): unknown {
  const trimmed = raw.trim();

  // Try direct parse first (common case)
  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall through to cleanup attempts
  }

  // Strip markdown code fences: ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (fenceMatch) {
    return JSON.parse(fenceMatch[1].trim());
  }

  // Find the first complete JSON object or array
  const objStart = trimmed.indexOf('{');
  const arrStart = trimmed.indexOf('[');
  const start =
    objStart === -1 ? arrStart :
    arrStart === -1 ? objStart :
    Math.min(objStart, arrStart);

  if (start !== -1) {
    // Find matching close brace/bracket
    const openChar = trimmed[start];
    const closeChar = openChar === '{' ? '}' : ']';
    let depth = 0;
    let end = -1;
    for (let i = start; i < trimmed.length; i++) {
      if (trimmed[i] === openChar) depth++;
      else if (trimmed[i] === closeChar) {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end !== -1) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
  }

  // Nothing worked — throw with context
  throw new SyntaxError(`Could not parse JSON from response (first 200 chars): ${trimmed.slice(0, 200)}`);
}
