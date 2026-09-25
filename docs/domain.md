# 领域约定

记录短剧真人素材、生成片段和剪辑决定之间的依赖，支持授权与发布责任追溯。

聚合对象包括`production_project`、`source_asset`、`generated_clip`、`release_package`。事件类型包括`ASSET_DECLARED`、`CLIP_GENERATED`、`SHOT_APPROVED`、`LICENSE_EXPIRED`、`RELEASE_WITHDRAWN`。所有时间都必须携带时区，版本号从 1 开始递增，校验层不会替调用方改写输入。

## 事件载荷

- `ASSET_DECLARED`：还需包含 `rights_scope`, `content_hash`。
- `CLIP_GENERATED`：还需包含 `configuration_hash`, `source_refs`。
- `RELEASE_WITHDRAWN`：还需包含 `territory`, `reason`。

同一事件标识的幂等与冲突处理属于上层业务服务职责；交换层只负责稳定报告结构、枚举、时间、版本和必需载荷问题。
