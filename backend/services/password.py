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


class AttemptLimiter:
    """키별 최근 시도 시각을 세어 한도를 넘으면 막는다. 서버 한 대(프로세스) 기준이라 재시작하면 초기화된다.

    키는 요청마다 새로 만들 수 있으므로, 쌓인 기록이 PURGE_AT 개를 넘으면 만료된 키를 전부 지우고
    그래도 MAX_KEYS 를 넘으면 모두 비운다 (메모리가 무한히 늘지 않게).
    """

    PURGE_AT = 1_000
    MAX_KEYS = 20_000

    def __init__(self, limit: int, window_sec: int = WINDOW_SEC) -> None:
        self.limit, self.window = limit, window_sec
        self._hits: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def _recent(self, key: str, now: float) -> list[float]:
        recent = [t for t in self._hits.get(key, []) if now - t < self.window]
        if recent:
            self._hits[key] = recent
        else:
            self._hits.pop(key, None)
        return recent

    def _purge(self, now: float) -> None:
        for key in list(self._hits):
            self._recent(key, now)
        if len(self._hits) > self.MAX_KEYS:
            self._hits.clear()

    def blocked(self, key: str) -> bool:
        with self._lock:
            return len(self._recent(key, time.monotonic())) >= self.limit

    def add(self, key: str) -> None:
        with self._lock:
            now = time.monotonic()
            if len(self._hits) >= self.PURGE_AT:
                self._purge(now)
            self._recent(key, now)
            self._hits.setdefault(key, []).append(now)

    def reset(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._hits.clear()


# 로그인 실패: (접속 IP, 아이디)별 5회 + 아이디별 20회(여러 IP로 나눠 맞추는 시도 대비).
# 다른 사람이 내 아이디로 틀려도 내 IP에서는 잠기지 않는다.
login_by_ip = AttemptLimiter(MAX_FAILURES)
login_by_user = AttemptLimiter(MAX_FAILURES * 4)
# 회원가입 시도: 접속 IP별 10회 (계정 대량 생성·해시 계산으로 CPU를 쓰는 것을 막는다)
signup_by_ip = AttemptLimiter(10)

RATE_LIMITED = ApiError(429, "RATE_LIMITED", "시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.")


def client_ip(request) -> str:
    """접속 IP. 프록시(Railway)가 덧붙인 X-Forwarded-For 의 맨 오른쪽 값을 쓴다 (왼쪽은 클라이언트가 꾸며 보낼 수 있다)."""
    forwarded = request.headers.get("x-forwarded-for", "")
    last = forwarded.split(",")[-1].strip() if forwarded else ""
    return last or (request.client.host if request.client else "unknown")


def check_login(ip: str, username: str) -> None:
    if login_by_ip.blocked(f"{ip}|{username}") or login_by_user.blocked(username):
        raise ApiError(429, "RATE_LIMITED", "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.")


def login_failed(ip: str, username: str) -> None:
    login_by_ip.add(f"{ip}|{username}")
    login_by_user.add(username)


def login_succeeded(ip: str, username: str) -> None:
    login_by_ip.reset(f"{ip}|{username}")
    login_by_user.reset(username)


def check_signup(ip: str) -> None:
    if signup_by_ip.blocked(ip):
        raise ApiError(429, "RATE_LIMITED", "가입 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.")
    signup_by_ip.add(ip)
