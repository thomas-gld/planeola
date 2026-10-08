import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.options import org_today
from core.security import get_account_id, get_current_user, require_admin
from db import SessionDep
from models import Assignment, AvailabilitySubmission, Member
from schemas import AvailabilitySubmissionCreate

router = APIRouter(prefix="/api")


def _dates(text: str) -> list[dict]:
    """A submission's or calendar's JSON date list, without malformed entries."""
    try:
        parsed = json.loads(text or "[]")
    except json.JSONDecodeError:
        return []
    return [d for d in parsed if isinstance(d, dict)] if isinstance(parsed, list) else []


def _slots(dates: list[dict]) -> set[tuple[str, str]]:
    return {(d["date"], d["time_slot"]) for d in dates if d.get("date") and d.get("time_slot")}


def _category(member: Member) -> str:
    # The first category decides scheduling, as in the frontend.
    return member.categories[0] if member.categories else "member"


async def _future_assignments(session: AsyncSession, member: Member, today: str) -> list:
    return list(
        await session.scalars(
            select(Assignment).where(
                Assignment.member_id == member.id,
                Assignment.category == _category(member),
                Assignment.date >= today,
            )
        )
    )


async def _resync_calendar(session: AsyncSession, member: Member, today: str) -> None:
    """For a submission never applied: future slots rebuilt from the schedule, past ones kept."""
    past = [d for d in _dates(member.availability_calendar) if d.get("date", "") < today]
    assignments = await _future_assignments(session, member, today)
    future = [
        {"date": d, "time_slot": t} for d, t in sorted((a.date, a.time_slot) for a in assignments)
    ]
    member.availability_calendar = json.dumps(past + future)


async def _current_member(session: AsyncSession, current_user: dict) -> Member | None:
    return await session.scalar(select(Member).where(Member.user_id == current_user.get("user_id")))


async def _find_submission(
    session: AsyncSession, submission_id: int, current_user: dict
) -> AvailabilitySubmission:
    submission = await session.scalar(
        select(AvailabilitySubmission)
        .where(AvailabilitySubmission.id == submission_id)
        .options(selectinload(AvailabilitySubmission.member))
    )
    if not submission or submission.account_id != current_user.get("account_id"):
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission


@router.post("/availability-submissions")
async def create_availability_submission(
    data: AvailabilitySubmissionCreate,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = SessionDep,
):
    """Past dates are dropped, and nothing is stored when it changes nothing."""
    member = await _current_member(session, current_user)
    if not member:
        raise HTTPException(status_code=404, detail="No member record linked to this account")

    try:
        json.loads(data.dates)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid date format") from None

    today = await org_today(session, member.account_id)
    future_dates = [d for d in _dates(data.dates) if d.get("date", "") >= today]

    # Only the latest submission counts.
    await session.execute(
        delete(AvailabilitySubmission).where(AvailabilitySubmission.member_id == member.id)
    )

    existing_slots = {
        (a.date, a.time_slot) for a in await _future_assignments(session, member, today)
    }
    if existing_slots == _slots(future_dates):
        if not future_dates:
            return {"status": "no_future_dates", "message": "No future date to submit"}
        return {"status": "no_changes", "message": "No change detected"}

    submission = AvailabilitySubmission(
        account_id=member.account_id,
        member_id=member.id,
        dates=json.dumps(future_dates),
        status="pending",
        message=(data.message or "").strip() or None,
    )
    session.add(submission)
    await session.flush()
    return submission.to_dict()


@router.get("/my-availability-submission")
async def get_my_availability_submission(
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = SessionDep,
):
    member = await _current_member(session, current_user)
    if not member:
        return None
    submission = await session.scalar(
        select(AvailabilitySubmission)
        .where(AvailabilitySubmission.member_id == member.id)
        .order_by(AvailabilitySubmission.created_at.desc())
        .limit(1)
    )
    return submission.to_dict() if submission else None


@router.get("/availability-submissions")
async def get_availability_submissions(
    current_user: dict = Depends(require_admin),
    session: AsyncSession = SessionDep,
):
    """Past dates are dropped. A submission left with none is deleted, unless it was
    submitted empty: that one means "remove all my assignments"."""
    account_id = get_account_id(current_user)
    submissions = await session.scalars(
        select(AvailabilitySubmission)
        .where(AvailabilitySubmission.account_id == account_id)
        .options(selectinload(AvailabilitySubmission.member))
        .order_by(AvailabilitySubmission.created_at)
    )

    today = await org_today(session, account_id)
    result = []
    for s in submissions:
        all_dates = _dates(s.dates)
        future_dates = [d for d in all_dates if d.get("date", "") >= today]

        if all_dates and not future_dates:
            await session.delete(s)
            await _resync_calendar(session, s.member, today)
            continue

        if len(future_dates) < len(all_dates):
            s.dates = json.dumps(future_dates)
        result.append({**s.to_dict(), "member": s.member.to_dict()})

    return result


@router.put("/availability-submissions/{submission_id}/validate")
async def validate_availability_submission(
    submission_id: int,
    current_user: dict = Depends(require_admin),
    session: AsyncSession = SessionDep,
):
    """Rebuilds every month the submission touches plus every month where the member
    still has future assignments, so a month left out does not keep its old ones."""
    submission = await _find_submission(session, submission_id, current_user)
    member = submission.member
    category = _category(member)
    all_dates = _dates(submission.dates)
    today = await org_today(session, submission.account_id)

    months = {d["date"][:7] for d in all_dates if d.get("date")} | {
        a.date[:7] for a in await _future_assignments(session, member, today)
    }

    added = removed = 0
    for month in months:
        submitted = _slots([d for d in all_dates if d.get("date", "").startswith(month)])
        existing = list(
            await session.scalars(
                select(Assignment).where(
                    Assignment.member_id == member.id,
                    Assignment.category == category,
                    Assignment.date.startswith(month),
                    Assignment.date >= today,
                )
            )
        )
        existing_slots = {(a.date, a.time_slot) for a in existing}

        for a in existing:
            if (a.date, a.time_slot) not in submitted:
                await session.delete(a)
                removed += 1

        for date, time_slot in submitted - existing_slots:
            session.add(
                Assignment(
                    account_id=member.account_id,
                    date=date,
                    time_slot=time_slot,
                    category=category,
                    member_id=member.id,
                )
            )
            added += 1

    await session.delete(submission)
    return {"status": "validated", "assignments_added": added, "assignments_removed": removed}


@router.delete("/availability-submissions/{submission_id}")
async def delete_availability_submission(
    submission_id: int,
    current_user: dict = Depends(require_admin),
    session: AsyncSession = SessionDep,
):
    """Assignments are untouched and the member's calendar is realigned on them."""
    submission = await _find_submission(session, submission_id, current_user)
    await session.delete(submission)
    await _resync_calendar(
        session, submission.member, await org_today(session, submission.account_id)
    )
    return {"status": "deleted"}
