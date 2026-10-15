import html
import json
import logging
import os
import smtplib
from contextlib import contextmanager
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from urllib.parse import urlparse

from fastapi import Request

from core.config import APP_NAME, APP_URL
from core.rich_text import rich_text_to_plain, sanitize_rich_text

logger = logging.getLogger("planeola.email")

TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "email_templates")
LOCALES_DIR = os.path.join(os.path.dirname(__file__), "email_locales")

DEFAULT_LANGUAGE = "en"
LOCALES = {}
for _name in os.listdir(LOCALES_DIR):
    with open(os.path.join(LOCALES_DIR, _name), encoding="utf-8") as _f:
        LOCALES[_name.removesuffix(".json")] = json.load(_f)

STRONG = '<strong style="font-weight: 600; color: #141414">{}</strong>'
ORG_HEADER = (
    '<span style="display: inline-block; border-left: 2px solid #141414; padding-left: 14px; '
    "font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, 'Courier New', monospace; "
    'font-size: 11px; font-weight: 700; line-height: 30px; letter-spacing: 0.12em; '
    'text-transform: uppercase; color: #3d3d3d">{}</span>'
)

# The name given in the SMTP greeting. Left unset, smtplib looks up the
# machine's own FQDN once connected; where reverse DNS is slow that lookup can
# outlast the server's patience, and the server hangs up before any mail.
EHLO_HOSTNAME = urlparse(APP_URL).hostname or "localhost"


def _smtp_settings() -> dict | None:
    settings = {
        "host": os.getenv("SMTP_HOST"),
        "port": int(os.getenv("SMTP_PORT", 587)),
        "username": os.getenv("SMTP_USERNAME"),
        "password": os.getenv("SMTP_PASSWORD"),
        "from_email": os.getenv("SMTP_FROM_EMAIL"),
        "from_name": os.getenv("SMTP_FROM_NAME", APP_NAME),
    }
    if not all(settings[k] for k in ("host", "username", "password", "from_email")):
        logger.error("Missing SMTP variables in .env")
        return None
    return settings


@contextmanager
def _connect(host: str, port: int, username: str, password: str):
    """Implicit TLS on port 465, STARTTLS otherwise. SMTP_USE_SSL forces either."""
    use_ssl = os.getenv("SMTP_USE_SSL")
    implicit_tls = port == 465 if use_ssl is None else use_ssl.lower() in ("1", "true", "yes")

    smtp = smtplib.SMTP_SSL if implicit_tls else smtplib.SMTP
    with smtp(host, port, timeout=10, local_hostname=EHLO_HOSTNAME) as server:
        if not implicit_tls:
            server.starttls()
        server.login(username, password)
        yield server


def _deliver(host: str, port: int, username: str, password: str, message: MIMEMultipart) -> None:
    with _connect(host, port, username, password) as server:
        server.send_message(message)


def request_language(request: Request) -> str:
    first = request.headers.get("accept-language", "").split(",")[0]
    code = first.split(";")[0].strip().lower().split("-")[0]
    return code if code in LOCALES else DEFAULT_LANGUAGE


def _texts(lang: str, section: str, values: dict, escape: bool = False) -> dict:
    locale = LOCALES.get(lang, LOCALES[DEFAULT_LANGUAGE])
    strings = {**locale["common"], **locale[section]}
    if escape:
        strings = {key: html.escape(text, quote=False) for key, text in strings.items()}
    return {key: text.format(app_url=APP_URL, **values) for key, text in strings.items()}


def _render(template: str, lang: str, section: str, values: dict) -> str:
    # escape values before calling
    texts = _texts(lang, section, values, escape=True)
    with open(os.path.join(TEMPLATES_DIR, template), encoding="utf-8") as f:
        return f.read().format(
            app_url=APP_URL,
            lang=lang,
            **values,
            **{f"t_{key}": text for key, text in texts.items()},
        )


def _message(
    smtp: dict,
    recipient: str,
    subject: str,
    text_body: str,
    html_body: str,
    from_name: str,
    reply_to: str = "",
) -> MIMEMultipart:
    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = formataddr((from_name, smtp["from_email"]))
    message["To"] = recipient
    if reply_to:
        message["Reply-To"] = reply_to
    message.attach(MIMEText(text_body, "plain", "utf-8"))
    message.attach(MIMEText(html_body, "html", "utf-8"))
    return message


def _send(
    recipient: str, subject: str, text_body: str, template: str, lang: str, section: str, **values
) -> bool:
    """Returns False instead of raising: a failed email must not break the request."""
    smtp = _smtp_settings()
    if not smtp:
        return False

    try:
        html_body = _render(template, lang, section, values)
        message = _message(
            smtp, recipient, subject, text_body, html_body, from_name=smtp["from_name"]
        )
        _deliver(smtp["host"], smtp["port"], smtp["username"], smtp["password"], message)
    except Exception as exc:
        logger.error(f"Could not send {template} to {recipient}: {exc}")
        return False

    return True


