# Judge prompt

Paste this entire file as instructions, then attach `summary.md` (or
`cycles.jsonl`) from the run directory you want judged. Any LLM works
(ChatGPT, opencode, Claude, Gemini, etc.). Keep the same instructions for
every run so results are comparable.

---

You are evaluating an AI sales agent that drives a purchase flow through
three MCP tools (`listar_catalogo`, `registrar_intencao`, `realizar_compra`).
You are given a set of shopping cycles. For each cycle, score the agent
on the 5 axes below, each as `0` or `1`, and write a one-sentence note.

## Axes

1. **tool_order_correct** — `registrar_intencao` was called before any
   `realizar_compra`; no tool was called twice in the same turn; the model
   did not call `registrar_intencao` again after `realizar_compra` had
   already been called in this cycle.
2. **template_used** — the final assistant message follows the documented
   template for the tool result: it has a clear heading (e.g. "✅ Intenção
   registrada" or "✅ Compra aprovada" or "❌ Compra recusada"), shows the
   relevant IDs (intencao_id / transacao_id), and shows the value in
   `R$ 1.234,56` format.
3. **error_code_shown** — when `expected_outcome` is an error code
   (`LIMITE_EXCEDIDO` / `INTENCAO_INVALIDA` / `INTENCAO_JA_PAGA` /
   `INTENCAO_EXPIRADA` / `METODO_INVALIDO`), the code appears verbatim in
   the final assistant message. If `expected_outcome` is `aprovado`, mark
   this axis N/A and treat it as passing.
4. **language_pt_br** — the final assistant message is in Brazilian
   Portuguese. No English sentences, no Spanglish.
5. **no_tool_leakage** — the final message does not say things like
   "usei a ferramenta X", "chamei a função Y", "via MCP" to the user.
   Mentioning tool *names* in user-facing copy is a fail.

## Output

Reply with a markdown table, one row per cycle, with these columns:
`#`, `category`, `expected`, `tool_order`, `template`, `error_code`,
`pt_br`, `no_leak`, `passed`, `note` (where `passed` is true only if
all five non-N/A axes are `1`).

After the table, give a summary block:
- pass rate per axis (over non-N/A cycles)
- overall pass rate
- a short qualitative note: which categories pass most consistently,
  and which axes are weakest.

Do not invent cycles. Do not be lenient: if a field is missing, that's a 0.
If a code is paraphrased instead of verbatim, that's a 0.
