#!/usr/bin/env python3
"""
通用物品知识 API 模块

运行时实时查询百度百科，不管什么物品都可以直接搜。
查询结果自动缓存到 products/generic/cache/ 避免重复请求。

─── 作为模块导入 ───
    from scripts.knowledge_api import KnowledgeAPI
    api = KnowledgeAPI()
    result = api.search("保温杯")       # 实时查询，自动缓存
    result = api.search("任何物品名")   # 什么都能搜

─── 作为命令行工具 ───
    # 交互式搜索（输入物品名即搜）
    python3 knowledge_api.py

    # 直接搜索
    python3 knowledge_api.py 保温杯
    python3 knowledge_api.py 鼠标 键盘 显示器

    # 清除缓存
    python3 knowledge_api.py --clear-cache
"""

import json
import re
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

# ─── 配置 ───────────────────────────────────────────────

BAIKE_API = "https://baike.deno.dev/item/{item_name}"
CACHE_TTL_HOURS = 24 * 7  # 缓存有效期：7 天

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
CACHE_DIR = PROJECT_ROOT / "products" / "generic" / "cache"

# 物品名 → 语义类别的关键词映射表（可扩展）
KEYWORD_TO_CATEGORY = {
    # drinkware
    "杯": "drinkware", "瓶": "drinkware", "壶": "drinkware",
    "水杯": "drinkware", "保温": "drinkware", "茶杯": "drinkware",
    # computing_device
    "电脑": "computing_device", "笔记本": "computing_device",
    "平板": "computing_device", "服务器": "computing_device",
    "显示器": "computing_device", "键盘": "computing_device",
    "鼠标": "computing_device",
    # handheld_device
    "手机": "handheld_device", "手表": "handheld_device",
    "耳机": "handheld_device", "遥控": "handheld_device",
    # reading_material
    "书": "reading_material", "册": "reading_material",
    "杂志": "reading_material", "报纸": "reading_material",
    "文献": "reading_material", "字典": "reading_material",
    # furniture_seating
    "椅": "furniture_seating", "凳": "furniture_seating",
    "沙发": "furniture_seating", "座椅": "furniture_seating",
    # artifact_vessel
    "陶": "artifact_vessel", "瓷": "artifact_vessel",
    "鼎": "artifact_vessel", "罐": "artifact_vessel",
    "碗": "artifact_vessel", "盘": "artifact_vessel",
    # artifact_document
    "卷轴": "artifact_document", "碑": "artifact_document",
    "拓片": "artifact_document",
    # 通用电子配件
    "充电": "handheld_device", "数据线": "handheld_device",
    "插线板": "generic_object", "台灯": "generic_object",
    "摄像头": "computing_device", "麦克风": "computing_device",
    "音箱": "handheld_device", "投影": "computing_device",
    "扩展坞": "computing_device",
}


# ─── 核心 API 类 ──────────────────────────────────────────


