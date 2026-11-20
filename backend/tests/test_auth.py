"""로그인·계정 관리 (Notion 3번): 소셜 로그인(가짜 제공자 응답)·state 대조·로그아웃 토큰 폐기·PATCH /me.

실제 카카오·Google·네이버 연결은 검증하지 않는다 (앱 키·콘솔 등록 필요). 요청 형식은 공식 문서 기준으로 확인한다.
"""

from datetime import timedelta
from urllib.parse import parse_qs, urlparse
import secrets
import threading
import uuid

import httpx
import jwt
import pytest
from sqlalchemy import delete, func, select

from config import get_settings
from db.models import OAuthState, RevokedToken, Store, User
from db.session import transaction
from services import oauth
from services.auth import ALGORITHM, _secret, purge_expired
from services.timeutil import now_utc

pytestmark = pytest.mark.skipif(not get_settings().database_url, reason="테스트 PostgreSQL 필요")

CALLBACK = "http://localhost:3000/auth/callback"
OTHER_CALLBACK = "https://foundy.vercel.app/auth/callback"


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture
def created():
    """테스트가 만든 사용자 id. 끝나면 지운다 (가게·폐기 기록은 CASCADE)."""
    ids: list[str] = []
    yield ids
    with transaction() as session:
        session.execute(delete(User).where(User.id.in_([uuid.UUID(i) for i in ids])))


@pytest.fixture
def configured(monkeypatch):
    settings = get_settings()
    for provider in oauth.PROVIDERS:
        monkeypatch.setattr(settings, f"{provider}_client_id", f"{provider}-id")
        monkeypatch.setattr(settings, f"{provider}_client_secret", f"{provider}-secret")
    monkeypatch.setattr(settings, "oauth_redirect_uris", f"{CALLBACK}, {OTHER_CALLBACK}")
    return settings


class FakeProviders:
    """제공자 토큰·사용자 API 대역. 받은 요청을 기록한다."""

    def __init__(self, uid="u-1", name="김창업"):
        self.requests: list[httpx.Request] = []
        self.uid, self.name = uid, name
        self.token_response = None  # (status, json) 로 바꾸면 토큰 응답을 덮어쓴다
        self.profile_status = 200
        self.raise_network = False

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.raise_network:
            raise httpx.ConnectError("down", request=request)
        url = str(request.url)
        if "token" in url:
            if self.token_response:
                return httpx.Response(self.token_response[0], json=self.token_response[1])
            return httpx.Response(200, json={"access_token": "provider-token", "token_type": "bearer"})
        if self.profile_status != 200:
            return httpx.Response(self.profile_status, json={})
        if "kakao" in url:
            return httpx.Response(200, json={"id": int(self.uid) if self.uid.isdigit() else self.uid,
                                             "kakao_account": {"profile": {"nickname": self.name}}})
        if "google" in url:
            return httpx.Response(200, json={"sub": self.uid, "name": self.name})
        return httpx.Response(200, json={"resultcode": "00", "message": "success",
                                         "response": {"id": self.uid, "nickname": self.name}})

    def token_form(self) -> dict:
        req = next(r for r in self.requests if "token" in str(r.url))
        return {k: v[0] for k, v in parse_qs(req.content.decode()).items()}


@pytest.fixture
def fake(monkeypatch):
    providers = FakeProviders(uid=str(uuid.uuid4().int)[:12])
    monkeypatch.setattr(oauth, "http_client", lambda: httpx.Client(transport=httpx.MockTransport(providers.handler)))
    return providers


def new_nonce() -> str:
    """프론트가 로그인마다 만드는 browser_nonce (32바이트 → base64url 43자)."""
    return secrets.token_urlsafe(32)


NONCE = new_nonce()  # 이 테스트의 "로그인을 시작한 브라우저"


def start_body(provider="kakao", nonce=NONCE, **extra):
    return {"provider": provider, "browser_hash": oauth.browser_hash_of(nonce), **extra}


def start(client, provider="kakao", nonce=NONCE, **extra):
    res = client.post("/api/auth/social/start", json=start_body(provider, nonce, **extra))
    assert res.status_code == 200, res.text
    return res.json()


