"""외부 API GET 요청. 제공자의 일시 오류만 짧게 다시 시도한다.

인증 실패·404·제공자 오류 코드(키 미등록 등)는 다시 시도해도 같으므로 바로 돌려준다.
"""

from __future__ import annotations

import time

import httpx

RETRY_STATUS = {500, 502, 503, 504}
BACKOFF = (0.5, 1.0)  # 처음 실패 뒤 0.5초, 두 번째 실패 뒤 1초 기다린다 (최대 3번 호출)


def get(client: httpx.Client, url: str, *, sleep=None, **kwargs) -> httpx.Response:
    sleep = sleep or time.sleep
    for wait in (*BACKOFF, None):
        try:
            response = client.get(url, **kwargs)
        except (httpx.TimeoutException, httpx.TransportError):
            if wait is None:
                raise
        else:
            if response.status_code not in RETRY_STATUS or wait is None:
                return response
        sleep(wait)
    raise AssertionError("unreachable")
