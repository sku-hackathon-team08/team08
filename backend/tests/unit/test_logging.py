import logging
import re

import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.core.logging import configure_logging


def test_logging_filters_levels_and_does_not_duplicate_output(
    capsys: pytest.CaptureFixture[str], caplog: pytest.LogCaptureFixture
) -> None:
    root_handlers = list(logging.getLogger().handlers)
    uvicorn_handlers = list(logging.getLogger("uvicorn.error").handlers)
    configure_logging("INFO")
    configure_logging("INFO")
    logger = logging.getLogger("app.test")
    logger.debug("hidden detail")
    logger.info("ready")
    output = capsys.readouterr().err
    assert re.fullmatch(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z INFO app.test: ready\n", output
    )
    assert not [record for record in caplog.records if record.name == "app.test"]
    assert logging.getLogger().handlers == root_handlers
    assert logging.getLogger("uvicorn.error").handlers == uvicorn_handlers
    configure_logging("ERROR")
    logger.warning("hidden warning")
    logger.error("failure")
    output = capsys.readouterr().err
    assert output.endswith("ERROR app.test: failure\n")
    assert "hidden warning" not in output
    configure_logging("DEBUG")
    logger.debug("visible detail")
    assert capsys.readouterr().err.endswith("DEBUG app.test: visible detail\n")


def test_log_level_defaults_and_invalid_value(monkeypatch: pytest.MonkeyPatch) -> None:
    assert Settings(_env_file=None).log_level == "INFO"
    monkeypatch.setenv("LOG_LEVEL", "verbose")
    with pytest.raises(ValidationError):
        Settings(_env_file=None)