class KnowledgeAPI:
    """
    通用物品知识实时查询 API

    用法：
        api = KnowledgeAPI()

        # 方式1：直接接检测模型输出（推荐）
        result = api.search_by_detection_id(63)   # laptop
        result = api.search_by_label("laptop")    # 同上

        # 方式2：中文名搜索（任何物品都行）
        result = api.search("任何物品名")
    """

    def __init__(self, cache_dir: Path = CACHE_DIR, cache_ttl_hours: int = CACHE_TTL_HOURS):
        self.cache_dir = cache_dir
        self.cache_ttl = timedelta(hours=cache_ttl_hours)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        # 内存缓存（同一进程内不重复读磁盘）
        self._mem_cache: dict[str, dict] = {}
        # 加载标签映射和定制化商品
        self._label_map = self._load_label_mapping()
        self._custom_products = self._load_custom_products()

    # ─── 对接检测模型 ─────────────────────────────────────

    def search_by_detection_id(self, detection_id: int) -> dict | None:
        """
        直接对接检测模型输出。
        输入检测 ID（0-79），返回知识库条目。
        如果有定制化商品则返回定制数据，否则实时查百科。
        """
        label_info = self._label_map.get(str(detection_id))
        if not label_info:
            return None
        return self._resolve_label(label_info)

    def search_by_label(self, en_label: str) -> dict | None:
        """
        通过英文标签名查询（如 "laptop", "bottle"）。
        """
        for lid, info in self._label_map.items():
            if info.get("en") == en_label:
                return self._resolve_label(info)
        return None

    def _resolve_label(self, label_info: dict) -> dict | None:
        """
        核心路由：定制商品 > 百科 API > 类别兜底
        """
        custom_id = label_info.get("custom_product_id")
        if custom_id and custom_id in self._custom_products:
            return self._custom_products[custom_id]

        # 用 baike_query（如有）查百科，否则用中文名
        query = label_info.get("baike_query") or label_info.get("zh", "")
        result = self.search(query)
        if result:
            # 注入检测元信息
            result["_detection_label"] = label_info.get("en", "")
            result["_detection_zh"] = label_info.get("zh", "")
            # 标签映射的类别比关键词猜测更准确，始终覆盖
            mapped_cat = label_info.get("semantic_category_id")
            if mapped_cat:
                result["semantic_category_id"] = mapped_cat
        return result

    def _load_label_mapping(self) -> dict:
        path = PROJECT_ROOT / "config" / "label_mapping.json"
        if not path.exists():
            return {}
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("labels", {})

    def _load_custom_products(self) -> dict:
        """加载所有定制化商品，按 product_id 索引"""
        products = {}
        custom_dir = PROJECT_ROOT / "products" / "custom"
        if not custom_dir.exists():
            return products
        for f in custom_dir.glob("*.json"):
            if f.name.startswith("_"):
                continue
            try:
                with open(f, "r", encoding="utf-8") as fp:
                    product = json.load(fp)
                pid = product.get("product_id", "")
                if pid:
                    products[pid] = product
            except (json.JSONDecodeError, OSError):
                pass
        return products

    def search(self, item_name: str) -> dict | None:
        """
        搜索任意物品，返回知识库格式的条目。
        优先读缓存，缓存过期或不存在则实时请求 API。
        """
        item_name = item_name.strip()
        if not item_name:
            return None

        # 1. 内存缓存
        if item_name in self._mem_cache:
            return self._mem_cache[item_name]

        # 2. 磁盘缓存
        cached = self._read_cache(item_name)
        if cached:
            self._mem_cache[item_name] = cached
            return cached

        # 3. 实时请求 API
        result = self._fetch_and_build(item_name)
        if result:
            self._write_cache(item_name, result)
            self._mem_cache[item_name] = result
        return result

    def search_batch(self, item_names: list[str], delay: float = 0.3) -> dict[str, dict | None]:
        """批量搜索，返回 {物品名: 结果} 字典"""
        results = {}
        for name in item_names:
            results[name] = self.search(name)
            time.sleep(delay)
        return results

    def clear_cache(self):
        """清除全部磁盘缓存"""
        if self.cache_dir.exists():
            for f in self.cache_dir.glob("*.json"):
                f.unlink()
        self._mem_cache.clear()

    # ─── 内部方法 ─────────────────────────────────────────

    def _cache_path(self, item_name: str) -> Path:
        safe = re.sub(r"[/\\:*?\"<>|]", "_", item_name)
        return self.cache_dir / f"{safe}.json"

    def _read_cache(self, item_name: str) -> dict | None:
        path = self._cache_path(item_name)
        if not path.exists():
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            # 检查 TTL
            fetched_at = data.get("fetched_at", "")
            if fetched_at:
                fetch_time = datetime.strptime(fetched_at, "%Y-%m-%d %H:%M:%S")
                if datetime.now() - fetch_time > self.cache_ttl:
                    return None  # 过期
            return data
        except (json.JSONDecodeError, OSError, ValueError):
            return None

    def _write_cache(self, item_name: str, data: dict):
        path = self._cache_path(item_name)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _fetch_and_build(self, item_name: str) -> dict | None:
        """请求百度百科 API 并转为知识库条目"""
        url = BAIKE_API.format(item_name=quote(item_name))
        req = Request(url, headers={"User-Agent": "AR-KB-Fetcher/1.0"})
        try:
            with urlopen(req, timeout=15) as resp:
                raw = json.loads(resp.read().decode("utf-8"))
                if raw.get("status") != 200 or not raw.get("data"):
                    return None
                return self._build_entry(item_name, raw["data"])
        except (URLError, HTTPError, json.JSONDecodeError) as e:
            print(f"[KnowledgeAPI] 请求失败 '{item_name}': {e}", file=sys.stderr)
            return None

    def _build_entry(self, item_name: str, baike_data: dict) -> dict:
        """将百度百科原始数据转为知识库标准格式"""
        description = baike_data.get("description", "")
        category_id = _guess_category(item_name, description)
        short_desc = _truncate(description, 150)
        medium_desc = _truncate(description, 300)

        return {
            "product_id": f"generic-{item_name}",
            "product_name": baike_data.get("itemName", item_name),
            "source": "baike",
            "source_url": baike_data.get("link", ""),
            "source_update_time": baike_data.get("updateTime", ""),
            "fetched_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "identity_level": "generic_api_fetched",
            "semantic_category_id": category_id,
            "cover_image_url": baike_data.get("cover", ""),
            "baike_description": description,
            "generated_knowledge": {
                "short_intro": f"根据公开资料，{short_desc}" if short_desc else "",
                "medium_intro": medium_desc,
                "generic_answer_templates": {
                    "intro": f"根据公开资料，{short_desc}" if short_desc else f"我是{item_name}，但当前资料有限。",
                    "use_case": _extract_use_case(description, item_name),
                    "spec_unknown": f"我能确认自己是{item_name}，但当前本地资料没有给出更具体的型号或参数事实。",
                    "caution": f"以上信息来自公开百科资料，具体到当前这件{item_name}，仍需以专属知识为准。",
                },
            },
            "status": "auto_generated",
        }


