"""Email delivery, without a database or a network."""
from email.mime.multipart import MIMEMultipart

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
