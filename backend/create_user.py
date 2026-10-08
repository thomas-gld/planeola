#!/usr/bin/env python3
"""Interactive: create or list users."""

import asyncio

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from core.security import hash_password
from db import Session, engine
from models import Account, Login, User, UserRole


async def create_user(
    name: str,
    password: str,
    email: str,
    fullname: str,
    role: UserRole,
    account_id: int | None,
    account_name: str = "",
):
    """With no account_id, a new account is created."""
    async with Session() as session, session.begin():
        if account_id is None:
            account = Account(name=account_name or name)
            session.add(account)
            await session.flush()
            account_id = account.id
            print(f"🆕 New account created (ID: {account_id}, Name: {account.name})")
        elif not await session.get(Account, account_id):
            print(f"❌ Account ID={account_id} does not exist.")
            return

        login_row = await session.scalar(
            select(Login).where(func.lower(Login.email) == email.lower())
        )
        if login_row:
            print(f"ℹ️  Existing identity reused for '{email}' (password left unchanged).")
            if await session.scalar(
                select(User).where(User.login_id == login_row.id, User.account_id == account_id)
            ):
                print(f"❌ A user for '{email}' already exists in account {account_id}.")
                return
        else:
            # Verified: the operator set the password, there is no code to confirm.
            login_row = Login(email=email, password=hash_password(password), email_verified=True)
            session.add(login_row)
            await session.flush()

        user = User(
            account_id=account_id, login_id=login_row.id, name=name, fullname=fullname, role=role
        )
        session.add(user)
        await session.flush()
        print(
            f"✅ User '{name}' created (ID: {user.id}, Account: {account_id}, Role: {role.value})"
        )


async def list_users():
    async with Session() as session:
        users = (await session.scalars(select(User).options(selectinload(User.login)))).all()
    if not users:
        print("No user in the database.")
        return
    print(f"\n📋 User list ({len(users)}):")
    for u in users:
        print(
            f"  - ID: {u.id} | Name: {u.name} | Email: {u.login.email} | "
            f"Full name: {u.fullname or '(empty)'} | Role: {u.role.value} | Account: {u.account_id}"
        )


def ask(prompt: str) -> str:
    value = input(prompt).strip()
    if not value:
        raise SystemExit("❌ This value cannot be empty.")
    return value


async def main():
    print("=== User management ===\n")
    print("1. Create a new user\n2. List existing users\n3. Quit")
    choice = input("\nYour choice (1-3): ").strip()

    if choice == "1":
        name = ask("Username: ")
        email = ask("Email: ")
        password = ask("Password: ")
        fullname = input("Full name (optional): ").strip()
        role = {"1": UserRole.admin, "2": UserRole.member}.get(
            input("\nRole (1 = admin, 2 = member): ").strip()
        )
        if not role:
            raise SystemExit("❌ Invalid role.")

        account_input = input("\nExisting account ID (empty = new account): ").strip()
        if account_input:
            if not account_input.isdigit():
                raise SystemExit("❌ Invalid account ID.")
            await create_user(name, password, email, fullname, role, int(account_input))
        else:
            account_name = input("New account name: ").strip()
            await create_user(name, password, email, fullname, role, None, account_name)
    elif choice == "2":
        await list_users()
    elif choice != "3":
        print("❌ Invalid choice.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
