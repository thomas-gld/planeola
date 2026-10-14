"""Email delivery, without a database or a network."""

from email.mime.multipart import MIMEMultipart
from string import Formatter

import pytest
from starlette.requests import Request

import email_service


def test_delivery_names_itself_instead_of_looking_up_the_host(monkeypatch):
    """smtplib would otherwise resolve the machine's FQDN after connecting —
    40 s on some machines, long enough for the server to close the connection."""
    seen = {}

    class FakeSMTP:
        def __init__(self, host, port, **kwargs):
            seen.update(kwargs)

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def starttls(self):
            pass

        def login(self, *args):
            pass

        def send_message(self, message):
            seen["sent"] = True

    monkeypatch.setattr(email_service.smtplib, "SMTP", FakeSMTP)
    email_service._deliver("smtp.example.test", 587, "user", "secret", MIMEMultipart())

    assert seen["local_hostname"] == email_service.EHLO_HOSTNAME
    assert seen["sent"]


def _shape(locale):
    return {
        (section, key): sorted(name for _, name, _, _ in Formatter().parse(text) if name)
        for section, strings in locale.items()
        for key, text in strings.items()
    }


@pytest.mark.parametrize("lang", sorted(email_service.LOCALES))
def test_locales_share_keys_and_placeholders(lang):
    assert _shape(email_service.LOCALES[lang]) == _shape(email_service.LOCALES["en"])


@pytest.mark.parametrize("lang", sorted(email_service.LOCALES))
def test_every_email_is_written_in_the_asked_language(monkeypatch, lang):
    sent = []
    for name in ("SMTP_HOST", "SMTP_USERNAME", "SMTP_PASSWORD", "SMTP_FROM_EMAIL"):
        monkeypatch.setenv(name, "x")
    monkeypatch.setattr(email_service, "_deliver", lambda *args: sent.append(args[-1]))
    strings = email_service.LOCALES[lang]

    assert email_service.send_verification_code_email("a@example.test", "123456", lang)
    assert email_service.send_password_reset_email(
        "a@example.test", "Ada <b>", "https://x.test/r?token=t", 30, lang
    )
    assert email_service.send_invitation_email(
        "a@example.test", "Ada", "{Org} & co", "boss@example.test", has_account=False, lang=lang
    )
    assert email_service.send_invitation_email(
        "a@example.test", "Ada", "", "boss@example.test", has_account=True, lang=lang
    )
    assert email_service.send_notes_notification_email("a@example.test", "Ada", "", "new", lang)

    assert len(sent) == 5
    bodies = [part.get_payload(decode=True).decode() for part in sent[2].get_payload()]
    assert strings["invite"]["register_button"] in bodies[1]
    assert f'lang="{lang}"' in bodies[1]
    assert "{Org} &amp; co" in bodies[1] and "{Org} & co" in bodies[0]
    reset_html = sent[1].get_payload()[1].get_payload(decode=True).decode()
    assert "Ada &lt;b&gt;" in reset_html


@pytest.mark.parametrize(
    "header, expected",
    [("es", "es"), ("ru-RU,ru;q=0.9,en;q=0.8", "ru"), ("de-DE,fr;q=0.5", "en"), (None, "en")],
)
def test_email_language_follows_the_browser(header, expected):
    headers = [(b"accept-language", header.encode())] if header else []
    request = Request({"type": "http", "headers": headers})
    assert email_service.request_language(request) == expected
