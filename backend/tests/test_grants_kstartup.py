"""K-Startup 공고 선별(외부 호출 없음)과 실제 조회·판정 (CLAUDE.md Testing Policy: 판정은 실제 API·실제 LLM).

DATA_GO_KR_KEY·LLM_API_KEY 가 없으면 실제 호출 테스트는 건너뛴다. DB 를 쓰지 않는다.
"""

import os
from datetime import date
from pathlib import Path

import pytest
from dotenv import load_dotenv

from tools import kstartup

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
TODAY = date(2026, 11, 22)


def row(**kw):
    base = {"pbanc_sn": "1", "biz_pbanc_nm": "청년 소상공인 외식 창업 지원", "pbanc_rcpt_end_dt": "20261130",
            "supt_regin": "전국", "aply_trgt": "일반인,일반기업", "supt_biz_clsfc": "사업화",
            "aply_trgt_ctnt": "만 39세 이하 예비창업자", "pbanc_ntrp_nm": "중소벤처기업부"}
    base.update(kw)
    return base


def test_sido_of():
    assert kstartup.sido_of("서울특별시 성동구 성수이로 00") == "서울"
    assert kstartup.sido_of("경기도 수원시") == "경기"
    assert kstartup.sido_of("충청남도 천안시") == "충남"
    assert kstartup.sido_of("") is None


def test_select_filters_closed_region_target_and_unrelated():
    rows = [
        row(pbanc_sn="1"),
        row(pbanc_sn="2", pbanc_rcpt_end_dt="20261101"),  # 마감
        row(pbanc_sn="3", supt_regin="부산"),  # 다른 지역
        row(pbanc_sn="4", aply_trgt="대학생,청소년"),  # 개인 창업자 대상 아님
        row(pbanc_sn="5", biz_pbanc_nm="딥테크 반도체 기술사업화", aply_trgt_ctnt="", supt_biz_clsfc="사업화"),
        row(pbanc_sn="6", supt_regin="서울"),
        row(pbanc_sn="1"),  # 같은 공고 중복
    ]
    picked, counts = kstartup.select(rows, "서울특별시 성동구", TODAY)
    assert [g["grant_id"] for g in picked] == ["kstartup-1", "kstartup-6"]
    assert counts == {"closed": 1, "region": 1, "target": 1, "unrelated": 1}
    assert picked[0]["deadline"] == "2026-11-30" and picked[0]["org"] == "중소벤처기업부"


def test_select_limits_and_ranks_by_relevance():
    rows = [row(pbanc_sn=str(i), biz_pbanc_nm="청년 창업 지원" if i % 2 else "소상공인 음식점 지원") for i in range(20)]
    picked, counts = kstartup.select(rows, "서울특별시", TODAY, limit=5)
    assert len(picked) == 5 and all("소상공인" in g["title"] for g in picked)
    assert counts["unrelated"] == 15


def test_notice_keeps_only_filled_fields_with_labels():
    text = kstartup.notice(row(biz_trgt_age="만 39세 이하", prfn_matr=None, pbanc_rcpt_bgng_dt="20261101"))
    assert "대상 연령: 만 39세 이하" in text and "접수 기간: 2026-11-01 ~ 2026-11-30" in text
    assert "우대 사항" not in text


@pytest.fixture(scope="module")
def real():
    if not os.getenv("DATA_GO_KR_KEY") or not os.getenv("LLM_API_KEY"):
        pytest.skip("DATA_GO_KR_KEY·LLM_API_KEY 가 없어 실제 호출 테스트를 건너뜀")


def test_real_kstartup_fetch_and_judge(real):
    import httpx

    from agent.cost import CostTracker
    from agent.grants import judge_grants
    from agent.llm import make_llm
    from agent.ports import StoreInput, ToolResult

    with httpx.Client(timeout=20) as client:
        rows = kstartup.fetch(client, os.environ["DATA_GO_KR_KEY"])
    assert rows and all(r.get("rcrt_prgs_yn") == "Y" for r in rows)
    picked, _ = kstartup.select(rows, "서울특별시 성동구 성수이로 00", date.today(), limit=3)
    assert picked
    store = StoreInput(store_id="t", name="테스트카페", address="서울특별시 성동구 성수이로 00", opening_date=date(2027, 3, 2),
                       owner_birth_year=1998, answers={"sells_alcohol": False})
    result = judge_grants(make_llm(CostTracker()), store, ToolResult(ok=True, source=kstartup.SOURCE, data={"grants": picked}))
    assert result.ok and len(result.items) + result.excluded_count == len(picked)
    for item in result.items:  # 근거가 있는 조건만 pass 이고, 인용은 공고문 원문에 있다
        notice = next(g["text"] for g in picked if g["grant_id"] == item.grant_id)
        for check in item.eligibility.checks:
            if check.result == "pass":
                assert check.evidence and "".join(check.evidence.text.split()) in "".join(notice.split())
