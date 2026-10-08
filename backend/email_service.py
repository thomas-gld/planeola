import html
import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from urllib.parse import urlparse

from core.config import APP_NAME, APP_URL

logger = logging.getLogger("planeola.email")

TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "email_templates")

# The name given in the SMTP greeting. Left unset, smtplib looks up the
# machine's own FQDN once connected; where reverse DNS is slow that lookup can
# outlast the server's patience, and the server hangs up before any mail.
EHLO_HOSTNAME = urlparse(APP_URL).hostname or "localhost"


def _deliver(host: str, port: int, username: str, password: str, message: MIMEMultipart) -> None:
    """Implicit TLS on port 465, STARTTLS otherwise. SMTP_USE_SSL forces either."""
    use_ssl = os.getenv("SMTP_USE_SSL")
    implicit_tls = port == 465 if use_ssl is None else use_ssl.lower() in ("1", "true", "yes")

    smtp = smtplib.SMTP_SSL if implicit_tls else smtplib.SMTP
    with smtp(host, port, timeout=10, local_hostname=EHLO_HOSTNAME) as server:
        if not implicit_tls:
            server.starttls()
        server.login(username, password)
        server.send_message(message)


def _send(recipient: str, subject: str, text_body: str, template: str, **fields) -> bool:
    """Returns False instead of raising: a failed email must not break the request."""
    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", 587))
    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")
    from_email = os.getenv("SMTP_FROM_EMAIL")
    from_name = os.getenv("SMTP_FROM_NAME", APP_NAME)

    if not (host and username and password and from_email):
        logger.error("Missing SMTP variables in .env")
        return False

    try:
        template_path = os.path.join(TEMPLATES_DIR, template)
        with open(template_path, encoding="utf-8") as f:
            html_body = f.read().format(app_url=APP_URL, **fields)

        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = f"{from_name} <{from_email}>"
        message["To"] = recipient
        message.attach(MIMEText(text_body, "plain", "utf-8"))
        message.attach(MIMEText(html_body, "html", "utf-8"))

        _deliver(host, port, username, password, message)
    except Exception as exc:
        logger.error(f"Could not send {template} to {recipient}: {exc}")
        return False

    return True


def send_password_reset_email(
    recipient_email: str, recipient_name: str, reset_url: str, expires_in_minutes: int
) -> bool:
    text_body = f"""
Hello {recipient_name},

You requested a password reset on Planeola: {APP_URL}

Open this link to choose a new password:
{reset_url}

The link expires in {expires_in_minutes} minutes and can only be used once.

If you did not make this request, you can ignore this email: your password has not been changed.

Best regards,
Planeola
"""
    return _send(
        recipient_email,
        "Password reset",
        text_body,
        "password_reset_email_template.html",
        recipient_name=html.escape(recipient_name),
        reset_url=html.escape(reset_url, quote=True),
        expires_in_minutes=expires_in_minutes,
    )


def send_verification_code_email(recipient_email: str, code: str) -> bool:
    text_body = f"""
Hello,

Your confirmation code is: {code}

Enter it on the sign-up page to finish creating your account. The code expires
in 15 minutes.

If you did not try to create an account, you can ignore this email.

Best regards,
Planeola
"""
    return _send(
        recipient_email,
        f"{code} is your confirmation code",
        text_body,
        "verification_code_email_template.html",
        code=code,
    )


def send_invitation_email(
    recipient_email: str, recipient_name: str, org_name: str, inviter_email: str, has_account: bool
) -> bool:
    """The call to action depends on whether the person already has a Login."""
    org_label = f' "{org_name}"' if org_name else " an organization"

    if has_account:
        cta_url = f"{APP_URL}/login"
        cta_label = "Log in and accept"
        cta_text = f"Log in at {cta_url} to see and accept the invitation."
        cta_html = f'Log in at <a href="{cta_url}">{cta_url}</a> to see and accept the invitation.'
    else:
        cta_url = f"{APP_URL}/register"
        cta_label = "Create my account"
        cta_text = (
            f"Create your account at {cta_url} using this same email address "
            "to see and accept the invitation."
        )
        cta_html = (
            f'Create your account at <a href="{cta_url}">{cta_url}</a> '
            "using this same email address to see and accept the invitation."
        )

    text_body = f"""
Hello {recipient_name},

{inviter_email} invited you to join{org_label} on Planeola.

{cta_text}

Best regards,
Planeola
"""
    return _send(
        recipient_email,
        f"You've been invited to join {org_name}"
        if org_name
        else "You've been invited to an organization",
        text_body,
        "invitation_email_template.html",
        recipient_name=html.escape(recipient_name),
        inviter_email=html.escape(inviter_email),
        org_label=html.escape(org_label),
        cta_url=cta_url,
        cta_label=cta_label,
        cta_html=cta_html,
    )


def send_notes_notification_email(
    recipient_email: str, member_name: str, old_notes: str, new_notes: str
) -> bool:
    text_body = f"""
{member_name} updated their availability notes.

Previous notes:
{old_notes or "(empty)"}

New notes:
{new_notes or "(empty)"}
"""
    return _send(
        recipient_email,
        f"Notes updated - {member_name}",
        text_body,
        "notes_email_template.html",
        member_name=html.escape(member_name),
        old_notes=html.escape(old_notes) if old_notes else "(empty)",
        new_notes=html.escape(new_notes) if new_notes else "(empty)",
    )