def submit(client, provider, code, state, nonce=NONCE):
    body = {"provider": provider, "code": code, "state": state}
    if nonce is not None:
        body["browser_nonce"] = nonce
    return client.post("/api/auth/social", json=body)


def login(client, created, provider="kakao", code="auth-code", state=None, nonce=NONCE):
    state = state or start(client, provider)["state"]
    res = submit(client, provider, code, state, nonce)
    if res.status_code == 200:
        created.append(res.json()["user"]["user_id"])
    return res


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- 로그인 시작: state 발급·redirect_uri 허용 목록 ----------

@pytest.mark.parametrize("provider,host", [("kakao", "kauth.kakao.com"), ("google", "accounts.google.com"),
                                           ("naver", "nid.naver.com")])
def test_start_issues_state_and_authorize_url(client, configured, provider, host):
    body = start(client, provider)
    url = urlparse(body["authorize_url"])
    query = {k: v[0] for k, v in parse_qs(url.query).items()}
    assert url.hostname == host and body["redirect_uri"] == CALLBACK and body["expires_in"] == 600
    assert query["response_type"] == "code" and query["client_id"] == f"{provider}-id"
    assert query["redirect_uri"] == CALLBACK and query["state"] == body["state"] and len(body["state"]) >= 32
    assert ("scope" in query) == (provider == "google") and query.get("scope", "openid profile") == "openid profile"
    with transaction() as session:
        row = session.get(OAuthState, body["state"])
        assert row.provider == provider and row.redirect_uri == CALLBACK
        assert row.browser_hash == oauth.browser_hash_of(NONCE)  # 원본 nonce 는 저장하지 않는다
    assert "browser_hash" not in body and NONCE not in body["authorize_url"]  # 제공자에게 보내지 않는다


def test_start_accepts_only_allowed_redirect_uri(client, configured):
    assert start(client, redirect_uri=OTHER_CALLBACK)["redirect_uri"] == OTHER_CALLBACK
    for bad in ("https://evil.example/cb", CALLBACK + "/", CALLBACK.upper()):  # 정확히 같은 값만
        res = client.post("/api/auth/social/start", json=start_body(redirect_uri=bad))
        assert res.status_code == 400 and res.json()["error"]["code"] == "INVALID_INPUT"


def test_start_without_configuration_is_unavailable(client, configured, monkeypatch):
    monkeypatch.setattr(configured, "google_client_secret", "")
    res = client.post("/api/auth/social/start", json=start_body("google"))
    assert res.status_code == 503 and res.json()["error"]["code"] == "SOCIAL_LOGIN_UNAVAILABLE"
    monkeypatch.setattr(configured, "oauth_redirect_uris", "")
    assert client.post("/api/auth/social/start", json=start_body()).status_code == 503
    assert client.post("/api/auth/social/start", json=start_body("apple")).status_code == 400


# ---------- 코드 교환: 제공자별 필수 입력 ----------

def test_kakao_login_creates_user_without_store(client, configured, fake, created):
    res = login(client, created, "kakao", code="kakao-code")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["store_id"] is None and body["user"]["provider"] == "kakao" and body["user"]["name"] == "김창업"
    form = fake.token_form()
    assert form == {"grant_type": "authorization_code", "client_id": "kakao-id", "code": "kakao-code",
                    "redirect_uri": CALLBACK, "client_secret": "kakao-secret"}  # state 는 토큰 단계에 없다
    profile_req = fake.requests[-1]
    assert profile_req.url.host == "kapi.kakao.com" and profile_req.headers["Authorization"] == "Bearer provider-token"
    me = client.get("/api/me", headers=bearer(body["access_token"])).json()
    assert me == {"user": body["user"], "store_id": None}


def test_google_login_sends_redirect_uri_and_uses_sub(client, configured, fake, created):
    state = start(client, "google", redirect_uri=OTHER_CALLBACK)["state"]
    res = login(client, created, "google", state=state)
    assert res.status_code == 200, res.text
    form = fake.token_form()
    assert form["redirect_uri"] == OTHER_CALLBACK  # 시작 때 고른 값 (요청 본문 값이 아니다)
    assert form["client_secret"] == "google-secret" and "state" not in form
    assert fake.requests[-1].url.host == "openidconnect.googleapis.com"