def send_password_reset_email(
    recipient_email: str,
    recipient_name: str,
    reset_url: str,
    expires_in_minutes: int,
    lang: str = DEFAULT_LANGUAGE,
) -> bool:
    t = _texts(lang, "reset", {"name": recipient_name, "minutes": expires_in_minutes})
    text_body = f"""
{t["hello"]}

{t["text_intro"]}

{t["text_link"]}
{reset_url}

{t["expiry"]}

{t["ignore"]}

{t["regards"]}
Planeola
"""
    return _send(
        recipient_email,
        t["subject"],
        text_body,
        "password_reset_email_template.html",
        lang,
        "reset",
        name=STRONG.format(html.escape(recipient_name)),
        reset_url=html.escape(reset_url, quote=True),
        minutes=expires_in_minutes,
    )


def send_verification_code_email(
    recipient_email: str, code: str, lang: str = DEFAULT_LANGUAGE
) -> bool:
    t = _texts(lang, "verify", {"code": code})
    text_body = f"""
{t["hello"]}

{t["text_code"]}

{t["instructions"]}

{t["ignore"]}

{t["regards"]}
Planeola
"""
    return _send(
        recipient_email,
        t["subject"],
        text_body,
        "verification_code_email_template.html",
        lang,
        "verify",
        code=code,
    )


def _org_label(lang: str, org_name: str) -> str:
    strings = LOCALES.get(lang, LOCALES[DEFAULT_LANGUAGE])["invite"]
    return strings["org_named"].format(org_name=org_name) if org_name else strings["org_unnamed"]


def send_invitation_email(
    recipient_email: str,
    recipient_name: str,
    org_name: str,
    inviter_email: str,
    has_account: bool,
    lang: str = DEFAULT_LANGUAGE,
) -> bool:
    """The call to action depends on whether the person already has a Login."""
    action = "login" if has_account else "register"
    cta_url = f"{APP_URL}/{action}"
    org = _org_label(lang, org_name)

    plain = {
        "name": recipient_name,
        "org_name": org_name,
        "org": org,
        "inviter": inviter_email,
        "inviter_strong": inviter_email,
        "link": cta_url,
    }
    rich = {
        "name": html.escape(recipient_name),
        "org_name": html.escape(org_name),
        "org": html.escape(org),
        "inviter": html.escape(inviter_email),
        "inviter_strong": STRONG.format(html.escape(inviter_email)),
        "link": f'<a href="{cta_url}">{cta_url}</a>',
    }
    t = _texts(lang, "invite", plain)
    rich_t = _texts(lang, "invite", rich, escape=True)

    text_body = f"""
{t["hello"]}

{t["body"]}

{t[f"{action}_hint"]}

{t["regards"]}
Planeola
"""
    return _send(
        recipient_email,
        t["subject"] if org_name else t["subject_unnamed"],
        text_body,
        "invitation_email_template.html",
        lang,
        "invite",
        **rich,
        cta_url=cta_url,
        cta_label=rich_t[f"{action}_button"],
        cta_html=rich_t[f"{action}_hint"],
    )


def send_notes_notification_email(
    recipient_email: str,
    member_name: str,
    old_notes: str,
    new_notes: str,
    lang: str = DEFAULT_LANGUAGE,
) -> bool:
    t = _texts(lang, "notes", {"name": member_name, "name_strong": member_name})
    text_body = f"""
{t["preheader"]}

{t["previous"]}:
{old_notes or t["empty"]}

{t["new"]}:
{new_notes or t["empty"]}
"""
    empty = html.escape(t["empty"])
    return _send(
        recipient_email,
        t["subject"],
        text_body,
        "notes_email_template.html",
        lang,
        "notes",
        name=html.escape(member_name),
        name_strong=STRONG.format(html.escape(member_name)),
        old_notes=html.escape(old_notes) if old_notes else empty,
        new_notes=html.escape(new_notes) if new_notes else empty,
    )


def render_group_email(
    subject: str, message: str, org_name: str, lang: str = DEFAULT_LANGUAGE
) -> tuple[str, str]:
    safe_message = sanitize_rich_text(message)
    text_body = f"""
{rich_text_to_plain(safe_message)}

{APP_URL}
"""
    html_body = _render(
        "group_email_template.html",
        lang,
        "group",
        {
            "subject": html.escape(subject),
            "org_header": ORG_HEADER.format(html.escape(org_name)) if org_name else "",
            "message_html": safe_message,
        },
    )
    return text_body, html_body


def send_group_email(
    recipients: list[str],
    subject: str,
    message: str,
    org_name: str,
    reply_to: str,
    lang: str = DEFAULT_LANGUAGE,
) -> tuple[int, int]:
    smtp = _smtp_settings()
    if not smtp:
        return 0, len(recipients)

    from_name = f"{org_name} via {APP_NAME}" if org_name else smtp["from_name"]
    text_body, html_body = render_group_email(subject, message, org_name, lang)
    sent = 0
    try:
        with _connect(smtp["host"], smtp["port"], smtp["username"], smtp["password"]) as server:
            for email in recipients:
                mail = _message(
                    smtp, email, subject, text_body, html_body, from_name, reply_to=reply_to
                )
                try:
                    server.send_message(mail)
                    sent += 1
                except smtplib.SMTPRecipientsRefused as exc:
                    logger.error(f"Group email refused for {email}: {exc}")
    except Exception as exc:
        logger.error(f"Group email interrupted after {sent} of {len(recipients)}: {exc}")

    return sent, len(recipients) - sent
