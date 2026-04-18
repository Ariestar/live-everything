/**
 * Agent 后端 REST 客户端。
 *
 * 走 Vite `/api` 代理转发到 FastAPI（默认 http://localhost:8000）。
 * 语音链路：前端录制 webm → POST /api/agents/{id}/audio
 *            后端 Whisper 转录 + DeepSeek 答复 + 可选联网兜底
 */

export interface CreateAgentParams {
  product_id?: string;
  semantic_category_id?: string;
  object_label?: string;
  detection_id?: number;
}

export interface CreatedAgent {
  agent_id: string;
  product_id: string;
  product_name: string;
  semantic_category_id?: string;
  object_label?: string;
}

export interface AgentAudioResponse {
  agent_id: string;
  transcription: string;
  answer: string;
}

export interface AgentTextResponse {
  agent_id: string;
  answer: string;
}

const BASE = '/api';

async function handle<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Agent API ${resp.status}: ${text || resp.statusText}`);
  }
  return resp.json() as Promise<T>;
}

export async function createAgent(params: CreateAgentParams, signal?: AbortSignal): Promise<CreatedAgent> {
  const resp = await fetch(`${BASE}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  });
  return handle<CreatedAgent>(resp);
}

export async function destroyAgent(agentId: string): Promise<void> {
  await fetch(`${BASE}/agents/${encodeURIComponent(agentId)}`, {
    method: 'DELETE',
  }).catch(() => undefined);
}

export async function askAgentText(
  agentId: string,
  query: string,
  signal?: AbortSignal
): Promise<AgentTextResponse> {
  const resp = await fetch(`${BASE}/agents/${encodeURIComponent(agentId)}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal,
  });
  return handle<AgentTextResponse>(resp);
}

export async function askAgentAudio(
  agentId: string,
  audio: Blob,
  signal?: AbortSignal
): Promise<AgentAudioResponse> {
  const form = new FormData();
  // 后端 `UploadFile` 读 content_type，webm 直接交给 Whisper
  const filename = audio.type.includes('wav') ? 'audio.wav' : 'audio.webm';
  form.append('audio', audio, filename);

  const resp = await fetch(`${BASE}/agents/${encodeURIComponent(agentId)}/audio`, {
    method: 'POST',
    body: form,
    signal,
  });
  return handle<AgentAudioResponse>(resp);
}

export interface BackendHealth {
  agents: number;
  llm_provider: string;
  llm_model?: string;
  llm_healthy: boolean;
  stt_provider: string;
  stt_healthy: boolean;
  rag_enabled: boolean;
  web_search_enabled?: boolean;
  web_search_healthy?: boolean | null;
  [key: string]: unknown;
}

export async function getBackendHealth(): Promise<BackendHealth | null> {
  try {
    const resp = await fetch(`${BASE}/health`);
    if (!resp.ok) return null;
    return (await resp.json()) as BackendHealth;
  } catch {
    return null;
  }
}