# ─── 工具函数 ─────────────────────────────────────────────


def _guess_category(item_name: str, description: str = "") -> str:
    text = item_name + description
    for keyword, cat_id in KEYWORD_TO_CATEGORY.items():
        if keyword in text:
            return cat_id
    return "generic_object"


def _truncate(desc: str, max_chars: int = 300) -> str:
    if len(desc) <= max_chars:
        return desc
    truncated = desc[:max_chars]
    last_period = max(truncated.rfind("。"), truncated.rfind("；"))
    if last_period > max_chars // 2:
        return truncated[: last_period + 1]
    return truncated + "……"


def _extract_use_case(description: str, item_name: str) -> str:
    use_keywords = ["用于", "用途", "功能", "作用", "适用", "可以", "常见于", "常用"]
    sentences = re.split(r"[。；！]", description)
    relevant = [s.strip() for s in sentences if any(k in s for k in use_keywords)]
    if relevant:
        return "。".join(relevant[:2]) + "。"
    return f"关于{item_name}的具体用途，建议参考专属知识条目获取更详细信息。"


# ─── CLI 入口 ─────────────────────────────────────────────


def main():
    api = KnowledgeAPI()

    # --clear-cache
    if "--clear-cache" in sys.argv:
        api.clear_cache()
        print("✅ 缓存已清除")
        return

    # 有参数 → 直接搜索
    items = [a for a in sys.argv[1:] if not a.startswith("-")]
    if items:
        for name in items:
            # 如果是纯数字，当作 detection_id
            if name.isdigit():
                print(f"\n🔍 检测 ID: {name}")
                result = api.search_by_detection_id(int(name))
            elif name.isascii() and not name.isdigit():
                print(f"\n🔍 英文标签: {name}")
                result = api.search_by_label(name)
            else:
                print(f"\n🔍 搜索: {name}")
                result = api.search(name)

            if result:
                pname = result.get('product_name', result.get('_detection_zh', name))
                cat = result.get('semantic_category_id', '?')
                level = result.get('identity_level', 'generic_api_fetched')
                print(f"   ✅ {pname}（{cat}）[{level}]")
                gk = result.get('generated_knowledge', {})
                templates = gk.get('generic_answer_templates', {})
                intro = templates.get('intro', result.get('tagline', ''))
                if intro:
                    print(f"   📝 {intro[:120]}")
            else:
                print(f"   ❌ 未找到")
            time.sleep(0.3)
        return

    # 无参数 → 交互式搜索
    print("🔍 AR 知识库 — 物品实时搜索")
    print("   支持输入: 中文物品名 / 英文标签(laptop) / 检测ID(63)")
    print("   输入 q 退出\n")
    while True:
        try:
            query = input("搜索: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n👋 再见")
            break
        if not query or query.lower() == "q":
            break

        # 自动判断输入类型
        if query.isdigit():
            result = api.search_by_detection_id(int(query))
        elif query.isascii():
            result = api.search_by_label(query)
        else:
            result = api.search(query)

        if result:
            pname = result.get('product_name', query)
            cat = result.get('semantic_category_id', '?')
            level = result.get('identity_level', 'generic_api_fetched')
            print(f"  ✅ {pname}（{cat}）[{level}]")
            gk = result.get('generated_knowledge', {})
            if gk:
                print(f"  📝 {gk.get('short_intro', '')[:150]}")
            elif result.get('tagline'):
                print(f"  � {result['tagline']}")
            source = result.get('source_url', '')
            if source:
                print(f"  🔗 {source}")
        else:
            print(f"  ❌ 未找到「{query}」")
        print()


if __name__ == "__main__":
    main()
