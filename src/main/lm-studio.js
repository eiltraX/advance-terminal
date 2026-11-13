'use strict';

// Fixed loopback URL: neither the renderer nor model responses can redirect
// project context to a remote service or arbitrary localhost port.
const LM_STUDIO_URL = 'http://127.0.0.1:1234/v1';
const DEFAULT_LOCAL_MODEL = 'qwen/qwen3.5-9b';

async function requestJson(pathname, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${LM_STUDIO_URL}${pathname}`, {
      ...options,
      signal: controller.signal
    });
    const body = await response.text();
    let data;
    try { data = body ? JSON.parse(body) : {}; } catch (_) { data = {}; }
    if (!response.ok) {
      const reason = typeof data?.error?.message === 'string' ? data.error.message : body;
      throw new Error(`LM Studio HTTP ${response.status}: ${String(reason || 'Unknown error').slice(0, 700)}`);
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('LM Studio request timed out. Check the local server and model.');
    }
    if (error.cause?.code === 'ECONNREFUSED' || /fetch failed|connect|ECONNREFUSED/i.test(error.message)) {
      throw new Error('Cannot connect to LM Studio at 127.0.0.1:1234. Start its Local Server and load a model.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function getLocalModels() {
  const body = await requestJson('/models', {}, 4500);
  return Array.isArray(body.data)
    ? [...new Set(body.data.map((item) => String(item?.id || '').trim()).filter(Boolean))].slice(0, 80)
    : [];
}

async function askLocalModel({ model, systemPrompt, userPrompt, maxTokens = 1400 }) {
  const requestedModel = String(model || DEFAULT_LOCAL_MODEL).trim();
  if (!requestedModel || requestedModel.length > 120) {
    throw new Error('Choose a valid LM Studio model in Settings → AI.');
  }
  const data = await requestJson('/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: requestedModel,
      messages: [
        { role: 'system', content: String(systemPrompt || '').slice(0, 5000) },
        { role: 'user', content: String(userPrompt || '').slice(0, 19000) }
      ],
      temperature: 0.2,
      max_tokens: Math.min(2200, Math.max(300, maxTokens)),
      stream: false
    })
  }, 180000);
  const content = data?.choices?.[0]?.message?.content;
  const answer = typeof content === 'string'
    ? content.trim()
    : Array.isArray(content)
      ? content.filter((part) => part?.type === 'text').map((part) => part.text || '').join('\n').trim()
      : '';
  if (!answer) {
    throw new Error('LM Studio returned no answer. Verify that the model is loaded and its context is large enough.');
  }
  return answer;
}

module.exports = { getLocalModels, askLocalModel, DEFAULT_LOCAL_MODEL };
