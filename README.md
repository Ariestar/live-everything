# Live Everything — AR 商品讲解系统

摄像头对准一件商品 → 本地 YOLO 实时检测 → 命中知识库后弹出 AR 卡片 → 用户语音提问 → 本地 Whisper 转写 + DeepSeek 生成回答（知识库不够时自动联网）。

整个仓库分三段：

| 目录 | 角色 | 技术栈 |
| --- | --- | --- |
| `web/` | 前端：摄像头流、YOLO 浏览器侧推理、AR 叠加、录音与问答 UI | React 18 + TypeScript + Vite + Tailwind + `@xenova/transformers`（ONNX WASM） |
| `agent/` | 后端：商品 Agent、RAG、Whisper 转写、LLM 调度、联网兜底 | Python 3.12+ / FastAPI / Chroma / openai-whisper / DeepSeek API |
| `data/knowledge-base/` | 商品知识库：`config/label_mapping.json` + `products/custom/*.json` + 通用类目 | JSON |

> 其它顶层目录：`docs/prd.md` 产品需求文档，`models/` 本地 YOLO 权重，`scripts/` 辅助脚本。

---

## 0. 先决条件

- **Node.js ≥ 18**（推荐 20）。Windows 下建议用 nvm-windows 或 Volta 安装。
- **Python 3.12 或更高**（Whisper、FastAPI 依赖）。
- **麦克风 + 摄像头**，并用 `http://localhost:*` 打开前端（非 localhost 的 IP 浏览器会禁用 `getUserMedia`）。
- 一个 **DeepSeek API Key**（[platform.deepseek.com](https://platform.deepseek.com)）。没有也能跑，只是回答会退化为"规则 + 本地模板"。

不需要系统装 `ffmpeg`：后端会自动使用 `imageio-ffmpeg` 附带的二进制解码录音。

---

## 1. 目录快览

```
live-everything/
├── agent/                     # FastAPI 后端
│   ├── .env.example           # 环境变量模板
│   ├── pyproject.toml
│   └── src/agent/
│       ├── main.py            # FastAPI 入口 / lifespan（加载 KB、预热 Whisper）
│       ├── config.py          # dotenv + 所有可调参数
│       ├── api/               # REST + WebSocket
│       └── core/              # agent_manager / rag / llm_provider / stt_provider / web_search
├── web/                       # Vite 前端
│   ├── package.json
│   ├── vite.config.ts         # /api, /ws 代理到后端
│   └── src/
│       ├── App.tsx
│       ├── hooks/useVoice.ts          # MediaRecorder + micReady
│       ├── hooks/useAgentLifecycle.ts # 商品匹配 → 创建/销毁后端 agent
│       ├── services/agentService.ts   # REST 客户端
│       ├── components/VoiceButton.tsx # 语音问答按钮
│       └── ...
└── data/knowledge-base/
    ├── config/label_mapping.json       # COCO id → 语义类目 / 定制商品
    └── products/custom/*.json          # 定制商品详情
```

---

## 2. 启动后端（agent）

### 2.1 创建 Python 虚拟环境

Windows PowerShell：

```powershell
cd live-everything\agent
py -3.13 -m venv .venv              # 或 py -3.12
.\.venv\Scripts\Activate.ps1
python -m pip install -U pip
pip install -e .
```

macOS / Linux：

```bash
cd live-everything/agent
python3.12 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -e .
```

依赖里已经包含 `openai-whisper` 和 `imageio-ffmpeg`，首次启动时 Whisper 的 `base` 模型会自动下载到用户目录（约 150 MB）。

### 2.2 配置环境变量

把 `.env.example` 复制成 `.env`，填上 DeepSeek key：

```powershell
Copy-Item .env.example .env
notepad .env
```

关键项：

```ini
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-你的key
DEEPSEEK_MODEL=deepseek-chat           # 普通 chat；想要推理链可换 deepseek-reasoner

STT_PROVIDER=whisper
WHISPER_MODEL_SIZE=base                # tiny / base / small / medium / large
WHISPER_LANGUAGE=zh                    # auto = 自动检测语种

WEB_SEARCH_ENABLED=true                # RAG 命中弱时自动联网兜底（DuckDuckGo）
```

### 2.3 启动服务

```powershell
agent-server           # 等价于 uvicorn agent.main:app --host 0.0.0.0 --port 8000
```

启动日志的关键行：

```
[agent.main] INFO: System health: { ... 'llm_healthy': True, 'stt_healthy': True, 'web_search_healthy': True }
[agent.main] INFO: STT provider warmed up
INFO:     Application startup complete.
```

随手验证：

```powershell
curl http://localhost:8000/api/health
```

---

## 3. 启动前端（web）

```powershell
cd live-everything\web
npm install
npm run dev
```

Vite 默认监听 `5173`（端口被占用时自动 +1）。浏览器打开 `http://localhost:5173`，首次使用会弹出摄像头和麦克风权限请求，**一定要允许**。

`vite.config.ts` 已经把 `/api` 和 `/ws` 透明代理到 `http://localhost:8000`；如后端换了端口或部署在别的机器，设置环境变量 `VITE_AGENT_BACKEND=http://host:port` 后重启 dev server 即可。

### 生产构建

```powershell
npm run build           # 产物进 dist/，同时把 ../models 和 ../data/knowledge-base 拷贝到 dist/
npm run preview         # 本地预览 dist
```

---

## 4. 端到端自检

1. 浏览器打开 `http://localhost:5173`，左上角状态栏应该依次显示：
   - 摄像头图标 **绿色**。
   - YOLO 模型 `加载中 → 就绪 · N 目标`。
   - 商品库 `N 件`（与 `data/knowledge-base/products/custom/` 文件数一致）。
2. 把摄像头对准 `data/knowledge-base/products/custom/` 中任意定制商品（如农夫山泉 550ml），命中后弹出 AR 面板。
3. 点击面板底部「语音提问」→ 麦克风变绿 → 说一句（例："这瓶水多少毫升？"）→ 再点一次结束，或 10 秒自动截断。
4. 后端终端应打印：
   ```
   INFO POST /api/agents HTTP/1.1 200 OK
   STT received: XXXXX bytes, mime=audio/webm;codecs=opus
   Decoded PCM: samples=48000 duration=3.00s
   Whisper primary transcription (lang=zh): '这瓶水多少毫升'
   INFO POST /api/agents/agent_xxx/audio HTTP/1.1 200 OK
   ```
5. 前端 AR 面板展示转写结果 + DeepSeek 答复。若知识库覆盖不到，答复会附加 "（来源：…）" 注明联网来源。

---

## 5. 常见问题

| 现象 | 原因 / 排查 |
| --- | --- |
| 前端提示 `语音服务未连接` 或 Vite 日志 `ECONNREFUSED` | 后端没启动 / 端口不是 8000。先 `curl /api/health`。 |
| 后端启动时 `ERROR: Package 'agent' requires a different Python: 3.9.x not in '>=3.12'` | 当前 Python 版本不符。用 3.12/3.13 重建 `.venv` 后再 `pip install -e .`。 |
| 后端日志 `FileNotFoundError: [WinError 2]` 出现在 Whisper | 系统 `ffmpeg` 缺失且 `imageio-ffmpeg` 没装。`pip install imageio-ffmpeg` 即可，后端自动检测并使用它附带的二进制。 |
| 语音按钮点击没反应 / 左上角麦克风始终灰色 | 在 `http://localhost` 或 `127.0.0.1` 下打开，不要用局域网 IP。检查浏览器地址栏左侧的权限图标是否允许了麦克风。 |
| `Whisper transcription: ''`（空结果） | 打开 `agent/.cache/failed_audio/*.webm` 听一下：若是静音，靠近麦克风重试；若 `too_small` 说明前端录得太短；把 `.env` 的 `WHISPER_MODEL_SIZE` 改成 `small` 能提升识别率。 |
| DeepSeek 429 / 401 | `.env` 里 key 错或欠费；或切换 `LLM_PROVIDER=ollama` 走本地模型。 |
| 联网兜底被 DuckDuckGo 限流 | 日志会回退到 Bing；必要时在 `.env` 里 `WEB_SEARCH_ENABLED=false` 关掉。 |

更详细的问题排查与设计背景请见 `docs/prd.md`。

---

## 6. 开发提示

- 后端默认关闭热重载；如需开发态自动重载，可在 `agent/.env` 里设 `SERVER_RELOAD=true`。改 `.env` 本身仍需手动重启。
- 前端 Vite 提供 HMR，改 `.tsx / .ts / .css` 秒级热更。
- `agent/.cache/failed_audio/` 里会留下识别失败的音频样本，定期清理即可（用 `.gitignore` 排除）。
- `data/knowledge-base/` 是唯一的商品知识源：新增定制商品只需在 `products/custom/` 下放一个 `<product_id>.json`，并在 `config/label_mapping.json` 里把对应 COCO 标签映射过去。首次启动会自动摄入；已有 `.chroma` 数据时启动会跳过重复切片，需手动调用 `/rag/ingest/reload` 才会重新入库。
