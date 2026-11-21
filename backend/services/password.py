"""아이디·비밀번호 계정: 입력 검증, bcrypt 해시, 로그인 실패 횟수 제한.

- 평문 비밀번호는 저장·로그에 남기지 않는다. bcrypt 는 72바이트까지만 읽으므로 그 이상은 거절한다.
- 로그인 실패는 아이디가 없든 비밀번호가 틀리든 같은 응답이다 (계정 존재 여부를 알리지 않는다).
"""

import re
import threading
import time

import bcrypt

from api.errors import ApiError, invalid_input

USERNAME_RE = re.compile(r"^[a-z0-9]{4,20}$")
PASSWORD_MIN = 8
PASSWORD_MAX_BYTES = 72
NAME_MAX = 30

MAX_FAILURES = 5          # 이 횟수만큼 틀리면
WINDOW_SEC = 10 * 60      # 이 시간 동안 로그인을 막는다 (같은 아이디 기준, 서버 메모리)

# 존재하지 않는 아이디도 해시 비교를 한 번 거쳐 응답 시간으로 존재 여부를 알 수 없게 한다
_DUMMY_HASH = bcrypt.hashpw(b"dummy-password", bcrypt.gensalt(rounds=10))


def validate_username(value: str) -> str:
    username = (value or "").strip().lower()
    if not USERNAME_RE.fullmatch(username):
        raise invalid_input("아이디는 영문 소문자와 숫자로 4~20자여야 합니다.")
    return username


def validate_password(value: str) -> str:
    if len(value or "") < PASSWORD_MIN:
        raise invalid_input(f"비밀번호는 {PASSWORD_MIN}자 이상이어야 합니다.")
    if len(value.encode("utf-8")) > PASSWORD_MAX_BYTES:
        raise invalid_input("비밀번호가 너무 깁니다. 영문 기준 72자 이내로 입력해 주세요.")
    return value


def validate_name(value: str) -> str:
    name = (value or "").strip()
    if not name or len(name) > NAME_MAX:
        raise invalid_input(f"이름은 1~{NAME_MAX}자로 입력해 주세요.")
    return name


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verify_password(password: str, password_hash: str | None) -> bool:
    """password_hash 가 없으면(없는 아이디) 더미 해시와 비교하고 항상 False."""
    target = password_hash.encode("ascii") if password_hash else _DUMMY_HASH
    try:
        ok = bcrypt.checkpw(password.encode("utf-8")[:PASSWORD_MAX_BYTES], target)
    except ValueError:
        ok = False
    return ok and password_hash is not None


class LoginThrottle:
    """아이디별 최근 실패 시각. 서버 한 대 기준이며 재시작하면 초기화된다."""

    def __init__(self) -> None:
        self._failures: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def _recent(self, username: str, now: float) -> list[float]:
        recent = [t for t in self._failures.get(username, []) if now - t < WINDOW_SEC]
        if recent:
            self._failures[username] = recent
        else:
            self._failures.pop(username, None)
        return recent

    def check(self, username: str) -> None:
        with self._lock:
            if len(self._recent(username, time.monotonic())) >= MAX_FAILURES:
                raise ApiError(429, "RATE_LIMITED", "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.")

    def fail(self, username: str) -> None:
        with self._lock:
            now = time.monotonic()
            self._recent(username, now)
            self._failures.setdefault(username, []).append(now)

    def reset(self, username: str) -> None:
        with self._lock:
            self._failures.pop(username, None)


throttle = LoginThrottle()
