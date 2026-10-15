from pydantic import BaseModel


class Member(BaseModel):
    last_name: str
    first_name: str
    email: str = ""
    phone: str = ""
    categories: list[str] = []
    resigned: bool = False
    departure_date: str = ""
    availability_notes: str = ""
    observations: str = ""
    user_id: int | None = None
    availability_calendar: str = ""
    previous_availability_notes: str | None = None  # triggers the notes email


class LoginRequest(BaseModel):
    email: str
    password: str


class VerifyEmailRequest(BaseModel):
    email: str
    code: str


class ResendCodeRequest(BaseModel):
    email: str


class SwitchAccountRequest(BaseModel):
    user_id: int


class CreateOrganizationRequest(BaseModel):
    org_name: str


class SetDefaultAccountRequest(BaseModel):
    user_id: int | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class AvailabilitySubmissionCreate(BaseModel):
    dates: str  # JSON [{"date", "time_slot"}]
    message: str | None = None


class RegisterRequest(BaseModel):
    email: str
    password: str


class CategoryRename(BaseModel):
    old_name: str
    new_name: str



class HolidayRequest(BaseModel):
    date: str


class GroupEmailPreview(BaseModel):
    subject: str = ""
    message: str = ""


class GroupEmailSend(BaseModel):
    subject: str
    message: str
    member_ids: list[int]
