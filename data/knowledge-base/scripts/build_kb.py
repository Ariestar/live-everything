#!/usr/bin/env python3
"""
知识库聚合构建脚本

将配置文件和定制化商品合并为 knowledge_base.json。
通用物品不再预打包，运行时通过 KnowledgeAPI 实时查询。

使用方式：
  python3 build_kb.py                  # 输出到 ../knowledge_base.json
  python3 build_kb.py -o output.json   # 指定输出路径
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent


def load_json(path: Path) -> dict | list:
    """加载 JSON 文件"""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def collect_products(directory: Path) -> list:
    """收集目录下所有产品 JSON（跳过 _template.json）"""
    products = []
    if not directory.exists():
        return products
    for f in sorted(directory.glob("*.json")):
        if f.name.startswith("_"):
            continue
        try:
            product = load_json(f)
            product["_source_file"] = str(f.relative_to(PROJECT_ROOT))
            products.append(product)
        except (json.JSONDecodeError, OSError) as e:
            print(f"  ⚠ 跳过无效文件 {f.name}: {e}", file=sys.stderr)
    return products


def build():
    parser = argparse.ArgumentParser(description="聚合构建 AR 知识库")
    parser.add_argument(
        "-o", "--output",
        default=str(PROJECT_ROOT / "knowledge_base.json"),
        help="输出文件路径（默认: knowledge_base.json）"
    )
    args = parser.parse_args()

    print("🔨 AR 知识库聚合构建")
    print(f"   项目根目录: {PROJECT_ROOT}\n")

    # 加载配置
    core = load_json(PROJECT_ROOT / "config" / "core.json")
    categories = load_json(PROJECT_ROOT / "config" / "categories.json")
    personas = load_json(PROJECT_ROOT / "config" / "personas.json")

    # 收集定制化产品
    custom_products = collect_products(PROJECT_ROOT / "products" / "custom")

    print(f"  📁 配置文件: core.json, categories.json, personas.json")
    print(f"  📦 定制化商品: {len(custom_products)} 条")
    print(f"  🌐 通用物品: 运行时通过 KnowledgeAPI 实时查询（不预打包）")

    # 组装
    kb = {
        "knowledge_base_id": core.get("knowledge_base_id", "ar-product-guide-rich-kb"),
        "schema_version": core.get("schema_version", "3.0"),
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "mode": core.get("mode", "offline-local-kb"),
        "purpose": core.get("purpose", ""),
        "design_principles": core.get("design_principles", []),
        "response_policy": core.get("response_policy", {}),
        "semantic_categories": categories.get("semantic_categories", []),
        "persona_profiles": personas.get("persona_profiles", []),
        "products": {
            "custom": custom_products,
        },
        "generic_api": {
            "enabled": True,
            "provider": "baike",
            "endpoint": "https://baike.deno.dev/item/{item_name}",
            "description": "通用物品不预下载，运行时识别到未定制物品后，调用 KnowledgeAPI.search(物品名) 实时查询百度百科，结果自动缓存 7 天。",
            "cache_dir": "products/generic/cache/",
            "cache_ttl_hours": 168,
            "usage": "from scripts.knowledge_api import KnowledgeAPI; api = KnowledgeAPI(); result = api.search('任何物品名')",
        },
        "generic_fallback": core.get("generic_fallback", {}),
        "build_info": {
            "custom_count": len(custom_products),
            "generic_mode": "live_api",
            "built_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        },
    }

    # 写出
    output_path = Path(args.output)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(kb, f, ensure_ascii=False, indent=2)

    size_kb = output_path.stat().st_size / 1024
    print(f"\n  ✅ 已输出: {output_path} ({size_kb:.1f} KB)")
    print(f"  📊 定制化商品 {len(custom_products)} 条 + 通用物品实时 API")


if __name__ == "__main__":
    build()
