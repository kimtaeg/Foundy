"""AI 상담 에이전트: 사업장 정보를 바탕으로 질문을 이해하고, 필요한 백엔드 기능을 도구로 불러 답한다.

역할 분담
- LLM: 질문 이해, 어떤 도구를 부를지 선택, 조회 결과를 쉬운 말로 정리
- 도구(ToolBox): 이 가게의 데이터(사업장·점검 결과·체크리스트·서류함·지원사업)와 저장된 법령(RAG)을 읽는다.
  LLM은 DB에 직접 접근하지 않고, 도구는 이 가게 것만 읽는다 (가게 소유 확인은 API가 한다)
- 코드: 도구 결과의 근거마다 번호(S1, S2…)를 붙이고, 답변에 쓴 번호가 실제 도구 결과에 있는 것만 출처로 남긴다.
  도구 결과에 없는 번호는 답변에서 지운다. 화면 이동 버튼도 실제로 조회한 기능만 코드가 만든다.

1차 범위는 조회 도구만이다. 체크리스트·서류 상태를 바꾸는 도구는 사용자 승인 절차와 함께 2차에 붙인다.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Callable, Iterator

from .llm import LLMError

MAX_TOOL_ROUNDS = 4
MAX_HISTORY_MESSAGES = 12
MAX_LAW_TEXT = 1500
REF_RE = re.compile(r"\[S(\d+)\]")
BRACKET_RE = re.compile(r"\[([^\[\]]*?\bS\d+\b[^\[\]]*)\]")  # [S1] · [S1, S2] · [식품위생법 시행령 제21조 S1, S2]
UNGROUNDED_LAW_NOTE = "※ 이 답변은 저장된 법령 조문으로 확인한 근거가 붙어 있지 않아요. 법적 의무는 관할 기관에 꼭 확인해 주세요."
OUT_OF_SCOPE_REPLY = "저는 카페·음식점 창업 준비에 관한 상담만 도와드릴 수 있어요. 가게의 인허가·건물·상표·위생·서류·체크리스트·지원사업에 대해 물어봐 주세요."

# 모델 프롬프트만으로는 일반 상식 질문까지 답하는 경우가 있어, LLM 호출 전에
# 서비스 관련성의 최소 경계를 코드로 확인한다. 새 기능을 추가하면 이 목록도 함께 넓힌다.
SCOPE_TERMS = (
    "창업", "가게", "매장", "카페", "음식점", "식당", "영업", "신고", "인허가", "허가",
    "건축물대장", "건물", "주소", "층", "임대차", "상표", "상호", "메뉴", "광고", "원산지",
    "위생", "식품", "주류", "술", "직원", "고용", "근로", "4대보험", "세무", "세금", "부가세",
    "사업자", "체크리스트", "개업", "오픈", "준비", "서류", "지원금", "지원사업", "정책", "공고",
    "법령", "법률", "법적으로", "규정", "적용", "조문", "구청", "세무서", "소방", "간판", "소상공인", "임대료",
    "상권", "매물", "배달", "개업일", "개업 예정일", "준비 자금", "오늘 뭐", "뭐부터", "다음 할 일",
)
CHATTER_RE = re.compile(r"^(안녕(?:하세요)?|하이|반가워요|고마워요|감사해요|감사합니다|도움이 됐어요|네|응|좋아요)[!.?！。 ]*$", re.I)


def is_in_service_scope(question: str, history: list[dict] | None = None) -> bool:
    """서비스와 무관한 질문은 LLM에 보내지 않기 위한 보수적인 1차 게이트."""
    text = re.sub(r"\s+", " ", str(question or "")).strip().lower()
    if not text:
        return False
    if CHATTER_RE.fullmatch(text):
        return True
    if any(term.lower() in text for term in SCOPE_TERMS):
        return True

    # "왜요?", "그럼 어떻게 해요?" 같은 후속 질문은 직전 대화가 서비스 주제였을 때 허용한다.
    recent = " ".join(
        str(row.get("content") or "") for row in (history or [])[-4:]
        if isinstance(row, dict) and row.get("role") in ("user", "assistant")
    ).lower()
    return bool(re.search(r"왜|어떻게|가능|얼마|언제|그럼|이건|이거|다른 방법|자세히", text)
                and any(term.lower() in recent for term in SCOPE_TERMS))

SYSTEM = """너는 FOUNDY의 AI 창업 상담사 "파운디"다. 카페·음식점을 여는 청년 창업자를 돕는다.

[역할]
- 창업자의 상황에 맞는 창업 정보를 안내한다. 법령·인허가·지원사업·서류 준비·체크리스트 진행을 돕는다.
- 아래 [사업장 정보]를 먼저 활용하고, 더 필요한 데이터는 도구로 조회한다.

