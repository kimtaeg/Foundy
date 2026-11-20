"""소셜 로그인 (인가 코드 방식). 제공자 공식 문서 기준 (2026-11-21 확인):

- 카카오: developers.kakao.com 카카오 로그인 REST API
  인가 GET kauth.kakao.com/oauth/authorize (client_id·redirect_uri·response_type=code 필수, state 는 CSRF 방지 권장)
  토큰 POST kauth.kakao.com/oauth/token form (grant_type·client_id·redirect_uri·code, 클라이언트 시크릿 사용 시 client_secret)
  사용자 GET kapi.kakao.com/v2/user/me (Bearer) → id, kakao_account.profile.nickname
- Google: developers.google.com OAuth 2.0 웹 서버 앱 / OpenID Connect
  인가 GET accounts.google.com/o/oauth2/v2/auth (client_id·redirect_uri·response_type=code·scope 필수, state 권장)
  토큰 POST oauth2.googleapis.com/token form (code·client_id·client_secret·redirect_uri·grant_type)
  사용자 GET openidconnect.googleapis.com/v1/userinfo (Bearer) → sub, name
- 네이버: naver/naver-openapi-guide ko/login/devguide (네아로 일반 방식)
  인가 GET nid.naver.com/oauth2.0/authorize (response_type·client_id·redirect_uri·state 모두 필수)
  토큰 nid.naver.com/oauth2.0/token (grant_type·client_id·client_secret·code·state 필수, redirect_uri 없음)
  사용자 GET openapi.naver.com/v1/nid/me (Bearer) → response.id, response.nickname / response.name

redirect_uri 는 서버 허용 목록(OAUTH_REDIRECT_URIS)에 있는 값만 쓰고, 제공자 콘솔에 등록한 값과 정확히 같아야 한다.
state 는 로그인 시작(start) 때 서버가 발급·저장하고, 콜백에서 받은 값과 대조한 뒤 1회만 쓴다 (10분).

브라우저 결속 (Foundy 자체 방식. 제공자 OAuth 의 PKCE 와는 별개):
프론트가 로그인마다 32바이트 browser_nonce 를 만들어 SHA-256 해시만 start 에 보내고, 원본은 콜백 때 요청 본문으로 보낸다.
서버는 해시를 state 와 함께 저장하고 콜백에서 비교한다. 결속에 실패하면 제공자를 부르지 않고 400 INVALID_STATE 이며
state 를 소비하지 않는다 (원래 브라우저가 계속 로그인할 수 있게). 결속이 확인된 요청만 잠금 후 state 를 1회 소비한다.
"""

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import timedelta
from urllib.parse import urlencode

import httpx
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from api.errors import ApiError
from config import get_settings
from db.models import OAuthState
from services.timeutil import now_utc

STATE_TTL = timedelta(minutes=10)
TIMEOUT = httpx.Timeout(10.0)
PROVIDERS = ("kakao", "google", "naver")


@dataclass(frozen=True)
class ProviderSpec:
    authorize_url: str
    token_url: str
    userinfo_url: str
    scope: str | None = None


SPECS = {
    "kakao": ProviderSpec("https://kauth.kakao.com/oauth/authorize", "https://kauth.kakao.com/oauth/token",
                          "https://kapi.kakao.com/v2/user/me"),
    "google": ProviderSpec("https://accounts.google.com/o/oauth2/v2/auth", "https://oauth2.googleapis.com/token",
                           "https://openidconnect.googleapis.com/v1/userinfo", scope="openid profile"),
    "naver": ProviderSpec("https://nid.naver.com/oauth2.0/authorize", "https://nid.naver.com/oauth2.0/token",
                          "https://openapi.naver.com/v1/nid/me"),
}


@dataclass(frozen=True)
class SocialProfile:
    provider: str
    provider_user_id: str
    name: str | None


def invalid_state() -> ApiError:
    return ApiError(400, "INVALID_STATE", "로그인 요청이 만료됐거나 올바르지 않습니다. 처음부터 다시 로그인해 주세요.")


def login_failed() -> ApiError:
    return ApiError(401, "SOCIAL_LOGIN_FAILED", "소셜 로그인에 실패했습니다. 다시 시도해 주세요.")


def provider_unavailable() -> ApiError:
    return ApiError(502, "SOCIAL_PROVIDER_UNAVAILABLE", "소셜 로그인 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.")


def not_configured() -> ApiError:
    return ApiError(503, "SOCIAL_LOGIN_UNAVAILABLE", "이 로그인 방식은 아직 사용할 수 없습니다.")


def _credentials(provider: str) -> tuple[str, str]:
    settings = get_settings()
    client_id = getattr(settings, f"{provider}_client_id")
    secret = getattr(settings, f"{provider}_client_secret")
    # 카카오는 시크릿을 끌 수 있지만 Google·네이버 토큰 교환에는 client_secret 이 필요하다
    if not client_id or (provider != "kakao" and not secret):
        raise not_configured()
    return client_id, secret


