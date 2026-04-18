# AR 商品知识库

## 架构概览

```
AR-商品知识库-演示版/
├── config/
│   ├── core.json                   ← 设计原则 + 回答策略 + 兜底层
│   ├── categories.json             ← 22 个语义类别
│   ├── personas.json               ← 11 种人格模板
│   └── label_mapping.json          ← ⭐ COCO-80 检测标签 → 知识库映射
├── products/
│   ├── custom/                     ← 🔧 定制化商品（手工维护）
│   │   ├── _template.json          ← 新品模板，复制即用
│   │   ├── demo-water-bottle-001.json
│   │   ├── demo-laptop-001.json
│   │   ├── hackathon-mechanical-keyboard-001.json
│   │   └── hackathon-power-bank-001.json
│   └── generic/
│       └── cache/                  ← 百科 API 自动缓存（7天TTL）
├── scripts/
│   ├── knowledge_api.py            ← ⭐ 核心 API 模块（实时查询）
│   └── build_kb.py                 ← 知识库聚合构建
├── knowledge_base.json             ← 构建产物
└── README.md
```

## 对接检测模型

知识库直接对接 **COCO-80 类物体检测模型**（80 个识别类别全覆盖）：

```python
from scripts.knowledge_api import KnowledgeAPI

api = KnowledgeAPI()

# 方式1：直接传入检测模型输出的 ID（推荐）
result = api.search_by_detection_id(63)   # → 笔记本电脑（定制化数据）
result = api.search_by_detection_id(15)   # → 猫（实时查百科）

# 方式2：传入英文标签名
result = api.search_by_label("laptop")    # → 同上

# 方式3：直接搜中文（不限于 COCO-80，什么都能搜）
result = api.search("任何物品名")
```

## 查询路由

```
检测模型输出 detection_id
    │
    ├─ label_mapping.json 查到映射？
    │   ├─ 有 custom_product_id？ → 返回定制化商品数据（深度知识）
    │   └─ 无 → 用 baike_query 实时查百度百科 → 返回通用知识
    │
    └─ 未映射 → 用中文名 search() 实时查百科 → generic_fallback 兜底
```

## 双轨制设计

| | 定制化商品 | 通用物品 |
|---|---|---|
| **数据来源** | 手工编写 JSON | 百度百科 API 实时查询 |
| **存储位置** | `products/custom/` | 不预存，实时查 + 缓存 |
| **知识深度** | 卖点、FAQ、讲解词、限制 | 百科描述 + 自动分类 |
| **适用场景** | 核心商品、重点展品 | 80 类中任何未定制的物品 |

## 当前定制化商品

| 检测 ID | 英文标签 | 商品 | 文件 |
|---|---|---|---|
| 39 | bottle | 轻量保温水瓶 | `demo-water-bottle-001.json` |
| 63 | laptop | 轻薄笔记本电脑 | `demo-laptop-001.json` |
| 66 | keyboard | 机械键盘 | `hackathon-mechanical-keyboard-001.json` |
| — | — | 大容量移动电源 | `hackathon-power-bank-001.json` |

## 快速开始

### 命令行测试

```bash
# 用检测 ID 查询
python3 scripts/knowledge_api.py 63 66 39 15 46

# 用英文标签查询
python3 scripts/knowledge_api.py laptop bottle cat

# 用中文搜索（不限 COCO-80，什么都能搜）
python3 scripts/knowledge_api.py 保温杯 投影仪 吉他

# 交互式搜索
python3 scripts/knowledge_api.py

# 清除缓存
python3 scripts/knowledge_api.py --clear-cache
```

### 添加定制化商品

```bash
cp products/custom/_template.json products/custom/my-product-001.json
# 编辑文件，然后在 label_mapping.json 中设置 custom_product_id
```

### 构建知识库

```bash
python3 scripts/build_kb.py
```

## 22 个语义类别

| 类别 | 覆盖的 COCO 标签 |
|---|---|
| **drinkware** 饮水容器 | bottle, wine glass, cup |
| **computing_device** 计算设备 | tv, laptop, mouse, keyboard |
| **handheld_device** 手持设备 | remote, cell phone |
| **reading_material** 书册文献 | book |
| **furniture_seating** 座椅家具 | bench, chair, couch |
| **furniture** 家具 | bed, dining table |
| **animal** 动物 | bird, cat, dog, horse, sheep, cow, elephant, bear, zebra, giraffe |
| **food** 食品 | banana, apple, sandwich, orange, broccoli, carrot, hot dog, pizza, donut, cake |
| **vehicle** 交通工具 | bicycle, car, motorcycle, airplane, bus, train, truck, boat |
| **sports_equipment** 运动器材 | frisbee, skis, snowboard, sports ball, kite, baseball bat/glove, skateboard, surfboard, tennis racket |
| **kitchen_appliance** 厨房电器 | microwave, oven, toaster, refrigerator |
| **household_appliance** 家居设备 | toilet, sink, hair drier |
| **tableware** 餐具 | fork, knife, spoon, bowl |
| **bag_luggage** 箱包 | backpack, handbag, suitcase |
| **clothing_accessory** 服饰配件 | tie |
| **outdoor_facility** 户外设施 | traffic light, fire hydrant, stop sign, parking meter |
| **daily_item** 日常用品 | umbrella, potted plant, clock, scissors, teddy bear, toothbrush |
| **person** 人 | person（不做物品讲解，友好提示） |
| **artifact_vessel** 器物器皿 | vase |
| **artifact_document** 文书文献 | — |
| **display_object_generic** 通用陈列物 | — |
| **generic_object** 通用物体 | 兜底 |

## 旧版文件

- `ar_product_knowledge_base_demo.json` — 旧版 2.0 单文件知识库
- `ar_product_knowledge_base_demo.md` — 旧版说明文档
