import html
import re
from html.parser import HTMLParser

ALLOWED_TAGS = {"b", "strong", "i", "em", "u", "span", "br", "p", "div"}
ALLOWED_STYLE_PROPS = {
    "color",
    "font-size",
    "font-weight",
    "font-style",
    "text-decoration",
    "background-color",
}
UNSAFE_STYLE_VALUES = ("javascript", "expression", "url(", "\\", "<", ">")
HIDDEN_TAGS = {"script", "style", "head", "title"}


def _sanitize_style(style: str) -> str:
    kept = []
    for declaration in style.split(";"):
        prop, _, value = declaration.partition(":")
        prop, value = prop.strip().lower(), value.strip()
        if prop not in ALLOWED_STYLE_PROPS or not value:
            continue
        if any(bad in value.lower() for bad in UNSAFE_STYLE_VALUES):
            continue
        kept.append(f"{prop}: {value}")
    return "; ".join(kept)


class _Sanitizer(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self.open: list[str] = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in HIDDEN_TAGS:
            self.hidden += 1
        if tag not in ALLOWED_TAGS:
            return
        if tag == "br":
            self.out.append("<br>")
            return
        style = _sanitize_style(dict(attrs).get("style") or "")
        self.out.append(f'<{tag} style="{html.escape(style)}">' if style else f"<{tag}>")
        self.open.append(tag)

    def handle_startendtag(self, tag, attrs):
        if tag == "br":
            self.out.append("<br>")

    def handle_endtag(self, tag):
        if tag in HIDDEN_TAGS:
            self.hidden = max(0, self.hidden - 1)
        if tag not in self.open:
            return
        # close what was left open inside it
        while self.open:
            last = self.open.pop()
            self.out.append(f"</{last}>")
            if last == tag:
                break

    def handle_data(self, data):
        if not self.hidden:
            self.out.append(html.escape(data))

    def result(self) -> str:
        return "".join(self.out) + "".join(f"</{tag}>" for tag in reversed(self.open))


def sanitize_rich_text(raw: str) -> str:
    if not raw:
        return ""
    parser = _Sanitizer()
    parser.feed(raw)
    parser.close()
    return parser.result()


def rich_text_to_plain(safe_html: str) -> str:
    text = re.sub(r"<br>", "\n", safe_html)
    text = re.sub(r"</(p|div)>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    return html.unescape(text).strip()
