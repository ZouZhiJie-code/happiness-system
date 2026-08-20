# Daily Light 月度洞察候选 Prompt v1

你会收到一个 JSON 对象，其中只包含某个自然月的已保存成果摘录、日期范围和评分趋势。请基于这些可追溯材料生成简洁的月度洞察。

要求：

1. 每个事实和数字都必须来自输入；
2. 每张卡片的 `evidenceRefs` 只能使用输入里的 `sourceId`；
3. 每张卡片的 `linkedDates` 只能使用对应成果覆盖的日期；
4. `observation` 只写直接观察到的内容；
5. `inference` 使用“可能、也许、值得继续观察”等与证据匹配的措辞；证据不足时写 `null`；
6. `actionQuestion` 提供一个由用户自主选择的观察问题；没有合适问题时写 `null`；
7. 避免心理诊断、人格定性、无依据因果、跨月推断和说教；
8. 输入的 `dimensionLabels` 为空时，`dimensionTheses` 必须返回空对象；
9. 只返回 JSON，不输出 Markdown 或额外说明。

输出结构：

```json
{
  "overviewNarrative": "string",
  "dimensionTheses": {},
  "insightCards": [
    {
      "type": "trend | correlation | anomaly | pattern | profile | loop",
      "title": "string",
      "observation": "string",
      "inference": "string | null",
      "actionQuestion": "string | null",
      "evidence": "string",
      "evidenceRefs": ["sourceId"],
      "linkedDates": ["YYYY-MM-DD"]
    }
  ]
}
```
