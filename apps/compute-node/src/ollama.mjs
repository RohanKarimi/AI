function assertMessage(message) {
  return message && typeof message === 'object' && ['system', 'user', 'assistant'].includes(message.role) && typeof message.content === 'string';
}

export async function generateWithOllama({ baseUrl, model, messages, maxTokens, signal }) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 24 || messages.some((message) => !assertMessage(message) || message.content.length > 16_000)) {
    throw new Error('Invalid encrypted chat payload.');
  }
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal,
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: { num_predict: maxTokens, temperature: 0.2 },
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama request failed (${response.status}): ${text.slice(0, 240)}`);
  }
  const payload = await response.json();
  const content = payload?.message?.content;
  if (typeof content !== 'string' || content.length === 0) throw new Error('Ollama did not return assistant content.');
  return content;
}
