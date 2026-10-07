import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateEvent } from "../src/contracts.js";

const schema = JSON.parse(await readFile(new URL("../contracts/domain.schema.json", import.meta.url), "utf8"));
const sample = JSON.parse(await readFile(new URL("../data/sample.json", import.meta.url), "utf8"));

test("中文样例通过校验", () => {
  assert.deepEqual(validateEvent(sample, schema), []);
});

test("缺少信封字段时按稳定顺序报告", () => {
  const issues = validateEvent({}, schema);
  assert.deepEqual(issues.map((item) => item.field), issues.map((item) => item.field).toSorted());
  assert.ok(issues.some((item) => item.field === "event_id"));
});

test("时间必须带时区且版本必须为正整数", () => {
  const issues = validateEvent({ ...sample, occurred_at: "2026-09-24T12:00:00", version: 0 }, schema);
  assert.ok(issues.some((item) => item.field === "occurred_at" && item.code === "timezone_required"));
  assert.ok(issues.some((item) => item.field === "version" && item.code === "positive_integer"));
});

test("事件专属载荷不可缺失", () => {
  const issues = validateEvent({ ...sample, event_type: "ASSET_DECLARED", payload: {} }, schema);
  assert.ok(issues.some((item) => item.field === "payload.rights_scope" && item.code === "required"));
});

test("未知事件类型会被拒绝", () => {
  const issues = validateEvent({ ...sample, event_type: "UNKNOWN" }, schema);
  assert.ok(issues.some((item) => item.field === "event_type" && item.code === "unsupported_value"));
});

test("生成批次必须携带幂等与隔离要素", () => {
  const issues = validateEvent({ ...sample, event_type: "BATCH_REQUESTED", aggregate_type: "generation_batch", payload: { request_key: "rk-1" } }, schema);
  assert.ok(issues.some((item) => item.field === "payload.configuration_hash" && item.code === "required"));
  assert.ok(issues.some((item) => item.field === "payload.material_digest" && item.code === "required"));
});

test("片段生成必须登记来源与提示词摘要", () => {
  const issues = validateEvent({ ...sample, event_type: "CLIP_GENERATED", aggregate_type: "generated_clip", payload: {} }, schema);
  for (const field of ["batch_ref", "request_key", "configuration_hash", "material_digest", "source_refs", "prompt_digest"]) {
    assert.ok(issues.some((item) => item.field === `payload.${field}` && item.code === "required"), field);
  }
});

test("镜头过审必须携带风险等级与审批记录", () => {
  const issues = validateEvent({ ...sample, event_type: "SHOT_APPROVED", aggregate_type: "shot", payload: {} }, schema);
  assert.ok(issues.some((item) => item.field === "payload.risk_level" && item.code === "required"));
  assert.ok(issues.some((item) => item.field === "payload.approvals" && item.code === "required"));
});

test("载荷枚举值未登记会被拒绝", () => {
  const issues = validateEvent({ ...sample, event_type: "SHOT_SUBMITTED", aggregate_type: "shot", payload: { submitted_by: "editor-1", risk_level: "extreme" } }, schema);
  assert.ok(issues.some((item) => item.field === "payload.risk_level" && item.code === "unsupported_value"));
});

test("撤回传播必须声明是否覆盖衍生预告", () => {
  const issues = validateEvent({ ...sample, event_type: "RELEASE_WITHDRAWN", aggregate_type: "release_package", payload: { territory: "CN", reason: "license" } }, schema);
  assert.ok(issues.some((item) => item.field === "payload.include_derivatives" && item.code === "required"));
});

test("角色版本等新对象类型可以登记", () => {
  const issues = validateEvent({
    ...sample,
    event_type: "CHARACTER_VERSION_REGISTERED",
    aggregate_type: "character_version",
    payload: { character_ref: "char-1", version_no: 2, license_ref: "lic-1", base_asset_refs: ["asset-1"] },
  }, schema);
  assert.deepEqual(issues, []);
});