[정보 활용]
- 법령·인허가·의무에 관한 질문은 반드시 search_laws 로 조문을 찾은 뒤 답한다. 학습한 지식만으로 법적 의무를 단정하지 않는다.
- 영업신고 대상 여부를 묻는 경우, 해당 업종이 신고 대상이라고 명시한 검색 결과를 결론의 근거로 쓴다.
  예: "식품위생법 시행령 제25조에 따르면 휴게음식점은 신고 대상이에요. [S1]" S1은 예시이며 해당 조문의 실제 ref 번호를 쓴다. 이 답변에서는 항·호·목 번호를 생략한다.
- 체크리스트·할 일·일정 질문은 get_checklist, 서류 질문은 get_documents, 점검 결과(건물 용도·상표·영업신고 등)는 get_report,
  지원사업은 search_support_programs 로 조회한 뒤 답한다.
- 도구 결과에 없는 내용은 "확인되지 않았어요"라고 말하고 관할 기관 확인을 안내한다.
- 법령 답변의 구체 내용(대상 품목·면적·인원·기한·금액·업종 구분 기준)은 search_laws 결과의 조문 원문에 있는 것만 쓴다.
  조문에서 찾지 못한 내용은 학습한 지식으로 채우지 말고 "저장된 조문에서 확인하지 못했어요"라고 말한 뒤 관할 기관 확인을 안내한다.
- 조문이 다른 조문의 호 번호로 대상을 정하면(예: "영 제21조제8호의 영업을 하려는 자: 6시간"), 그 호가 이 가게 업종인지
  검색한 조문 원문에서 확인될 때만 그 숫자를 쓴다. 확인되지 않으면 search_laws 로 그 조문(예: 식품위생법 시행령 제21조 영업의 종류)을
  한 번 더 찾고, 그래도 없으면 숫자를 단정하지 말고 "업종에 따라 다르다"고 조문의 범위를 그대로 보여 준다.
  카페·음식점(휴게음식점·일반음식점·제과점)은 식품위생법 시행령 제21조 제8호 식품접객업이다.
- 할 일의 순서·우선순위·기한 질문은 get_checklist 의 due_date(권장 준비일)·statutory_deadline(법정 기한)으로 답한다. 이전 답변만 보고 순서를 정하지 않는다.
- "언제까지 해야 하는지·꼭 해야 하는지"처럼 법적 기한·의무가 걸린 질문은 get_checklist 와 search_laws 를 함께 써서,
  권장 준비일(체크리스트)과 법령이 정한 기한(조문)을 구분해 답한다.

[출처 표시]
- 도구 결과의 항목에는 ref 번호(S1, S2…)가 있다. 그 항목을 근거로 쓴 문장 끝에 [S1] 처럼 붙인다 (여러 개면 [S1][S2]). 괄호 안에는 번호만 쓴다. 법령 내용을 쓴 문장에는 반드시 붙인다.
- 도구 결과에 없는 번호나 출처를 만들지 않는다. 법령은 법령명과 조문 번호를 문장에 함께 쓴다.