def test_naver_login_sends_state_and_secret_without_redirect_uri(client, configured, fake, created):
    state = start(client, "naver")["state"]
    res = login(client, created, "naver", state=state)
    assert res.status_code == 200, res.text
    form = fake.token_form()
    assert form["state"] == state and form["client_secret"] == "naver-secret" and "redirect_uri" not in form
    assert fake.requests[-1].url.host == "openapi.naver.com"


def test_same_social_account_maps_to_same_user_and_keeps_renamed_name(client, configured, fake, created):
    first = login(client, created).json()
    renamed = client.patch("/api/me", headers=bearer(first["access_token"]), json={"name": "새 이름"})
    assert renamed.status_code == 200 and renamed.json()["user"]["name"] == "새 이름"
    second = login(client, created).json()
    assert second["user"]["user_id"] == first["user"]["user_id"] and second["user"]["name"] == "새 이름"
    other_provider = login(client, created, "google").json()  # 같은 id라도 제공자가 다르면 다른 사용자
    assert other_provider["user"]["user_id"] != first["user"]["user_id"]
    with transaction() as session:
        assert session.scalar(select(func.count()).select_from(User).where(
            User.provider == "kakao", User.provider_user_id == fake.uid)) == 1


# ---------- state 대조 ----------

def test_state_must_match_issued_value_and_is_single_use(client, configured, fake, created):
    assert login(client, created, state="never-issued").json()["error"]["code"] == "INVALID_STATE"
    state = start(client, "kakao")["state"]
    assert login(client, created, state=state).status_code == 200
    reused = login(client, created, state=state)
    assert reused.status_code == 400 and reused.json()["error"]["code"] == "INVALID_STATE"


def test_state_for_other_provider_is_rejected_and_consumed(client, configured, fake, created):
    state = start(client, "kakao")["state"]
    mismatch = login(client, created, "naver", state=state)
    assert mismatch.status_code == 400 and mismatch.json()["error"]["code"] == "INVALID_STATE"
    assert login(client, created, "kakao", state=state).status_code == 400  # 대조에 실패한 state 도 다시 못 쓴다
    assert fake.requests == []  # state 가 틀리면 제공자를 부르지 않는다


def test_expired_state_is_rejected(client, configured, fake, created):
    state = start(client, "kakao")["state"]
    with transaction() as session:
        session.get(OAuthState, state).expires_at = now_utc() - timedelta(seconds=1)
    assert login(client, created, state=state).json()["error"]["code"] == "INVALID_STATE"


# ---------- 브라우저 결속 (Foundy 자체. 제공자 PKCE 와 별개) ----------

def state_exists(state):
    with transaction() as session:
        return session.get(OAuthState, state) is not None


@pytest.mark.parametrize("other_nonce", ["different", "missing"])
def test_other_browser_is_rejected_before_provider_and_state_survives(client, configured, fake, created, other_nonce):
    state = start(client, "kakao")["state"]
    nonce = new_nonce() if other_nonce == "different" else None
    res = login(client, created, state=state, nonce=nonce)
    assert res.status_code == 400
    assert res.json()["error"]["code"] == ("INVALID_STATE" if nonce else "INVALID_INPUT")
    assert fake.requests == []  # 제공자를 부르지 않는다
    assert state_exists(state)  # 소비하지 않아 원래 브라우저가 이어서 로그인할 수 있다
    assert login(client, created, state=state).status_code == 200
    assert not state_exists(state)


def test_other_browser_cannot_use_state_issued_to_attacker(client, configured, fake, created):
    """로그인 CSRF: 공격자 브라우저가 시작한 state 를 피해자 브라우저(다른 nonce)가 제출해도 거절된다."""
    attacker = new_nonce()
    state = start(client, "kakao", nonce=attacker)["state"]
    victim = login(client, created, state=state, nonce=NONCE)
    assert victim.status_code == 400 and victim.json()["error"]["code"] == "INVALID_STATE"
    assert fake.requests == []


@pytest.mark.parametrize("bad", ["", "a" * 42, "a" * 44, "x" * 42 + "+", "한" * 43])
def test_malformed_browser_nonce_or_hash_is_400(client, configured, fake, created, bad):
    state = start(client, "kakao")["state"]
    assert submit(client, "kakao", "c", state, nonce=bad).status_code == 400
    for hash_value in ("", "A" * 64, "g" * 64, "a" * 63, oauth.browser_hash_of(NONCE).upper()):
        res = client.post("/api/auth/social/start", json={"provider": "kakao", "browser_hash": hash_value})
        assert res.status_code == 400
    assert client.post("/api/auth/social/start", json={"provider": "kakao"}).status_code == 400
    assert fake.requests == [] and state_exists(state)


