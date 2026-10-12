"""Initial ciphertext metadata schema."""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "shares",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("upload_hash", sa.String(64), nullable=False),
        sa.Column("download_hash", sa.String(64), nullable=False),
        sa.Column("chunks", sa.Integer(), nullable=False),
        sa.Column("bytes_limit", sa.BigInteger(), nullable=False),
        sa.Column("expires", sa.Float(), nullable=False),
        sa.Column("ready", sa.Boolean(), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False),
    )
    op.create_table(
        "chunks",
        sa.Column("share_id", sa.String(64), primary_key=True),
        sa.Column("index", sa.Integer(), primary_key=True),
        sa.Column("digest", sa.String(64), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
    )


def downgrade():
    op.drop_table("chunks")
    op.drop_table("shares")
