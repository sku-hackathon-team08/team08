import logging
import time


def configure_logging(level: str) -> None:
    """프로세스 공통 앱 로그 설정. Uvicorn·외부 라이브러리 설정은 유지."""
    logger = logging.getLogger("app")
    logger.setLevel(level)
    logger.propagate = False
    if not any(handler.name == "team08_console" for handler in logger.handlers):
        handler = logging.StreamHandler()
        handler.set_name("team08_console")
        formatter = logging.Formatter(
            "%(asctime)sZ %(levelname)s %(name)s: %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S",
        )
        formatter.converter = time.gmtime
        handler.setFormatter(formatter)
        logger.addHandler(handler)
