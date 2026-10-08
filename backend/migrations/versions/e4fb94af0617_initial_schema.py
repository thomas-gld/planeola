from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e4fb94af0617"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "accounts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.Text(), server_default="", nullable=False),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("accounts_pkey")),
    )
    op.create_table(
        "logins",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("password", sa.Text(), nullable=False),
        sa.Column("default_user_id", sa.Integer(), nullable=True),
        sa.Column("email_verified", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("verification_code", sa.Text(), nullable=True),
        sa.Column("verification_expires_at", sa.DateTime(), nullable=True),
        sa.Column("verification_attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("reset_token", sa.Text(), nullable=True),
        sa.Column("reset_expires_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("logins_pkey")),
        sa.UniqueConstraint("default_user_id", name=op.f("logins_default_user_id_key")),
        sa.UniqueConstraint("email", name=op.f("logins_email_key")),
    )
    op.create_index(op.f("logins_reset_token_idx"), "logins", ["reset_token"], unique=False)
    op.create_table(
        "holidays",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["accounts.id"],
            name=op.f("holidays_account_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("holidays_pkey")),
        sa.UniqueConstraint("account_id", "date", name=op.f("holidays_account_id_date_key")),
    )
    op.create_table(
        "options",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("key", sa.Text(), nullable=False),
        sa.Column("value", sa.Text(), server_default="", nullable=False),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["accounts.id"],
            name=op.f("options_account_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("options_pkey")),
        sa.UniqueConstraint("account_id", "key", name=op.f("options_account_id_key_key")),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("login_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.Text(), server_default="", nullable=False),
        sa.Column("fullname", sa.Text(), server_default="", nullable=False),
        sa.Column("role", sa.Enum("admin", "member", name="user_role"), nullable=False),
        sa.ForeignKeyConstraint(
            ["account_id"], ["accounts.id"], name=op.f("users_account_id_fkey"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["login_id"], ["logins.id"], name=op.f("users_login_id_fkey"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("users_pkey")),
        sa.UniqueConstraint(
            "account_id", "login_id", "role", name=op.f("users_account_id_login_id_role_key")
        ),
    )
    op.create_index(op.f("users_login_id_idx"), "users", ["login_id"], unique=False)
    # logins and users reference each other: this side waits for users to exist.
    op.create_foreign_key(
        op.f("logins_default_user_id_fkey"),
        "logins",
        "users",
        ["default_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_table(
        "members",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("last_name", sa.Text(), nullable=False),
        sa.Column("first_name", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), server_default="", nullable=False),
        sa.Column("phone", sa.Text(), server_default="", nullable=False),
        sa.Column("categories", sa.ARRAY(sa.Text()), server_default="{}", nullable=True),
        sa.Column("resigned", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("departure_date", sa.Text(), server_default="", nullable=False),
        sa.Column("availability_notes", sa.Text(), server_default="", nullable=False),
        sa.Column("observations", sa.Text(), server_default="", nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("availability_calendar", sa.Text(), server_default="", nullable=False),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["accounts.id"],
            name=op.f("members_account_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("members_user_id_fkey"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("members_pkey")),
        sa.UniqueConstraint("user_id", name=op.f("members_user_id_key")),
    )
    op.create_index(op.f("members_account_id_idx"), "members", ["account_id"], unique=False)
    op.create_index(
        op.f("members_last_name_first_name_idx"),
        "members",
        ["last_name", "first_name"],
        unique=False,
    )
    op.create_index(op.f("members_resigned_idx"), "members", ["resigned"], unique=False)
    op.create_table(
        "assignments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Text(), nullable=False),
        sa.Column("time_slot", sa.Text(), nullable=False),
        sa.Column("category", sa.Text(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["accounts.id"],
            name=op.f("assignments_account_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["member_id"],
            ["members.id"],
            name=op.f("assignments_member_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("assignments_pkey")),
        sa.UniqueConstraint(
            "date",
            "time_slot",
            "category",
            "member_id",
            name=op.f("assignments_date_time_slot_category_member_id_key"),
        ),
    )
    op.create_index(op.f("assignments_account_id_idx"), "assignments", ["account_id"], unique=False)
    op.create_index(op.f("assignments_member_id_idx"), "assignments", ["member_id"], unique=False)
    op.create_table(
        "availability_submissions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column("dates", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["accounts.id"],
            name=op.f("availability_submissions_account_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["member_id"],
            ["members.id"],
            name=op.f("availability_submissions_member_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("availability_submissions_pkey")),
    )
    op.create_index(
        op.f("availability_submissions_account_id_idx"),
        "availability_submissions",
        ["account_id"],
        unique=False,
    )
    op.create_index(
        op.f("availability_submissions_created_at_idx"),
        "availability_submissions",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("availability_submissions_member_id_idx"),
        "availability_submissions",
        ["member_id"],
        unique=False,
    )
    op.create_table(
        "invitations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column(
            "role",
            sa.Enum("admin", "member", name="user_role"),
            server_default="member",
            nullable=False,
        ),
        sa.Column("invited_by_email", sa.Text(), server_default="", nullable=False),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["accounts.id"],
            name=op.f("invitations_account_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["member_id"],
            ["members.id"],
            name=op.f("invitations_member_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("invitations_pkey")),
        sa.UniqueConstraint("member_id", name=op.f("invitations_member_id_key")),
    )
    op.create_index(op.f("invitations_account_id_idx"), "invitations", ["account_id"], unique=False)
    op.create_index(op.f("invitations_email_idx"), "invitations", ["email"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("invitations_email_idx"), table_name="invitations")
    op.drop_index(op.f("invitations_account_id_idx"), table_name="invitations")
    op.drop_table("invitations")
    op.drop_index(
        op.f("availability_submissions_member_id_idx"), table_name="availability_submissions"
    )
    op.drop_index(
        op.f("availability_submissions_created_at_idx"), table_name="availability_submissions"
    )
    op.drop_index(
        op.f("availability_submissions_account_id_idx"), table_name="availability_submissions"
    )
    op.drop_table("availability_submissions")
    op.drop_index(op.f("assignments_member_id_idx"), table_name="assignments")
    op.drop_index(op.f("assignments_account_id_idx"), table_name="assignments")
    op.drop_table("assignments")
    op.drop_index(op.f("members_resigned_idx"), table_name="members")
    op.drop_index(op.f("members_last_name_first_name_idx"), table_name="members")
    op.drop_index(op.f("members_account_id_idx"), table_name="members")
    op.drop_table("members")
    op.drop_constraint(op.f("logins_default_user_id_fkey"), "logins", type_="foreignkey")
    op.drop_index(op.f("users_login_id_idx"), table_name="users")
    op.drop_table("users")
    op.drop_table("options")
    op.drop_table("holidays")
    op.drop_index(op.f("logins_reset_token_idx"), table_name="logins")
    op.drop_table("logins")
    op.drop_table("accounts")
    sa.Enum(name="user_role").drop(op.get_bind())