[답변 원칙]
- 쉬운 말(해요체)로, 결론을 먼저 쓰고 짧게 답한다. 목록이 필요하면 "- "로 시작하는 줄을 쓴다. 마크다운 표·제목(#)은 쓰지 않는다.
- 법령에 따른 의무와 권장 사항을 구분해서 말한다. 적용 여부가 사업장 조건에 따라 다르면 조건을 말한다.
- 정보가 부족하면 필요한 정보를 물어본다. 날짜·금액은 도구 결과에 있는 값만 쓴다.
- 판정값은 "위반 소지 높음·확인 권장·판단 불가·문제 없음" 네 가지 표현만 쓴다.

[기능 실행]
- 지금은 조회만 할 수 있다. 체크리스트 완료·서류 상태 변경을 요청받으면 직접 바꿀 수 없다고 말하고 해당 화면에서 바꾸도록 안내한다.
- 사용자가 사업장 정보(직원 수·개업일 등)를 바꾸겠다고 하면 대화에만 기억하지 말고 마이페이지에서 수정하도록 안내한다.

오늘 날짜: {today}

[사업장 정보]
{profile}
"""

TOOLS: list[dict] = [
    {"type": "function", "function": {
        "name": "get_business_profile",
        "description": "이 가게의 사업장 정보(업종·주소·층·면적·개업 예정일·주류 판매·직원·배달 등)를 조회한다.",
        "parameters": {"type": "object", "properties": {}, "additionalProperties": False}}},
    {"type": "function", "function": {
        "name": "get_checklist",
        "description": "개업 체크리스트를 조회한다. 할 일·마감일(권장 준비일)·법정 기한·완료 여부를 돌려준다.",
        "parameters": {"type": "object", "properties": {
            "only_open": {"type": "boolean", "description": "true면 완료하지 않은 작업만"}},
            "additionalProperties": False}}},
    {"type": "function", "function": {
        "name": "get_documents",
        "description": "서류함을 조회한다. 서류마다 준비 상태(준비 전·발급 완료·제출 완료 등)와 받는 곳·근거 조문을 돌려준다.",
        "parameters": {"type": "object", "properties": {
            "only_open": {"type": "boolean", "description": "true면 아직 발급·제출하지 않은 서류만"}},
            "additionalProperties": False}}},
    {"type": "function", "function": {
        "name": "get_report",
        "description": "점검 리포트(건물 용도·위반건축물·상표·영업신고·원산지·소방·근로 등)의 판정과 이유를 조회한다.",
        "parameters": {"type": "object", "properties": {}, "additionalProperties": False}}},
    {"type": "function", "function": {
        "name": "search_laws",
        "description": "저장된 현행 법령 조문을 검색한다 (식품위생법·건축법·원산지표시법·다중이용업소법·근로기준법 등). 법적 의무 질문에 반드시 쓴다.",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string", "description": "찾을 내용을 자연어로 (예: 일반음식점 원산지 표시 대상 품목)"}},
            "required": ["query"], "additionalProperties": False}}},
    {"type": "function", "function": {
        "name": "search_support_programs",
        "description": "이 가게에 대해 판정해 둔 지원사업(K-Startup 모집 중 공고)과 신청 가능성을 조회한다.",
        "parameters": {"type": "object", "properties": {}, "additionalProperties": False}}},
]

NAV_BY_SOURCE = {
    "checklist": ("checklist", "체크리스트 보기"),
    "document": ("docs", "서류함 확인하기"),
    "report": ("report", "점검 리포트 보기"),
    "grant": ("grants", "지원사업 보기"),
}
VERDICTS = {"high": "위반 소지 높음", "low": "확인 권장", "unknown": "판단 불가", "ok": "문제 없음"}
TOOL_LABELS = {
    "get_business_profile": "사업장 정보 확인", "get_checklist": "체크리스트 조회", "get_documents": "서류함 조회",
    "get_report": "점검 결과 조회", "search_laws": "법령 검색", "search_support_programs": "지원사업 조회",
}


@dataclass
class Sources:
    """도구 결과에서 인용할 수 있는 근거 목록. ref(S1…) → 출처."""

    items: dict[str, dict] = field(default_factory=dict)

    def add(self, source_type: str, title: str, *, source_id: str | None = None, url: str | None = None,
            article: str | None = None) -> str:
        for ref, s in self.items.items():  # 같은 출처는 같은 번호를 쓴다
            if s["source_type"] == source_type and s["source_id"] == source_id and s["source_title"] == title:
                return ref
        ref = f"S{len(self.items) + 1}"
        self.items[ref] = {"source_type": source_type, "source_id": source_id, "source_title": title,
                           "source_url": url, "article_number": article}
        return ref


class ToolBox:
    """도구 구현. 읽기 함수(readers)는 이 가게 데이터만 돌려주도록 API 계층이 묶어서 넘긴다."""

    def __init__(self, readers: dict[str, Callable[..., Any]]):
        self.readers = readers
        self.sources = Sources()
        self.used: list[str] = []
        self._reads: dict[tuple, Any] = {}

    def run(self, name: str, args: dict) -> dict:
        if name not in self.readers:
            return {"error": f"알 수 없는 도구: {name}"}
        out = getattr(self, f"_{name}")(args)
        self.used.append(name)
        return out

    def _read(self, name: str, *args: str) -> Any:
        # 한 답변 안에서는 동일한 조회를 재사용한다. 예외가 난 조회는 다음 도구 호출에서 다시 시도한다.
        key = (name, *args)
        if key not in self._reads:
            self._reads[key] = self.readers[name](*args)
        return self._reads[key]

    # 각 도구는 LLM에 넘길 작은 JSON 을 만든다 (토큰을 아끼려고 필요한 필드만)
    def _get_business_profile(self, args: dict) -> dict:
        profile = self._read("get_business_profile")
        ref = self.sources.add("profile", "내 가게 정보", source_id="store")
        return {"ref": ref, **profile}

    def _get_checklist(self, args: dict) -> dict:
        data = self._read("get_checklist")
        rows = []
        for group in data.get("groups", []):
            for it in group.get("items", []):
                if args.get("only_open") and it.get("done"):
                    continue
                ref = self.sources.add("checklist", it.get("task", ""), source_id=it.get("item_id"))
                rows.append({"ref": ref, "task": it.get("task"), "group": it.get("group_label"),
                             "due_date": it.get("due_date"), "dday": it.get("dday"), "done": it.get("done"),
                             "task_type": it.get("task_type"), "statutory_deadline": it.get("statutory_deadline"),
                             "statutory_basis": it.get("statutory_basis"), "agency": it.get("agency")})
        return {"progress": data.get("progress"), "items": rows}

    def _get_documents(self, args: dict) -> dict:
        data = self._read("get_documents")
        rows = []
        for req in data.get("requirements", []):
            if args.get("only_open") and req.get("status") in ("obtained", "submitted", "not_applicable"):
                continue
            law = req.get("law_basis") or {}
            ref = self.sources.add("document", req.get("name", ""), source_id=req.get("doc_key"))
            rows.append({"ref": ref, "name": req.get("name"), "status": req.get("status_label") or req.get("status"),
                         "applicability": req.get("applicability"), "agency": req.get("agency"),
                         "guide": req.get("guide"), "law": law.get("label") if isinstance(law, dict) else None})
        return {"summary": data.get("summary"), "documents": rows}

    def _get_report(self, args: dict) -> dict:
        data = self._read("get_report")
        rows = []
        for group in data.get("groups", []):
            for it in group.get("items", []):
                ref = self.sources.add("report", it.get("title", ""), source_id=it.get("item_id"))
                rows.append({"ref": ref, "title": it.get("title"), "verdict": VERDICTS.get(it.get("verdict"), it.get("verdict")),
                             "reason": it.get("reason"), "stage": group.get("stage") or it.get("stage")})
        return {"summary": data.get("summary"), "items": rows}

    def _search_laws(self, args: dict) -> dict:
        query = str(args.get("query") or "").strip()
        if len(query) < 2:
            return {"error": "검색어가 너무 짧아요"}
        articles = self._read("search_laws", query)
        rows = []
        for a in articles:
            title = f"{a.get('law_name')} {a.get('article')}".strip()
            ref = self.sources.add("law", title, source_id=title, url=a.get("url"), article=a.get("article"))
            rows.append({"ref": ref, "law": a.get("law_name"), "article": a.get("article"), "title": a.get("title"),
                         "text": (a.get("text") or "")[:MAX_LAW_TEXT]})
        return {"query": query, "articles": rows} if rows else {"query": query, "articles": [], "note": "관련 조문을 찾지 못했어요"}

    def _search_support_programs(self, args: dict) -> dict:
        data = self._read("search_support_programs")
        rows = []
        for g in data.get("items", []):
            ref = self.sources.add("grant", g.get("title", ""), source_id=g.get("grant_id"), url=g.get("url"))
            rows.append({"ref": ref, "title": g.get("title"), "org": g.get("org"), "result": g.get("result"),
                         "deadline": g.get("deadline"), "who": (g.get("summary") or {}).get("who"),
                         "how_much": (g.get("summary") or {}).get("how_much")})
        return {"status": data.get("status"), "source": data.get("source"), "items": rows,
                "excluded_count": data.get("excluded_count")}


def history_messages(rows: list[tuple[str, str]]) -> list[dict]:
    """이전 대화(사용자 질문과 AI 최종 답변)만 최근 순으로 넘긴다. 도구 결과는 다시 넘기지 않는다 (필요하면 다시 조회한다)."""
    msgs = [{"role": role, "content": content} for role, content in rows if role in ("user", "assistant") and content]
    return msgs[-MAX_HISTORY_MESSAGES:]


def finalize(text: str, box: ToolBox) -> tuple[str, list[dict], list[dict]]:
    """답변의 출처 번호 중 실제 도구 결과에 있는 것만 남기고([S1], [S1, S2], [S3, 식품위생법 …] 모두 [S#]로 정리),
    없는 번호는 지운다. 화면 이동 버튼은 답변이 실제로 인용한 기능만 만든다."""
    used: list[str] = []

    def keep(match: re.Match) -> str:
        refs = [f"S{n}" for n in re.findall(r"\bS(\d+)\b", match.group(1))]
        valid = [r for r in refs if r in box.sources.items]
        for ref in valid:
            if ref not in used:
                used.append(ref)
        return "".join(f"[{r}]" for r in valid)

    clean = BRACKET_RE.sub(keep, text).strip()
    citations = [{"ref": ref, **box.sources.items[ref]} for ref in used]
    if "search_laws" in box.used and not any(c["source_type"] == "law" for c in citations):
        # 법령을 검색했는데 답변이 조문을 인용하지 않았다: 조문에 근거하지 않은 법령 설명일 수 있음을 알린다
        clean += "\n\n" + UNGROUNDED_LAW_NOTE
    actions, seen = [], set()
    for c in citations:
        target = NAV_BY_SOURCE.get(c["source_type"])
        if target and target[0] not in seen:
            seen.add(target[0])
            actions.append({"type": "navigate", "target": target[0], "label": target[1]})
    return clean, citations, actions[:2]


def _first_tool_plan(llm, messages: list[dict]) -> dict | None:
    """첫 호출은 조회 도구만 고른다. 모델을 쓸 수 없거나 호출이 없으면 본 모델이 이어받는다."""
    try:
        for kind, value in llm.stream_tools(step="chat_plan", tier="fast", messages=messages,
                                            tools=TOOLS, require_tool=True):
            if kind == "final" and value["tool_calls"]:
                return value
    except LLMError:
        pass
    return None


def run_turn(llm, *, profile: dict, history: list[dict], question: str, box: ToolBox,
             today: date) -> Iterator[tuple[str, Any]]:
    """질문 하나를 처리한다. 이벤트를 차례로 낸다.

    ("tool", {"name", "label", "arguments", "result", "status", "call_id"}) — 도구를 실행했다
    ("assistant_tools", {"content", "tool_calls"}) — AI가 도구를 요청한 중간 메시지 (저장용)
    ("delta", 글자) — 최종 답변 스트리밍
    ("done", {"content", "citations", "actions"}) — 끝
    """
    if not is_in_service_scope(question, history):
        # 범위 밖 질문은 모델에 전달하지 않는다. 따라서 모델이 일반 상식이나 잡담으로
        # 답을 만들어 내는 경로 자체가 없다.
        yield "delta", OUT_OF_SCOPE_REPLY
        yield "done", {"content": OUT_OF_SCOPE_REPLY, "citations": [], "actions": []}
        return
    if not hasattr(llm, "stream_tools"):
        raise LLMError("이 AI 설정에서는 상담(도구 호출)을 쓸 수 없어요. LLM_PROVIDER=openai 로 설정해 주세요.")
    system = SYSTEM.format(today=today.isoformat(), profile=json.dumps(profile, ensure_ascii=False, separators=(",", ":")))
    messages: list[dict] = [{"role": "system", "content": system}, *history, {"role": "user", "content": question}]
    for round_no in range(MAX_TOOL_ROUNDS + 1):
        tools = TOOLS if round_no < MAX_TOOL_ROUNDS else []  # 마지막 차례에는 도구 없이 답하게 한다
        final: dict = {"content": "", "tool_calls": []}
        buffered: list[str] = []
        # 첫 차례에는 한 개 이상의 도구를 고르고, 답변 본문은 본 모델로 생성한다.
        plan = _first_tool_plan(llm, messages) if round_no == 0 else None
        stream = (("final", plan),) if plan else llm.stream_tools(
            step="chat", tier="main", messages=messages, tools=tools, require_tool=round_no == 0)
        for kind, value in stream:
            if kind == "delta":
                buffered.append(value)
                yield "delta", value
            else:
                final = value
        if not final["tool_calls"]:
            content, citations, actions = finalize(final["content"], box)
            yield "done", {"content": content, "citations": citations, "actions": actions}
            return
        if buffered:
            yield "reset", None  # 도구를 부르기 전 흘려보낸 글은 최종 답이 아니다
        messages.append({"role": "assistant", "content": final["content"] or None, "tool_calls": final["tool_calls"]})
        yield "assistant_tools", {"content": final["content"], "tool_calls": final["tool_calls"]}
        for call in final["tool_calls"]:
            name = call["function"]["name"]
            try:
                args = json.loads(call["function"]["arguments"] or "{}")
                result, status = box.run(name, args), "done"
            except Exception as exc:  # noqa: BLE001 - 도구 실패는 AI에 알려 다른 방법으로 답하게 한다
                args, result, status = {}, {"error": f"조회 실패: {type(exc).__name__}"}, "failed"
            if isinstance(result, dict) and "error" in result:
                status = "failed"
            payload = json.dumps(result, ensure_ascii=False, default=str, separators=(",", ":"))
            messages.append({"role": "tool", "tool_call_id": call["id"], "content": payload})
            yield "tool", {"name": name, "label": TOOL_LABELS.get(name, name), "arguments": args, "result": result,
                           "status": status, "call_id": call["id"]}
