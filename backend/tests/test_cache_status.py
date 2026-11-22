"""저장된 정상 조회 결과 재사용(done)과 실패 뒤 대체(fallback)를 진행 표시에서 구분한다 (#161).

DB·외부 API를 부르지 않는다 (캐시 조회를 고정 값으로 바꾼다).
"""

from types import SimpleNamespace

from agent.loop import _origin, _status, run_analysis
from agent.ports import ToolResult
from tools.analysis import AnalysisTools

from .fakes import SIMILAR, FakeCalc, FakeTools, store
from .test_loop import PACK, llm

FRESH = ToolResult(ok=True, source="KIPRIS", data={"similar": []}, from_cache=True)


def tools_with(fresh_row=None, stale_row=None):
    """fresh=True 조회(기한 안 캐시)와 기한 무관 조회(실패 뒤 대체용)에 돌려줄 값을 정한다."""
    t = AnalysisTools(providers=SimpleNamespace(), use_mock=False)
    t._cached = lambda key, fresh=False: fresh_row if fresh else stale_row
    return t


def fail():
    raise RuntimeError("down")


def test_status_and_origin():
    assert _status(FRESH) == "done" and _origin(FRESH) == " · 저장된 조회 결과"
    sub = FRESH.model_copy(update={"substituted": True})
    assert _status(sub) == "fallback" and _origin(sub) == " · 저장된 조회 결과로 대체"
    mock = FRESH.model_copy(update={"from_cache": False, "from_mock": True})
    assert _status(mock) == "fallback" and _origin(mock) == " · 예시 자료"
    assert _status(ToolResult(ok=False, source="x")) == "failed"


def test_fresh_cache_is_reuse_not_substitution():
    res = tools_with(fresh_row=FRESH)._query("trademark", {"name": "x"}, fail)
    assert res.from_cache and not res.substituted


def test_failure_with_stale_cache_is_substitution():
    res = tools_with(stale_row=FRESH)._query("trademark", {"name": "x"}, fail)
    assert res.from_cache and res.substituted


def test_failure_without_cache_uses_mock_as_substitution():
    res = tools_with()._query("trademark", {"name": "x"}, fail)
    assert res.from_mock and res.substituted


def steps(tools):
    events = []
    run_analysis(store(), tools=tools, calc=FakeCalc(), llm=llm(), pack=PACK, emit=lambda e, d: events.append((e, d)))
    return {d["step"]: d for e, d in events if e == "step" and d["status"] != "running"}


class _RealModeTools(FakeTools):
    use_mock = False

    def __init__(self, *, building_update, trademark_update, **kw):
        super().__init__(**kw)
        self.building_update, self.trademark_update = building_update, trademark_update

    def building(self, s):
        return super().building(s).model_copy(update=self.building_update)

    def trademark(self, name):
        return super().trademark(name).model_copy(update=self.trademark_update)


def test_reused_cache_shows_done_and_saved_result():
    st = steps(_RealModeTools(similar=SIMILAR, building_update={"from_cache": True, "from_mock": False},
                              trademark_update={"from_cache": True, "from_mock": False}))
    assert st["building"]["status"] == "done"
    assert st["building"]["message"] == "건축물대장 조회 완료 · 저장된 조회 결과"
    assert st["trademark"]["status"] == "done" and st["trademark"]["message"].endswith(" · 저장된 조회 결과")


def test_substituted_cache_shows_fallback():
    st = steps(_RealModeTools(similar=SIMILAR,
                              building_update={"from_cache": True, "from_mock": False, "substituted": True},
                              trademark_update={"from_cache": True, "from_mock": False, "substituted": True}))
    assert st["building"]["status"] == "fallback"
    assert st["building"]["message"] == "건축물대장 조회 완료 · 저장된 조회 결과로 대체"
    assert st["trademark"]["status"] == "fallback" and st["trademark"]["message"].endswith("저장된 조회 결과로 대체")
