import pytest

import agent.llm as llm_mod


@pytest.fixture(autouse=True)
def _no_retry_sleep(monkeypatch):
    monkeypatch.setattr(llm_mod, "RETRY_DELAY_SEC", 0)
