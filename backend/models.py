"""Constraint and index names come from the naming convention on `Base`.
DateTime columns are naive and hold UTC."""

import enum
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    ARRAY,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def as_utc(value: Any) -> Any:
    if isinstance(value, datetime) and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


class Base(DeclarativeBase):
    metadata = MetaData(
        naming_convention={
            "pk": "%(table_name)s_pkey",
            "fk": "%(table_name)s_%(column_0_N_name)s_fkey",
            "uq": "%(table_name)s_%(column_0_N_name)s_key",
            "ix": "%(table_name)s_%(column_0_N_name)s_idx",
            "ck": "%(table_name)s_%(constraint_name)s_check",
        }
    )

    def to_dict(self) -> dict[str, Any]:
        """Columns only, no relations."""
        return {c.key: as_utc(getattr(self, c.key)) for c in self.__table__.columns}


class UserRole(str, enum.Enum):
    admin = "admin"
    member = "member"


# Store the values ("admin"), not the Python member names.
_user_role = Enum(UserRole, name="user_role", values_callable=lambda e: [m.value for m in e])


class Account(Base):
    """One organization."""

    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(Text, server_default="", default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp()
    )

    users: Mapped[list["User"]] = relationship(back_populates="account")
    members: Mapped[list["Member"]] = relationship(back_populates="account")


class Login(Base):
    """One person's credentials, global."""

    __tablename__ = "logins"
    __table_args__ = (
        UniqueConstraint("email"),
        UniqueConstraint("default_user_id"),
        Index(None, "reset_token"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(Text)
    password: Mapped[str] = mapped_column(Text)
    default_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL", use_alter=True)
    )

    email_verified: Mapped[bool] = mapped_column(Boolean, server_default="false", default=False)
    verification_code: Mapped[str | None] = mapped_column(Text)  # bcrypt
    verification_expires_at: Mapped[datetime | None] = mapped_column(DateTime)
    verification_attempts: Mapped[int] = mapped_column(Integer, server_default="0", default=0)

    # SHA-256 digest of the link token.
    reset_token: Mapped[str | None] = mapped_column(Text)
    reset_expires_at: Mapped[datetime | None] = mapped_column(DateTime)

    users: Mapped[list["User"]] = relationship(
        back_populates="login", foreign_keys="User.login_id"
    )
    default_user: Mapped["User | None"] = relationship(foreign_keys=[default_user_id])


class User(Base):
    """One Login's membership, with one role, in one organization."""

    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("account_id", "login_id", "role"),
        Index(None, "login_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE")
    )
    login_id: Mapped[int] = mapped_column(
        ForeignKey("logins.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(Text, server_default="", default="")
    fullname: Mapped[str] = mapped_column(Text, server_default="", default="")
    role: Mapped[UserRole] = mapped_column(_user_role)

    account: Mapped["Account"] = relationship(back_populates="users")
    login: Mapped["Login"] = relationship(back_populates="users", foreign_keys=[login_id])
    member: Mapped["Member | None"] = relationship(
        back_populates="user", foreign_keys="Member.user_id"
    )


class Member(Base):
    """Someone who can be scheduled. Linked to a User once an invitation is accepted."""

    __tablename__ = "members"
    __table_args__ = (
        UniqueConstraint("user_id"),
        Index(None, "account_id"),
        Index(None, "resigned"),
        Index(None, "last_name", "first_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE")
    )
    last_name: Mapped[str] = mapped_column(Text)
    first_name: Mapped[str] = mapped_column(Text)
    email: Mapped[str] = mapped_column(Text, server_default="", default="")
    phone: Mapped[str] = mapped_column(Text, server_default="", default="")
    # The first one decides scheduling.
    categories: Mapped[list[str] | None] = mapped_column(
        ARRAY(Text), server_default="{}", default=list
    )
    resigned: Mapped[bool] = mapped_column(Boolean, server_default="false", default=False)
    departure_date: Mapped[str] = mapped_column(Text, server_default="", default="")
    availability_notes: Mapped[str] = mapped_column(Text, server_default="", default="")
    observations: Mapped[str] = mapped_column(Text, server_default="", default="")
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    # JSON [{"date", "time_slot"}]
    availability_calendar: Mapped[str] = mapped_column(Text, server_default="", default="")

    account: Mapped["Account"] = relationship(back_populates="members")
    user: Mapped["User | None"] = relationship(back_populates="member", foreign_keys=[user_id])
    invitation: Mapped["Invitation | None"] = relationship(back_populates="member")


class Invitation(Base):
    """Deleted once accepted or declined."""

    __tablename__ = "invitations"
    __table_args__ = (
        UniqueConstraint("member_id"),
        Index(None, "account_id"),
        Index(None, "email"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE")
    )
    member_id: Mapped[int] = mapped_column(
        ForeignKey("members.id", ondelete="CASCADE")
    )
    email: Mapped[str] = mapped_column(Text)
    role: Mapped[UserRole] = mapped_column(
        _user_role, server_default="member", default=UserRole.member
    )
    invited_by_email: Mapped[str] = mapped_column(Text, server_default="", default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp()
    )

    account: Mapped["Account"] = relationship()
    member: Mapped["Member"] = relationship(back_populates="invitation")


class Assignment(Base):
    __tablename__ = "assignments"
    __table_args__ = (
        UniqueConstraint("date", "time_slot", "category", "member_id"),
        Index(None, "account_id"),
        Index(None, "member_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE")
    )
    date: Mapped[str] = mapped_column(Text)  # "YYYY-MM-DD"
    time_slot: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(Text)
    member_id: Mapped[int] = mapped_column(
        ForeignKey("members.id", ondelete="CASCADE")
    )


class AvailabilitySubmission(Base):
    """Deleted once validated or ignored."""

    __tablename__ = "availability_submissions"
    __table_args__ = (
        Index(None, "account_id"),
        Index(None, "member_id"),
        Index(None, "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE")
    )
    member_id: Mapped[int] = mapped_column(
        ForeignKey("members.id", ondelete="CASCADE")
    )
    # JSON [{"date", "time_slot"}]
    dates: Mapped[str] = mapped_column(Text)
    # Always "pending": nothing ever writes another value.
    status: Mapped[str] = mapped_column(Text)
    message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp()
    )

    member: Mapped["Member"] = relationship()


class Holiday(Base):
    """A date forced closed."""

    __tablename__ = "holidays"
    __table_args__ = (
        UniqueConstraint("account_id", "date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE")
    )
    date: Mapped[str] = mapped_column(Text)  # "YYYY-MM-DD"


class Option(Base):
    """Non-string values are stored as JSON."""

    __tablename__ = "options"
    __table_args__ = (
        UniqueConstraint("account_id", "key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE")
    )
    key: Mapped[str] = mapped_column(Text)
    value: Mapped[str] = mapped_column(Text, server_default="", default="")
