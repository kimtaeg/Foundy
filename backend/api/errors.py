"""에러 응답 형식 { "error": { "code", "message" } } (API 명세서 1장)."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.errors import ServerErrorMiddleware

logger = logging.getLogger(__name__)


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, extra: dict | None = None):
        # extra: error 객체에 덧붙일 필드 (예: 422 ADDRESS_NOT_RESOLVED 의 candidates)
        self.status, self.code, self.message, self.extra = status, code, message, extra or {}


def unauthorized() -> ApiError:
    return ApiError(401, "UNAUTHORIZED", "로그인이 필요합니다.")


def forbidden() -> ApiError:
    return ApiError(403, "FORBIDDEN", "다른 계정의 가게입니다.")


def store_not_found() -> ApiError:
    return ApiError(404, "STORE_NOT_FOUND", "가게를 찾을 수 없습니다.")


def item_not_found() -> ApiError:
    return ApiError(404, "ITEM_NOT_FOUND", "항목을 찾을 수 없습니다.")


def invalid_input(message: str) -> ApiError:
    return ApiError(400, "INVALID_INPUT", message)


def _body(code: str, message: str, extra: dict | None = None) -> dict:
    return {"error": {"code": code, "message": message, **(extra or {})}}


def install(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError):
        return JSONResponse(_body(exc.code, exc.message, exc.extra), status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        first = exc.errors()[0] if exc.errors() else {}
        where = ".".join(str(p) for p in first.get("loc", []) if p != "body")
        message = f"입력값이 올바르지 않습니다: {where}" if where else "입력값이 올바르지 않습니다."
        return JSONResponse(_body("INVALID_INPUT", message), status_code=400)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException):
        code = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}.get(exc.status_code, "HTTP_ERROR")
        return JSONResponse(_body(code, str(exc.detail)), status_code=exc.status_code)

    async def _internal(_: Request, exc: Exception):
        logger.exception("처리하지 못한 오류 (%s)", type(exc).__name__)
        return JSONResponse(_body("INTERNAL_ERROR", "서버 오류가 발생했습니다."), status_code=500)

    # Keep endpoint failures inside CORS so browsers can read their JSON response.
    app.add_middleware(ServerErrorMiddleware, handler=_internal)
