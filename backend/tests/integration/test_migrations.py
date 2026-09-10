import os
import sqlite3
import subprocess
import sys
from pathlib import Path
from uuid import uuid4


def test_migration_upgrade_preserves_existing_event_and_is_repeatable(tmp_path):
    database = tmp_path / "migration.db"
    environment = {**os.environ, "DATABASE_URL": f"sqlite:///{database}"}
    backend = Path(__file__).resolve().parents[2]

    def alembic(*arguments):
        result = subprocess.run(
            [sys.executable, "-m", "alembic", *arguments],
            cwd=backend,
            env=environment,
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0, result.stderr

    alembic("upgrade", "0001")
    event_id = uuid4().hex
    with sqlite3.connect(database) as connection:
        connection.execute(
            "INSERT INTO events (id, name, code, map_id) VALUES (?, ?, ?, ?)",
            (event_id, "보존할 행사", "KEEP", uuid4().hex),
        )
    alembic("upgrade", "head")
    alembic("upgrade", "head")
    alembic("check")
    with sqlite3.connect(database) as connection:
        assert connection.execute("SELECT name FROM events").fetchall() == [
            ("보존할 행사",)
        ]
        assert connection.execute("SELECT count(*) FROM reports").fetchone() == (0,)
