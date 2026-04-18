import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  createAgent,
  destroyAgent,
  getBackendHealth,
} from '../services/agentService';

/**
 * 把前端检测出的商品和后端 agent 生命周期绑定起来：
 *   - currentProduct 变化 → 销毁旧 agent、为新 product 创建
 *   - 组件卸载 → 销毁 agent，避免服务端泄漏
 *
 * 同时在启动时探测一次 /api/health，把 `backendReady` 写回 store。
 */
export function useAgentLifecycle() {
  const {
    currentProduct,
    currentAgentId,
    setCurrentAgentId,
    setBackendReady,
  } = useAppStore();

  // 后端健康探测（每 20s 一次）
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      const health = await getBackendHealth();
      if (cancelled) return;
      setBackendReady(!!health && health.llm_healthy !== false);
    };
    poll();
    timer = setInterval(poll, 20_000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [setBackendReady]);

  // 跟随 currentProduct 创建 agent
  useEffect(() => {
    const controller = new AbortController();
    const prevAgentId = currentAgentId;
    let newAgentId: string | null = null;

    async function sync() {
      // 没匹配到商品 → 销毁旧 agent，清掉 id
      if (!currentProduct) {
        if (prevAgentId) {
          await destroyAgent(prevAgentId);
          setCurrentAgentId(null);
        }
        return;
      }

      try {
        // 先销毁旧 agent，避免累积
        if (prevAgentId) {
          await destroyAgent(prevAgentId);
        }
        const agent = await createAgent(
          {
            product_id: currentProduct.product_id,
            object_label: currentProduct.product_name,
            semantic_category_id: currentProduct.semantic_category_id,
          },
          controller.signal
        );
        if (!controller.signal.aborted) {
          newAgentId = agent.agent_id;
          setCurrentAgentId(agent.agent_id);
          console.log(
            `[agent] created ${agent.agent_id} for ${agent.product_name || agent.product_id}`
          );
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          console.warn('[agent] create failed, voice will fall back to local QA', e);
          setCurrentAgentId(null);
        }
      }
    }

    sync();

    return () => {
      controller.abort();
      // 清理本次创建的 agent（防止 currentProduct 快速切换时残留）
      if (newAgentId) {
        destroyAgent(newAgentId);
      }
    };
    // 只跟踪 product_id 变化，其他字段变了不用重建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProduct?.product_id]);
}
