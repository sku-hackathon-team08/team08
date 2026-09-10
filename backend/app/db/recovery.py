from sqlalchemy import inspect, update

from app.db.session import Database
from app.models.reports import Analysis


async def recover_interrupted_analyses(database: Database) -> None:
    """단일 앱 프로세스 시작 때 중단된 분석을 실패 처리. 외부 호출은 재실행하지 않는다."""
    async with database.engine.connect() as connection:
        exists = await connection.run_sync(
            lambda sync: inspect(sync).has_table("analyses")
        )
    if exists:
        async with database.sessions() as db:
            await db.execute(
                update(Analysis)
                .where(Analysis.status.in_(["PENDING", "PROCESSING"]))
                .values(status="FAILED", failure_code="ANALYSIS_INTERRUPTED")
            )
            await db.commit()
