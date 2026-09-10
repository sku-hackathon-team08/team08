import logging
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings
from app.models.reports import Analysis
from app.schemas.analysis import AnalysisView
from app.services.entry import Identity
from app.services.errors import ServiceError
from app.services.openai_analysis import OpenAIAnalysis, urgency_from_signals

logger = logging.getLogger(__name__)


async def get_analysis(
    db: AsyncSession, identity: Identity, analysis_id: UUID
) -> Analysis:
    row = await db.scalar(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.actor_id == identity.actor.id,
            Analysis.event_id == identity.event.id,
        )
    )
    if row is None:
        raise ServiceError(404, "NOT_FOUND", "분석을 찾을 수 없습니다.")
    return row


def analysis_view(row: Analysis) -> AnalysisView:
    ready = row.status == "READY"
    return AnalysisView.from_internal(
        id=row.id,
        status=row.status,
        transcript_raw=row.transcript_raw if ready else None,
        content_suggested=row.content_suggested if ready else None,
        type_suggested=row.type_suggested if ready else None,
        urgency_suggested=row.urgency_suggested if ready else None,
        failure_code=row.failure_code,
    )


async def run_analysis(
    sessions: async_sessionmaker[AsyncSession],
    settings: Settings,
    analysis_id: UUID,
    audio: bytes | None = None,
    mime: str = "",
    filename: str = "",
    provider=None,
) -> None:
    async with sessions() as db:
        changed = await db.scalar(
            update(Analysis)
            .where(Analysis.id == analysis_id, Analysis.status == "PENDING")
            .values(status="PROCESSING")
            .returning(Analysis.id)
        )
        if changed is None:
            await db.commit()
            return
        row = await db.get(Analysis, analysis_id)
        assert row is not None
        transcript = row.transcript_raw
        await db.commit()

    # 외부 호출 중에는 요청 세션과 별개인 분석 세션도 연결을 점유하지 않는다.
    stage = "TRANSCRIPTION_FAILED" if audio is not None else "ANALYSIS_FAILED"
    owned = provider is None
    try:
        provider = provider or OpenAIAnalysis(settings)
        if audio is not None:
            transcript = await provider.transcribe(audio, mime, filename)
            async with sessions() as db:
                await db.execute(
                    update(Analysis)
                    .where(Analysis.id == analysis_id)
                    .values(transcript_raw=transcript)
                )
                await db.commit()
        stage = "ANALYSIS_FAILED"
        assert transcript is not None
        result = await provider.analyze(transcript)
        values = {
            "content_suggested": result.summary,
            "type_suggested": result.type,
            "urgency_suggested": urgency_from_signals(result.signals),
            "status": "READY",
        }
    except Exception:
        # 제공자 예외에는 원문·헤더가 포함될 수 있어 원본 예외를 기록하지 않는다.
        logger.warning("신고 분석을 완료하지 못했습니다 (%s).", stage)
        values = {"status": "FAILED", "failure_code": stage}
    finally:
        if owned and provider is not None:
            try:
                await provider.close()
            except Exception:
                logger.warning("OpenAI 연결 정리에 실패했습니다.")
    async with sessions() as db:
        await db.execute(
            update(Analysis).where(Analysis.id == analysis_id).values(**values)
        )
        await db.commit()
