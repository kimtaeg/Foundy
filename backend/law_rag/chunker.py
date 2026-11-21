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


def chunk_text(content: str) -> list[str]:
    """줄(항·호·목) 경계를 지키며 MAX_CHUNK 글자 이내로 묶는다."""
    chunks: list[str] = []
    current = ""
    for raw in content.split("\n"):
        line = raw.strip()
        if not line:
            continue
        for piece in _split_long(line):
            if current and len(current) + len(piece) + 1 > MAX_CHUNK:
                chunks.append(current)
                current = piece
            else:
                current = f"{current}\n{piece}" if current else piece
    if current:
        chunks.append(current)
    return chunks or [content.strip()]


def embed_text(law_name: str, label: str, title: str | None, chunk: str) -> str:
    """임베딩에 넣는 문장: 법령명·조문 번호·제목을 앞에 붙여 짧은 조각도 어느 조문인지 알 수 있게 한다 (저장하는 원문에는 붙이지 않는다)."""
    head = f"{law_name} {label}" + (f"({title})" if title else "")
    return f"{head}\n{chunk}"
