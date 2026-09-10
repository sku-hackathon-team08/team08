"""행사·행위자·세션과 영속 멱등 결과 저장."""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("code", sa.String(64), nullable=False, unique=True),
        sa.Column("map_id", sa.Uuid(), nullable=False),
    )
    op.create_table(
        "actors",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("event_id", sa.Uuid(), sa.ForeignKey("events.id"), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("team", sa.String(100), nullable=True),
    )
    op.create_index("ix_actors_event_id", "actors", ["event_id"])
    op.create_table(
        "login_sessions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("actor_id", sa.Uuid(), sa.ForeignKey("actors.id"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("revoked", sa.Boolean(), nullable=False),
    )
    op.create_index("ix_login_sessions_actor_id", "login_sessions", ["actor_id"])
    op.create_table(
        "idempotency_records",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("scope", sa.String(512), nullable=False),
        sa.Column("key", sa.String(36), nullable=False),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("status", sa.Integer(), nullable=True),
        sa.Column("body", sa.JSON(), nullable=True),
        sa.Column("headers", sa.JSON(), nullable=True),
        sa.UniqueConstraint("scope", "key", name="uq_idempotency_scope_key"),
    )


def downgrade():
    op.drop_table("idempotency_records")
    op.drop_table("login_sessions")
    op.drop_table("actors")
    op.drop_table("events")
