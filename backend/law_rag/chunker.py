"""조문 원문을 임베딩·검색용 조각으로 나눈다. 조각은 원문을 그대로 자른 것이라 AI가 인용한 문장을 원문에서 다시 찾을 수 있다."""

from __future__ import annotations

import re

MAX_CHUNK = 1200

_SENTENCE_END = re.compile(r"(?<=[.다])\s+")


def _split_long(line: str) -> list[str]:
    """한 줄이 너무 길면 문장 단위로 자르고, 그래도 길면 글자 수로 자른다."""
    if len(line) <= MAX_CHUNK:
        return [line]
    parts: list[str] = []
    current = ""
    for sentence in _SENTENCE_END.split(line):
        if len(current) + len(sentence) + 1 <= MAX_CHUNK:
            current = f"{current} {sentence}".strip()
            continue
        if current:
            parts.append(current)
        while len(sentence) > MAX_CHUNK:
            parts.append(sentence[:MAX_CHUNK])
            sentence = sentence[MAX_CHUNK:]
        current = sentence
    if current:
        parts.append(current)
    return parts


# 별표의 큰 항목 제목 ("4. 제2종 근린생활시설"). 짧고 마침표·"다"로 끝나지 않는 "숫자. 제목" 줄만 제목으로 본다.
_HEADING = re.compile(r"^\d{1,2}\.\s+\S")
MAX_HEADING = 30
HEADING_MARK = "[소속]"


def _is_heading(line: str) -> bool:
    return bool(_HEADING.match(line)) and len(line) <= MAX_HEADING and not line.endswith(("다", ".", ")"))


def chunk_text(content: str, keep_heading: bool = False) -> list[str]:
    """줄(항·호·목) 경계를 지키며 MAX_CHUNK 글자 이내로 묶는다.

    keep_heading=True (별표용)이면 제목 줄로 시작하지 않는 조각 맨 앞에 직전 큰 항목 제목을 "[소속] 4. 제2종 근린생활시설"로 붙인다.
    표가 조각으로 잘려도 "자. 일반음식점"이 어느 분류 아래인지 조각만 보고 알 수 있게 하기 위해서다. 붙인 줄도 원문 줄을 그대로 옮긴 것이다.
    """
    chunks: list[str] = []
    heads: list[str | None] = []  # 조각마다 시작 시점의 직전 제목
    current = ""
    head: str | None = None  # 지금까지 본 마지막 제목
    current_head: str | None = None  # current 가 시작될 때의 제목
    for raw in content.split("\n"):
        line = raw.strip()
        if not line:
            continue
        if keep_heading and _is_heading(line):
            head = line
            if not current:
                current_head = None
        for piece in _split_long(line):
            if current and len(current) + len(piece) + 1 > MAX_CHUNK:
                chunks.append(current)
                heads.append(current_head)
                current, current_head = piece, head
            else:
                if not current:
                    current_head = head
                current = f"{current}\n{piece}" if current else piece
    if current:
        chunks.append(current)
        heads.append(current_head)
    if keep_heading:
        chunks = [c if (h is None or c.split("\n", 1)[0] == h) else f"{HEADING_MARK} {h}\n{c}"
                  for c, h in zip(chunks, heads)]
    return chunks or [content.strip()]


def embed_text(law_name: str, label: str, title: str | None, chunk: str) -> str:
    """임베딩에 넣는 문장: 법령명·조문 번호·제목을 앞에 붙여 짧은 조각도 어느 조문인지 알 수 있게 한다 (저장하는 원문에는 붙이지 않는다)."""
    head = f"{law_name} {label}" + (f"({title})" if title else "")
    return f"{head}\n{chunk}"
