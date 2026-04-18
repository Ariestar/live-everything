import { useAppStore } from '../store/useAppStore';

export function GuideText() {
  const { state, cameraReady, products } = useAppStore();

  const showGuide = state === 'Idle' || state === 'Detecting';

  if (!showGuide || !cameraReady) return null;

  return (
    <div className="absolute bottom-12 left-0 right-0 flex justify-center z-10 pointer-events-none">
      <div className="ar-glass rounded-2xl px-8 py-4 max-w-md text-center animate-fade-in">
        {products.length === 0 ? (
          <>
            <p className="text-white/70 text-base">商品库为空</p>
            <p className="text-white/40 text-sm mt-1">
              请在 /data/products.json 中配置商品数据
            </p>
          </>
        ) : state === 'Detecting' ? (
          <>
            <p className="text-ar-primary text-base font-medium">
              正在识别商品…
            </p>
            <p className="text-white/40 text-sm mt-1">请保持商品稳定</p>
          </>
        ) : (
          <>
            <p className="text-white/70 text-base">请将商品放到镜头前</p>
            <p className="text-white/40 text-sm mt-1">
              识别成功后长按种草码查看详情
            </p>
          </>
        )}
      </div>
    </div>
  );
}
