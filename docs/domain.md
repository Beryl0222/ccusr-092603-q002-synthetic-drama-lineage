# 领域约定

记录短剧项目、角色版本、真人出演许可、素材声明、生成批次、人工筛选、镜头依赖、连续性检查、上线区域和下架义务之间的依赖，使任一画面可回放其素材来源、人工决定与有效许可。

## 聚合对象

- `production_project`：短剧项目。
- `character_version`：角色形象版本，绑定出演许可与基础素材。
- `actor_license`：真人出演许可（形象、声音、配音等授权范围与有效期）。
- `source_asset`：训练或参考素材声明；商业提示词只登记摘要，正文不进入交换层。
- `generation_batch`：一次生成请求的批次，是幂等与隔离的边界。
- `generated_clip`：生成片段（多次抽卡的单个结果）。
- `shot`：剪辑镜头，声明其引用的片段与已披露来源。
- `release_package`：某一上线区域的发布包。

## 事件

所有时间都必须携带时区，版本号从 1 开始递增，校验层不会替调用方改写输入。

- `ASSET_DECLARED`：登记素材，含 `declared_by`, `usage`(training/reference/voice/prompt), `rights_scope`, `content_hash`。
- `LICENSE_GRANTED`：登记许可，含 `license_ref`, `actor_ref`, `scope`, `valid_from`, `valid_until`。
- `LICENSE_EXPIRED`：许可到期，含 `license_ref`, `effective_from`。
- `CHARACTER_VERSION_REGISTERED`：登记角色版本，含 `character_ref`, `version_no`, `license_ref`, `base_asset_refs`。
- `BATCH_REQUESTED`：发起生成批次，含 `request_key`, `configuration_hash`, `material_digest`。
- `CLIP_GENERATED`：片段产出，含 `batch_ref`, `request_key`, `configuration_hash`, `material_digest`, `source_refs`, `prompt_digest`。
- `CLIP_REGENERATED`：片段重生成，含 `supersedes_clip_ref`, `request_key`, `configuration_hash`, `material_digest`, `reason`。
- `CLIP_CURATED`：人工筛选，含 `clip_ref`, `curator_ref`, `decision`(kept/discarded)。
- `SHOT_COMPOSED`：镜头组接，含 `clip_refs`, `editor_ref`, `disclosed_source_refs`。
- `CONTINUITY_CHECKED`：连续性检查，含 `shot_refs`, `checker_ref`, `result`(passed/failed/waived)。
- `SHOT_SUBMITTED`：镜头送审，含 `submitted_by`, `risk_level`(low/standard/high)。
- `SHOT_APPROVED`：镜头过审，含 `risk_level`, `approvals`（角色到审批人的映射）。
- `RELEASE_STARTED`：启动发布，含 `territories`, `initiated_by`。
- `TERRITORY_PACKAGED`：区域包完成，含 `territory`, `package_ref`。
- `RELEASE_WITHDRAWN`：撤回传播，含 `territory`, `reason`, `include_derivatives`。
- `TAKEDOWN_ISSUED`：登记下架义务，含 `territory`, `obligation_ref`, `due_at`。

## 业务不变量（由上层服务依据事件流保证）

1. **重生成影响范围**：`CLIP_REGENERATED` 只使引用被替换片段的镜头重新进入 `SHOT_SUBMITTED`；未引用该片段的镜头不受影响。
2. **授权到期不溯及已播**：`LICENSE_EXPIRED` 的 `effective_from` 之后不得新增依赖该许可的发布；已播版本的记录保持原样，不得篡改。
3. **生成幂等与隔离**：`request_key`、`configuration_hash`、`material_digest` 三者相同的安全重试沿用首个 `CLIP_GENERATED` 结果；`request_key` 相同但模型配置或素材摘要变化时必须生成新批次，不得复用或覆盖旧结果。
4. **审批回避与双角色确认**：`SHOT_APPROVED` 的 `approvals` 不得包含该镜头 `SHOT_COMPOSED` 的 `editor_ref`，且镜头的 `disclosed_source_refs` 必须覆盖实际引用的素材；`risk_level` 为 `high` 时 `approvals` 必须同时包含版权与内容安全两个角色的各自确认。
5. **发布恢复只补缺口**：发布进程中断后，只对缺少 `TERRITORY_PACKAGED` 的区域补齐打包，已完成区域不得重复发布。
6. **撤回幂等与衍生覆盖**：同一 `territory` 的重复 `RELEASE_WITHDRAWN` 不得触发第二次下架；`include_derivatives` 为真时必须同时覆盖衍生预告，不得遗漏。
7. **可回放解释与提示词隐藏**：查询接口依据事件链解释任一画面由哪些素材、人工决定和有效许可构成；商业提示词仅以 `prompt_digest` 参与追溯，正文对无关人员隐藏。

同一事件标识的幂等与冲突处理属于上层业务服务职责；交换层只负责稳定报告结构、枚举、时间、版本和必需载荷问题。
