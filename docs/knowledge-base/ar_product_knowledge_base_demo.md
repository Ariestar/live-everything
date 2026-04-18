# AR 商品知识库演示版

## 文件定位

这是一份面向 `AR + 种草码 + 语音交互` 场景的富化版离线知识库。

当前桌面目录中的两份文件分别承担不同职责：

- `ar_product_knowledge_base_demo.json`
  给程序读取的结构化知识源，适合后续接本地匹配、介绍窗渲染和语音问答。
- `ar_product_knowledge_base_demo.md`
  给产品、内容、运营和演示人员审阅的说明版，帮助快速理解知识结构和内容范围。

## 这次升级做了什么

原先桌面上的版本只包含两个商品的基础字段。现在已经升级为适配当前项目的 `三层知识体系`：

1. `物体事实层`
   存当前具体物体的真实信息，例如卖点、参数、FAQ、讲解词、限制和演示话术。
2. `类别常识层`
   用于已识别但未录入专属商品时的通用回答，例如饮水容器、计算设备、书册文献、座椅家具等。
3. `人格表达层`
   只负责“怎么说”，不负责改写事实。当前采用 `物体自述型`，而且按类别分人格。

## 当前默认回答原则

- `专业事实优先`
  如果命中当前物体的专属知识，回答必须优先使用专属知识。
- `拟人化只做表达层`
  允许物体“像在说话”，但不允许因为戏剧性去编造事实。
- `任意已识别物体可拟人化`
  若没有命中专属物体，但识别到了类别，则回退到类别常识层。
- `问题类型决定拟人化强度`
  介绍类更强，参数类中等，限制类和未知类更克制。

## 当前拟人化风格

本项目当前锁定的是：

- `物体自述型`
- `按类别分人格`
- `介绍类高拟人化`
- `参数与限制类保持事实清晰`

所以你会看到类似这样的说法：

- 水瓶会说：“我是那只不想让你在忙碌里忘记补水的轻量保温水瓶。”
- 电脑会说：“我是那台更愿意陪你把工作台一起带着走的轻薄笔记本电脑。”

但当问题变成参数、限制或未知项时，语气会收回来，避免失真。

## JSON 顶层结构

### 1. `design_principles`

定义整套知识库的原则，例如：

- 优先专属事实
- 不让拟人化改写事实
- 未录入专属知识时，允许用类别常识兜底
- 兜底回答必须使用限定词

### 2. `response_policy`

定义回答链路和安全边界，包括：

- 回答优先级
- 拟人化强度规则
- 可安全使用的限定表达
- 禁止出现的错误行为

### 3. `semantic_categories`

这是类别常识层。当前已经预置以下类别：

- `drinkware` 饮水容器
- `computing_device` 计算设备
- `reading_material` 书册文献
- `furniture_seating` 座椅家具
- `handheld_device` 手持设备
- `artifact_vessel` 器物器皿
- `artifact_document` 文书文献
- `display_object_generic` 通用陈列物
- `generic_object` 通用物体兜底

每个类别都包含：

- 类别定位
- 常见角色
- 常见结构与场景
- 可安全回答的内容
- 禁止伪造的内容
- 通用模板回答

### 4. `persona_profiles`

这是人格表达层。当前每个类别都绑定了一个人格模板，例如：

- `persona_drinkware`
  贴身补水伙伴，语气亲和、有陪伴感
- `persona_computing_device`
  干练工作搭档，语气理性、自信、效率导向
- `persona_historical_object`
  时间见证者，语气克制、证据感强
- `persona_generic_object`
  谨慎自述者，只在信息不足时保守输出

每个人格都定义了：

- 语气基调
- 开场句模板
- 转场句模板
- 收尾句模板
- 明确不能说什么

### 5. `products`

这是当前物体事实层。当前已经写了两条深度定制条目：

- `demo-water-bottle-001`
- `demo-laptop-001`

每条都不再只是基础字段，而是补充了：

- `one_line_hook`
- `self_intro_short`
- `self_intro_medium`
- `story_monologue_90s`
- `visual_identity`
- `core_values`
- 更详细的 `selling_points`
- 更详细的 `specs`
- `guided_demo_script`
- `limitations`
- `care_tips`
- `common_misunderstandings`
- `question_type_answers`
- `follow_up_questions`
- 更完整的 `faq`
- `product_extension`
- `museum_extension`

### 6. `generic_fallback`

这是最后一道兜底层。

当系统只知道“这里有个物体”，但没有命中专属知识，也没有命中更细的类别时，就使用这一层，保证系统还能开口，但不会胡说。

## 已写好的深度定制内容

### 商品 1：轻量保温水瓶

当前已经写成“强拟人化 + 强事实约束”的完整条目，重点覆盖：

- 补水陪伴
- 通勤和办公场景
- 保温保冷
- 密封与装包
- 清洗便利
- 使用限制
- 常见误区

这一条不再像说明书，而更像一只会自己开口介绍自己的水瓶，但一旦提到容量、材质和限制，仍然会回到事实表达。

### 商品 2：轻薄笔记本电脑

当前已经写成“移动工作台”叙事方向，重点覆盖：

- 移动办公
- 会议与展台展示
- 文档与协作
- 屏幕、接口、重量、续航
- 适配任务
- 能力边界

它的表达更像一台干练、能做事的设备，而不是单纯堆参数。

## 这份知识库怎么接项目

### 识别成功后

1. 先拿到当前检测结果的类别或商品 ID。
2. 如果命中 `products` 中的 `product_id`，优先走专属物体知识。
3. 如果没命中具体商品，但命中了 `semantic_category_id`，走类别常识层。
4. 如果连类别都没有，则走 `generic_fallback`。

### 介绍窗展示建议

首屏建议优先取这些字段：

- `product_name`
- `tagline`
- `one_line_hook`
- `selling_points`
- `specs`
- `guided_demo_script`

### 语音问答建议

建议的问答顺序：

1. 先判断问题类型
   例如：介绍、卖点、用途、参数、对比、限制、未知
2. 若命中具体商品
   优先使用 `question_type_answers` 和 `faq`
3. 若未命中具体商品
   使用 `semantic_categories` 中的通用回答模板
4. 套用对应的 `persona_profiles`
5. 出口再做一次事实约束检查

## 后续你可以怎么扩

### 扩更多商品

建议继续沿用当前 `products` 结构，每个商品至少补齐：

- 短介绍
- 中介绍
- 90 秒讲解词
- 详细卖点
- 限制
- 常见误区
- 问题类型答案
- FAQ

### 扩更多类别

如果后面你要支持更多“任意物体都可拟人化”，优先新增：

- `bag_accessory`
- `tableware`
- `tool_object`
- `display_machine`
- `decorative_object`

### 扩博物馆场景

保留当前结构不变，只需要把物体事实层里的 `museum_extension` 填起来，例如：

- 年代
- 来源
- 材质
- 工艺
- 文化背景
- 争议与未知项
- 展签版讲解词
- 导览版讲解词

## 当前桌面文件路径

- [ar_product_knowledge_base_demo.json](/Users/apple/Desktop/AR-商品知识库-演示版/ar_product_knowledge_base_demo.json)
- [ar_product_knowledge_base_demo.md](/Users/apple/Desktop/AR-商品知识库-演示版/ar_product_knowledge_base_demo.md)

## 当前状态

当前这版已经不是“两个商品的简单说明”，而是一份可以继续扩成正式项目知识层的起点。

如果继续往下做，最直接的下一步就是：

- 再补一份 `model_class_id -> semantic_category_id -> product_id` 的映射表
- 再补一批类别条目，让“任意已识别物体都能开口”更完整