def choose_redirect_uri(requested: str | None) -> str:
    allowed = get_settings().redirect_uris
    if not allowed:
        raise not_configured()
    if requested is None:
        return allowed[0]
    if requested not in allowed:  # 정확히 같은 값만 (스킴·대소문자·끝 슬래시 포함)
        raise ApiError(400, "INVALID_INPUT", "허용되지 않은 redirect_uri 입니다.")
    return requested


def browser_hash_of(browser_nonce: str) -> str:
    return hashlib.sha256(browser_nonce.encode("ascii")).hexdigest()


def start_login(session: Session, provider: str, redirect_uri: str | None, browser_hash: str) -> dict:
    """state 를 발급하고 브라우저 결속 해시와 함께 저장한 뒤 제공자 인가 주소를 돌려준다. 커밋은 호출하는 쪽."""
    client_id, _ = _credentials(provider)
    uri = choose_redirect_uri(redirect_uri)
    state = secrets.token_urlsafe(32)
    session.add(OAuthState(state=state, provider=provider, redirect_uri=uri, browser_hash=browser_hash,
                           expires_at=now_utc() + STATE_TTL))
    spec = SPECS[provider]
    params = {"response_type": "code", "client_id": client_id, "redirect_uri": uri, "state": state}
    if spec.scope:
        params["scope"] = spec.scope
    return {"provider": provider, "state": state, "redirect_uri": uri,
            "authorize_url": f"{spec.authorize_url}?{urlencode(params)}",
            "expires_in": int(STATE_TTL.total_seconds())}


def consume_state(session: Session, provider: str, state: str, browser_nonce: str) -> str:
    """발급한 state 와 브라우저 결속을 대조하고 지운다(1회용). 저장된 redirect_uri 를 돌려준다.

    행을 잠근 뒤 확인하므로 같은 state 의 동시 콜백은 한 건만 통과한다 (뒤 요청은 행이 없어 거절).
    """
    row = session.scalar(select(OAuthState).where(OAuthState.state == state).with_for_update())
    if row is None:
        raise invalid_state()
    if not hmac.compare_digest(browser_hash_of(browser_nonce), row.browser_hash):
        # 다른 브라우저: 소비하지 않고 거절 (예외로 롤백되며 잠금이 풀린다)
        raise invalid_state()
    session.execute(delete(OAuthState).where(OAuthState.state == state))
    # 대조에 실패해도 다시 쓸 수 없게 먼저 커밋한다 (외부 호출 전에 잠금도 푼다)
    session.commit()
    if row.provider != provider or row.expires_at <= now_utc():
        raise invalid_state()
    return row.redirect_uri


def http_client() -> httpx.Client:
    """테스트가 바꿔 끼운다 (httpx.MockTransport)."""
    return httpx.Client(timeout=TIMEOUT)


def _json(response: httpx.Response) -> dict:
    try:
        body = response.json()
    except ValueError:
        body = None
    return body if isinstance(body, dict) else {}


def _post_token(client: httpx.Client, provider: str, code: str, state: str, redirect_uri: str) -> str:
    client_id, secret = _credentials(provider)
    spec = SPECS[provider]
    data = {"grant_type": "authorization_code", "client_id": client_id, "code": code}
    if provider == "naver":
        data.update(client_secret=secret, state=state)  # 네아로 일반 방식: state 필수, redirect_uri 없음
    else:
        data["redirect_uri"] = redirect_uri  # 인가 요청과 같은 값
        if secret:
            data["client_secret"] = secret
    try:
        response = client.post(spec.token_url, data=data, headers={"Accept": "application/json"})
    except httpx.HTTPError as exc:
        raise provider_unavailable() from exc
    if response.status_code >= 500:
        raise provider_unavailable()
    body = _json(response)
    # 잘못된·만료된·재사용한 코드: 카카오 KOE320(invalid_grant), Google invalid_grant, 네이버 error 필드
    if response.status_code >= 400 or body.get("error") or not body.get("access_token"):
        raise login_failed()
    return body["access_token"]


def _get_profile(client: httpx.Client, provider: str, access_token: str) -> SocialProfile:
    try:
        response = client.get(SPECS[provider].userinfo_url, headers={"Authorization": f"Bearer {access_token}"})
    except httpx.HTTPError as exc:
        raise provider_unavailable() from exc
    if response.status_code >= 500:
        raise provider_unavailable()
    if response.status_code >= 400:
        raise login_failed()
    body = _json(response)
    if provider == "kakao":
        uid, name = body.get("id"), ((body.get("kakao_account") or {}).get("profile") or {}).get("nickname")
    elif provider == "google":
        uid, name = body.get("sub"), body.get("name")
    else:
        inner = body.get("response") or {}
        uid, name = inner.get("id"), inner.get("nickname") or inner.get("name")
    if uid in (None, ""):
        raise login_failed()
    return SocialProfile(provider, str(uid), (name or "").strip() or None)


def exchange_code(provider: str, code: str, state: str, redirect_uri: str) -> SocialProfile:
    with http_client() as client:
        token = _post_token(client, provider, code, state, redirect_uri)
        return _get_profile(client, provider, token)
