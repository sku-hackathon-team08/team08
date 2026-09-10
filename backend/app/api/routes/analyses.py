import hashlib
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Request
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from starlette.datastructures import UploadFile
from starlette.responses import JSONResponse

from app.api.contract import ContractRoute
from app.api.idempotency import idempotency_key, json_fingerprint_input
from app.api.identity import CurrentIdentity, Db
from app.models.reports import Analysis
from app.schemas.analysis import AnalysisCreated, AnalysisInput, AnalysisView
from app.schemas.errors import ServiceErrorResponse
from app.schemas.reports import ResourceId
from app.schemas.validation import ValidationErrorResponse
from app.services.analyses import analysis_view, get_analysis, run_analysis
from app.services.errors import ServiceError
from app.services.idempotency import StoredResponse, execute_once, fingerprint

router = APIRouter(
    prefix="/api/v1/report-analyses",
    tags=["analyses"],
    route_class=ContractRoute,
    responses={
        **{
            status: {"model": ServiceErrorResponse}
            for status in [401, 403, 404, 409, 413, 415]
        },
        422: {"model": ValidationErrorResponse},
    },
)
AUDIO_MIMES = {
    "audio/mpeg": "audio.mp3",
    "audio/mp4": "audio.m4a",
    "audio/x-m4a": "audio.m4a",
    "audio/wav": "audio.wav",
    "audio/x-wav": "audio.wav",
    "audio/webm": "audio.webm",
    "video/webm": "audio.webm",
    "video/mp4": "audio.mp4",
}
MAX_AUDIO_BYTES = 10 * 1024 * 1024


@router.post(
    "",
    status_code=202,
    response_model=AnalysisCreated,
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/json": {"schema": AnalysisInput.model_json_schema()},
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "required": ["inputMethod", "audio"],
                        "additionalProperties": False,
                        "properties": {
                            "inputMethod": {"type": "string", "enum": ["VOICE"]},
                            "audio": {"type": "string", "format": "binary"},
                        },
                    }
                },
            },
        }
    },
)
async def create_analysis(
    request: Request, identity: CurrentIdentity, background: BackgroundTasks
) -> JSONResponse:
    key = idempotency_key(request)
    content_type = (
        request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    )
    audio, text, mime, filename = None, None, "", ""
    if content_type == "application/json":
        try:
            data = AnalysisInput.model_validate_json(await request.body())
        except ValidationError as exc:
            raise RequestValidationError(
                [{**error, "loc": ("body", *error["loc"])} for error in exc.errors()]
            ) from None
        text, method = data.text, "TEXT"
        request_fingerprint = fingerprint(await json_fingerprint_input(request))
    elif content_type == "multipart/form-data":
        if identity.actor.role != "STAFF":
            raise ServiceError(403, "FORBIDDEN", "관리자는 텍스트 분석을 사용해주세요.")
        async with request.form(
            max_files=100, max_fields=100, max_part_size=MAX_AUDIO_BYTES
        ) as form:
            field_errors = []
            for name in set(form) - {"inputMethod", "audio"}:
                field_errors.append(
                    {
                        "type": "extra_forbidden",
                        "loc": ("body", name),
                        "msg": "미등록 입력",
                    }
                )
            for name in {"inputMethod", "audio"}:
                if name not in form:
                    field_errors.append(
                        {"type": "missing", "loc": ("body", name), "msg": "필수 입력"}
                    )
                elif len(form.getlist(name)) != 1:
                    field_errors.append(
                        {
                            "type": "duplicate_field",
                            "loc": ("body", name),
                            "msg": "중복 입력",
                        }
                    )
            if "inputMethod" in form and form.get("inputMethod") != "VOICE":
                field_errors.append(
                    {
                        "type": "value_error",
                        "loc": ("body", "inputMethod"),
                        "msg": "VOICE 필요",
                    }
                )
            if "audio" in form and not isinstance(form.get("audio"), UploadFile):
                field_errors.append(
                    {"type": "bytes_type", "loc": ("body", "audio"), "msg": "파일 필요"}
                )
            if field_errors:
                raise RequestValidationError(field_errors)
            uploaded = form["audio"]
            assert isinstance(uploaded, UploadFile)
            mime = uploaded.content_type or ""
            if mime not in AUDIO_MIMES:
                raise ServiceError(
                    415,
                    "UNSUPPORTED_MEDIA_TYPE",
                    "지원하는 오디오 파일을 업로드해주세요.",
                )
            filename = AUDIO_MIMES[mime]
            audio = await uploaded.read(MAX_AUDIO_BYTES + 1)
            if len(audio) > MAX_AUDIO_BYTES:
                raise ServiceError(
                    413, "AUDIO_TOO_LARGE", "음성은 최대 10MB까지 업로드할 수 있습니다."
                )
            if not audio:
                raise RequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "audio"),
                            "msg": "음성 파일이 비어 있습니다.",
                        }
                    ]
                )
        method = "VOICE"
        request_fingerprint = fingerprint(
            {
                "inputMethod": method,
                "audioHash": hashlib.sha256(audio).hexdigest(),
                "mime": mime,
            }
        )
    else:
        raise ServiceError(
            415,
            "UNSUPPORTED_MEDIA_TYPE",
            "JSON 또는 multipart 음성 입력을 사용해주세요.",
        )
    created_id = None

    async def operation(db):
        nonlocal created_id
        created_id = uuid4()
        db.add(
            Analysis(
                id=created_id,
                actor_id=identity.actor.id,
                event_id=identity.event.id,
                input_method=method,
                transcript_raw=text,
            )
        )
        return StoredResponse(
            202,
            {"id": str(created_id), "status": "PENDING"},
            {"Location": f"/api/v1/report-analyses/{created_id}"},
        )

    sessions = request.app.state.database.sessions
    result = await execute_once(
        sessions,
        f"{identity.event.id}:{identity.actor.id}:{request.url.path}",
        key,
        request_fingerprint,
        operation,
    )
    if created_id is not None:
        background.add_task(
            run_analysis,
            sessions,
            request.app.state.settings,
            created_id,
            audio,
            mime,
            filename,
            getattr(request.app.state, "analysis_provider", None),
        )
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)


@router.get("/{analysis_id}", response_model=AnalysisView)
async def read_analysis(
    analysis_id: ResourceId, identity: CurrentIdentity, db: Db
) -> AnalysisView:
    return analysis_view(await get_analysis(db, identity, analysis_id))
