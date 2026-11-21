"""아이디·비밀번호 회원가입·로그인: 검증, 중복, 해시 저장, 실패 응답 통일, 시도 횟수 제한, 로그아웃."""

import uuid

import pytest
from sqlalchemy import delete, select

from config import get_settings
from db.models import User
from db.session import transaction
from services import password as pw

pytestmark = pytest.mark.skipif(not get_settings().database_url, reason="테스트 PostgreSQL 필요")


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def _fresh_limiters():
    for limiter in (pw.login_by_ip, pw.login_by_user, pw.signup_by_ip):
        limiter.clear()
    yield
    for limiter in (pw.login_by_ip, pw.login_by_user, pw.signup_by_ip):
        limiter.clear()


@pytest.fixture
def username():
    """테스트마다 새 아이디. 끝나면 계정을 지운다."""
    name = "t" + uuid.uuid4().hex[:10]
    yield name
    with transaction() as session:
        session.execute(delete(User).where(User.username == name))


def signup(client, username, password="password1", name="김창업"):
    return client.post("/api/auth/signup", json={"username": username, "password": password, "name": name})


def test_signup_logs_in_and_stores_only_a_hash(client, username):
    response = signup(client, username)
    assert response.status_code == 201
    body = response.json()
    assert body["user"]["provider"] == "local" and body["user"]["username"] == username
    assert body["store_id"] is None
    assert client.get("/api/me", headers={"Authorization": f"Bearer {body['access_token']}"}).status_code == 200
    with transaction() as session:
        stored = session.scalar(select(User.password_hash).where(User.username == username))
    assert stored and "password1" not in stored and stored.startswith("$2")


def test_login_with_right_password(client, username):
    signup(client, username)
    response = client.post("/api/auth/login", json={"username": username, "password": "password1"})
    assert response.status_code == 200
    assert response.json()["user"]["name"] == "김창업"


def test_username_is_case_insensitive(client, username):
    signup(client, username)
    response = client.post("/api/auth/login", json={"username": username.upper(), "password": "password1"})
    assert response.status_code == 200


def test_duplicate_username_is_rejected(client, username):
    assert signup(client, username).status_code == 201
    again = signup(client, username, name="다른 사람")
    assert again.status_code == 409 and again.json()["error"]["code"] == "USERNAME_TAKEN"


@pytest.mark.parametrize("bad_username", ["abc", "a" * 21, "UPPER_case", "한글아이디", "has space", ""])
def test_invalid_username(client, bad_username):
    response = signup(client, bad_username)
    assert response.status_code == 400 and response.json()["error"]["code"] == "INVALID_INPUT"


@pytest.mark.parametrize("bad_password", ["short", "1234567", "가" * 25])  # 25자 = 75바이트
def test_invalid_password(client, username, bad_password):
    response = signup(client, username, password=bad_password)
    assert response.status_code == 400


def test_invalid_name(client, username):
    assert signup(client, username, name="  ").status_code == 400
    assert signup(client, username, name="가" * 31).status_code == 400


def test_wrong_password_and_unknown_user_look_the_same(client, username):
    signup(client, username)
    wrong = client.post("/api/auth/login", json={"username": username, "password": "wrongpass1"})
    unknown = client.post("/api/auth/login", json={"username": "nouser" + username, "password": "password1"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()
    assert wrong.json()["error"]["code"] == "INVALID_CREDENTIALS"


def attempt(client, username, password, ip=None):
    headers = {"X-Forwarded-For": ip} if ip else {}
    return client.post("/api/auth/login", json={"username": username, "password": password}, headers=headers)


def test_too_many_failures_are_throttled_even_with_the_right_password(client, username):
    signup(client, username)
    for _ in range(pw.MAX_FAILURES):
        assert attempt(client, username, "wrongpass1").status_code == 401
    blocked = attempt(client, username, "password1")
    assert blocked.status_code == 429 and blocked.json()["error"]["code"] == "RATE_LIMITED"


def test_someone_elses_failures_do_not_lock_me_out(client, username):
    """공격자가 내 아이디로 틀려도 다른 IP에서 오는 내 로그인은 막히지 않는다."""
    signup(client, username)
    for _ in range(pw.MAX_FAILURES):
        assert attempt(client, username, "wrongpass1", ip="203.0.113.7").status_code == 401
    assert attempt(client, username, "wrongpass1", ip="203.0.113.7").status_code == 429
    assert attempt(client, username, "password1", ip="198.51.100.9").status_code == 200


def test_spoofed_left_forwarded_for_does_not_reset_the_limit(client, username):
    """X-Forwarded-For 왼쪽 값은 클라이언트가 꾸밀 수 있으므로 맨 오른쪽(프록시가 붙인 값)만 본다."""
    signup(client, username)
    for i in range(pw.MAX_FAILURES):
        attempt(client, username, "wrongpass1", ip=f"10.0.0.{i}, 203.0.113.7")
    assert attempt(client, username, "wrongpass1", ip="10.9.9.9, 203.0.113.7").status_code == 429


def test_many_ips_still_hit_the_per_username_cap(client, username):
    signup(client, username)
    for i in range(pw.login_by_user.limit):
        assert attempt(client, username, "wrongpass1", ip=f"198.51.100.{i}").status_code == 401
    assert attempt(client, username, "password1", ip="192.0.2.1").status_code == 429


def test_successful_login_resets_the_failure_count(client, username):
    signup(client, username)
    for _ in range(pw.MAX_FAILURES - 1):
        attempt(client, username, "wrongpass1")
    assert attempt(client, username, "password1").status_code == 200
    for _ in range(pw.MAX_FAILURES - 1):
        assert attempt(client, username, "wrongpass1").status_code == 401


def test_signup_is_rate_limited_per_ip(client):
    created: list[str] = []
    try:
        for i in range(pw.signup_by_ip.limit):
            name = "r" + uuid.uuid4().hex[:10]
            created.append(name)
            assert signup(client, name).status_code == 201
        blocked = signup(client, "r" + uuid.uuid4().hex[:10])
        assert blocked.status_code == 429 and blocked.json()["error"]["code"] == "RATE_LIMITED"
    finally:
        with transaction() as session:
            session.execute(delete(User).where(User.username.in_(created)))


def test_limiter_does_not_grow_without_bound():
    limiter = pw.AttemptLimiter(5, window_sec=600)
    limiter.MAX_KEYS = 50
    limiter.PURGE_AT = 20
    for i in range(500):
        limiter.add(f"random-{i}")
    assert len(limiter._hits) <= limiter.MAX_KEYS


def test_social_and_demo_accounts_cannot_log_in_with_a_password(client):
    """아이디가 없는 계정(소셜·예시)은 아이디·비밀번호로 들어올 수 없다."""
    response = client.post("/api/auth/login", json={"username": "demo", "password": "password1"})
    assert response.status_code == 401


def test_logout_revokes_the_token(client, username):
    token = signup(client, username).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.post("/api/auth/logout", headers=headers).status_code == 204
    assert client.get("/api/me", headers=headers).status_code == 401


def test_unknown_fields_are_rejected(client, username):
    response = client.post("/api/auth/signup", json={"username": username, "password": "password1",
                                                     "name": "a", "provider": "demo"})
    assert response.status_code == 400
