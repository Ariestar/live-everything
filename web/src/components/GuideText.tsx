import { useAppStore } from '../store/useAppStore';

export function GuideText() {
  const { state, cameraReady, products, modelStatus, currentProduct } =
    useAppStore();

  const showGuide =
    state === 'Idle' || state === 'Detecting' || state === 'Matched';

  if (!showGuide || !cameraReady) return null;

  return (
    <div className="absolute bottom-12 left-0 right-0 flex justify-center z-10 pointer-events-none">
      <div className="ar-glass rounded-2xl px-7 py-3.5 max-w-md text-center">
        {modelStatus === 'loading' ? (
          <>
            <p className="text-cyan-300 text-base font-medium">
              正在加载本地识别模型…
            </p>
            <p className="text-white/45 text-xs mt-1">
              首次加载约需 5~10 秒，后续即刻启动
            </p>
          </>
        ) : modelStatus === 'error' ? (
          <p className="text-red-300 text-sm">
            模型加载失败，请检查控制台日志
          </p>
        ) : products.length === 0 ? (
          <>
            <p className="text-white/70 text-base">商品库为空</p>
            <p className="text-white/40 text-xs mt-1">
              请检查 data/knowledge-base 目录与 vite `/kb/` 路由
            </p>
          </>
        ) : state === 'Matched' && currentProduct ? (
          <>
            <p className="text-cyan-300 text-base font-medium">
              已识别 · {currentProduct.product_name}
            </p>
            <p className="text-white/60 text-xs mt-1">
              长按右侧种草码查看详情
            </p>
          </>
        ) : state === 'Detecting' ? (
          <>
            <p className="text-cyan-300 text-base font-medium">
              正在识别商品…
            </p>
            <p className="text-white/40 text-xs mt-1">保持商品稳定约 1 秒</p>
          </>
        ) : (
          <>
            <p className="text-white/80 text-base">请将商品放到镜头前</p>
            <p className="text-white/45 text-xs mt-1">
              识别成功后长按种草码展开介绍窗
            </p>
          </>
        )}
      </div>
    </div>
  );
}