def test_concurrent_callbacks_with_same_state_exchange_code_once(client, configured, fake, created):
    state = start(client, "kakao")["state"]
    barrier, results = threading.Barrier(3), []

    def callback():
        barrier.wait()
        results.append(submit(client, "kakao", "same-code", state))

    threads = [threading.Thread(target=callback) for _ in range(3)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(10)
    for res in results:
        if res.status_code == 200:
            created.append(res.json()["user"]["user_id"])
    codes = sorted(r.status_code for r in results)
    assert codes == [200, 400, 400]
    assert all(r.json()["error"]["code"] == "INVALID_STATE" for r in results if r.status_code == 400)
    assert sum("token" in str(r.url) for r in fake.requests) == 1  # 인가 코드 교환은 한 번


# ---------- 제공자 실패 ----------

@pytest.mark.parametrize("response", [
    (401, {"error": "invalid_grant", "error_description": "authorization code not found", "error_code": "KOE320"}),
    (400, {"error": "invalid_grant"}),
    (200, {"error": "invalid_request", "error_description": "no valid data in session"}),  # 네이버식 200 + error
    (200, {"token_type": "bearer"}),  # access_token 없음
])
def test_rejected_code_is_login_failure(client, configured, fake, created, response):
    fake.token_response = response
    res = login(client, created)
    assert res.status_code == 401 and res.json()["error"]["code"] == "SOCIAL_LOGIN_FAILED"


def test_provider_outage_is_distinguished_from_rejection(client, configured, fake, created):
    fake.token_response = (503, {})
    assert login(client, created).json()["error"]["code"] == "SOCIAL_PROVIDER_UNAVAILABLE"
    fake.token_response = None
    fake.raise_network = True
    res = login(client, created)
    assert res.status_code == 502 and res.json()["error"]["code"] == "SOCIAL_PROVIDER_UNAVAILABLE"


def test_profile_without_id_or_rejected_token_fails(client, configured, fake, created):
    fake.profile_status = 401
    assert login(client, created).json()["error"]["code"] == "SOCIAL_LOGIN_FAILED"
    fake.profile_status, fake.uid = 200, ""
    assert login(client, created, "google").json()["error"]["code"] == "SOCIAL_LOGIN_FAILED"


# ---------- 인증·로그아웃 ----------

def test_missing_bad_or_expired_token_is_unauthorized(client, created):
    assert client.get("/api/me").status_code == 401
    assert client.get("/api/me", headers=bearer("not-a-jwt")).status_code == 401
    demo = client.post("/api/demo").json()
    created.append(demo["user"]["user_id"])
    expired = jwt.encode({"sub": demo["user"]["user_id"], "exp": now_utc() - timedelta(seconds=1)}, _secret(),
                         algorithm=ALGORITHM)
    assert client.get("/api/me", headers=bearer(expired)).status_code == 401
    forged = jwt.encode({"sub": demo["user"]["user_id"], "exp": now_utc() + timedelta(days=1)}, "wrong-secret-that-is-long-enough-for-hs256",
                        algorithm=ALGORITHM)
    assert client.get("/api/me", headers=bearer(forged)).status_code == 401


def test_logout_revokes_only_the_token_used(client, configured, fake, created):
    first = login(client, created).json()["access_token"]
    second = login(client, created).json()["access_token"]  # 같은 계정의 다른 기기
    assert client.post("/api/auth/logout", headers=bearer(first)).status_code == 204
    assert client.get("/api/me", headers=bearer(first)).status_code == 401
    assert client.post("/api/auth/logout", headers=bearer(first)).status_code == 401  # 이미 폐기
    assert client.get("/api/me", headers=bearer(second)).status_code == 200
    third = login(client, created).json()["access_token"]  # 다시 로그인하면 새 토큰으로 정상
    assert client.get("/api/me", headers=bearer(third)).status_code == 200
    assert client.post("/api/auth/logout").status_code == 401


def test_demo_token_logout_and_isolation(client, created):
    a, b = client.post("/api/demo").json(), client.post("/api/demo").json()
    created.extend([a["user"]["user_id"], b["user"]["user_id"]])
    assert jwt.decode(a["access_token"], options={"verify_signature": False})["jti"]
    assert client.post("/api/auth/logout", headers=bearer(a["access_token"])).status_code == 204
    assert client.get(f"/api/stores/{a['store_id']}/dashboard", headers=bearer(a["access_token"])).status_code == 401
    assert client.get(f"/api/stores/{b['store_id']}/dashboard", headers=bearer(b["access_token"])).status_code == 200


def test_legacy_token_without_jti_works_until_logout(client, created):
    """이 변경 전에 발급한 토큰(jti 없음, 예시 계정 포함)은 만료 전까지 쓸 수 있고, 로그아웃하면 sha256 으로 폐기된다."""
    demo = client.post("/api/demo").json()
    created.append(demo["user"]["user_id"])
    now = now_utc()
    legacy = jwt.encode({"sub": demo["user"]["user_id"], "iat": now, "exp": now + timedelta(days=7)}, _secret(),
                        algorithm=ALGORITHM)
    assert client.get("/api/me", headers=bearer(legacy)).status_code == 200
    assert client.post("/api/auth/logout", headers=bearer(legacy)).status_code == 204
    assert client.get("/api/me", headers=bearer(legacy)).status_code == 401
    assert client.get("/api/me", headers=bearer(demo["access_token"])).status_code == 200  # 새 토큰은 그대로
    with transaction() as session:
        keys = list(session.scalars(select(RevokedToken.token_key).where(
            RevokedToken.user_id == uuid.UUID(demo["user"]["user_id"]))))
    assert len(keys) == 1 and keys[0].startswith("sha256:")


def test_purge_expired_removes_only_expired_records(client, created):
    demo = client.post("/api/demo").json()
    created.append(demo["user"]["user_id"])
    uid, now = uuid.UUID(demo["user"]["user_id"]), now_utc()
    with transaction() as session:
        session.add_all([
            RevokedToken(token_key="jti:expired-test", user_id=uid, expires_at=now - timedelta(minutes=1)),
            RevokedToken(token_key="jti:live-test", user_id=uid, expires_at=now + timedelta(days=1)),
            OAuthState(state="expired-state-test", provider="kakao", redirect_uri=CALLBACK,
                       browser_hash=oauth.browser_hash_of(NONCE), expires_at=now - timedelta(minutes=1)),
            OAuthState(state="live-state-test", provider="kakao", redirect_uri=CALLBACK,
                       browser_hash=oauth.browser_hash_of(NONCE), expires_at=now + timedelta(minutes=5)),
        ])
    with transaction() as session:
        assert purge_expired(session) >= 2
    with transaction() as session:
        assert session.get(RevokedToken, "jti:expired-test") is None and session.get(OAuthState, "expired-state-test") is None
        assert session.get(RevokedToken, "jti:live-test") is not None and session.get(OAuthState, "live-state-test") is not None
        session.execute(delete(OAuthState).where(OAuthState.state == "live-state-test"))


# ---------- PATCH /me ----------

def test_update_name_does_not_touch_store_name(client, created):
    demo = client.post("/api/demo").json()
    created.append(demo["user"]["user_id"])
    headers = bearer(demo["access_token"])
    store_before = client.get(f"/api/stores/{demo['store_id']}", headers=headers).json()["name"]
    res = client.patch("/api/me", headers=headers, json={"name": "  김사장  "})
    assert res.status_code == 200 and res.json()["user"]["name"] == "김사장"
    assert res.json()["store_id"] == demo["store_id"]
    assert client.get("/api/me", headers=headers).json()["user"]["name"] == "김사장"
    assert client.get(f"/api/stores/{demo['store_id']}", headers=headers).json()["name"] == store_before
    for payload in ({"name": "   "}, {"name": "가" * 31}, {"name": "ok", "provider": "kakao"}, {}):
        assert client.patch("/api/me", headers=headers, json=payload).status_code == 400, payload
    with transaction() as session:
        assert session.scalar(select(Store.name).where(Store.id == uuid.UUID(demo["store_id"]))) == store_before
