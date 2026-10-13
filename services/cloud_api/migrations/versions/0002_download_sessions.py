"""Optional bounded download sessions, counted when a session is issued."""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("shares", sa.Column("download_limit", sa.Integer(), nullable=True))
    op.add_column(
        "shares",
        sa.Column("downloads", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "download_leases",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column("share_id", sa.String(64), nullable=False),
        sa.Column("expires", sa.Float(), nullable=False),
    )
    op.create_index("ix_download_leases_share_id", "download_leases", ["share_id"])


def downgrade():
    op.drop_table("download_leases")
    op.drop_column("shares", "downloads")
    op.drop_column("shares", "download_limit")
