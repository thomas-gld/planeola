from core.rich_text import rich_text_to_plain, sanitize_rich_text


def test_keeps_basic_formatting():
    raw = '<span style="font-weight: bold; color: #c00">Hi</span><br><i>there</i>'
    assert sanitize_rich_text(raw) == (
        '<span style="font-weight: bold; color: #c00">Hi</span><br><i>there</i>'
    )


def test_drops_scripts_links_attributes_and_unsafe_styles():
    raw = (
        '<script>alert(1)</script><a href="https://evil.test" onclick="x()">click</a>'
        '<span style="background-color: url(x); position: fixed" onmouseover="x()">ok</span>'
        '<img src=x onerror=alert(1)>'
    )
    out = sanitize_rich_text(raw)
    assert "<script" not in out and "<a" not in out and "<img" not in out
    assert "onclick" not in out and "url(" not in out and "position" not in out
    assert out == "click<span>ok</span>"


def test_drops_pasted_style_blocks():
    raw = "<style>p { color: red }</style><p>Text</p>"
    assert sanitize_rich_text(raw) == "<p>Text</p>"


def test_balances_tags():
    assert sanitize_rich_text("</td><b>bold<i>both</b>") == "<b>bold<i>both</i></b>"


def test_plain_text_keeps_line_breaks():
    assert rich_text_to_plain("<div>One</div><div>Two &amp; <b>three</b><br>four</div>") == (
        "One\nTwo & three\nfour"
    )
