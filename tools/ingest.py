#!/usr/bin/env python3
"""Fetch public authority listings and de-duplicate them.

Usage:
  python3 tools/ingest.py [root]
  python3 tools/ingest.py --pr-body ingest/new/YYYY-MM-DD.json

Reads sources/registry.yaml. For each source, fetches one public listing
(rss, atom, html or json; manual sources are skipped) and normalises items to
title, url, published date and authority. Identity is the SHA-256 of the
normalised URL plus the case-folded title.

ingest/seen.json maps each hash to the UTC date it was first seen. The first
successful fetch of a source records items already published on or before that
day as seen, and does not report them. Later runs write unseen items to
ingest/new/YYYY-MM-DD.json. A source that fails is appended to
ingest/quarantine/YYYY-MM-DD.json and does not fail the run.

Dependencies: requests, feedparser, PyYAML (see requirements.txt).
"""
import argparse, hashlib, html, json, re, sys, time
from datetime import date, datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

import feedparser
import requests
import yaml

UA = "fc-risk-indicators/ingest (+https://github.com/banksy2560/fc-risk-indicators)"
# Some public sites answer a bare tool UA with a bot wall. The retry still names the repo.
UA_ALT = (
    "Mozilla/5.0 (compatible; fc-risk-indicators/ingest; "
    "+https://github.com/banksy2560/fc-risk-indicators)"
)
FETCH_OK = {"rss", "atom", "html", "json", "manual"}
TRACKING = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
    "fbclid", "gclid", "mc_cid", "mc_eid",
}
SKIP_LINK = {
    "english", "french", "français", "spanish", "español", "deutsch", "german",
    "download", "pdf", "read more", "read more.", "home", "news", "more", "here",
    "full story", "view", "click here",
}
MONTHS = {}
for _i, _name in enumerate(
    "january february march april may june july august september october november december".split(), 1
):
    MONTHS[_name] = _i
    MONTHS[_name[:3]] = _i
MONTHS["sept"] = 9
ITEM_CLASS = re.compile(r"views-row|arch__item|feed-item|search-result|publication-item", re.I)
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
SKIP_TREE = {"script", "style", "noscript", "svg", "nav", "header", "footer"}
ISO_RE = re.compile(r"\b(20\d{2})-(\d{2})-(\d{2})\b")
DMY_NAME = re.compile(r"\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(20\d{2})\b")
MDY_NAME = re.compile(r"\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(20\d{2})\b")
NUM_DATE = re.compile(r"\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b")
YEAR_RE = re.compile(r"\b(20\d{2})\b")


class FetchError(Exception):
    pass


class Node:
    def __init__(self, tag, attrs):
        self.tag = tag
        self.attrs = attrs
        self.children = []
        self.parts = []
        self.has_h = False
        self.has_a = False

    def text(self):
        bits = []
        def walk(n):
            for part in n.parts:
                if part.strip():
                    bits.append(part.strip())
            for child in n.children:
                walk(child)
        walk(self)
        return " ".join(bits)


class ListingHTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("document", {})
        self.stack = [self.root]
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        self._start(tag, attrs, tag in VOID)

    def handle_startendtag(self, tag, attrs):
        self._start(tag, attrs, True)

    def _start(self, tag, attrs, void):
        attr = {k: v for k, v in attrs}
        if tag in SKIP_TREE:
            self.skip += 1
        if self.skip:
            if tag in SKIP_TREE and void:
                self.skip -= 1
            return
        node = Node(tag, attr)
        self.stack[-1].children.append(node)
        if not void:
            self.stack.append(node)
        elif tag == "br":
            node.parts.append(" ")

    def handle_endtag(self, tag):
        if tag in SKIP_TREE and self.skip:
            self.skip -= 1
            return
        if self.skip:
            return
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        if self.skip or not data.strip():
            return
        self.stack[-1].parts.append(data)


def annotate(node):
    heading = node.tag in {"h2", "h3", "h4"}
    link = node.tag == "a" and bool(node.attrs.get("href"))
    for child in node.children:
        annotate(child)
        heading = heading or child.has_h
        link = link or child.has_a
    node.has_h = heading
    node.has_a = link


def host_of(url):
    return (urlsplit(url).hostname or "").lower()


def prefers_dmy(host):
    return host.endswith(".gov.au") or host.endswith(".gov.uk") or host.endswith(".europa.eu") or "unodc.org" in host


def normalise_url(url):
    parts = urlsplit(url.strip())
    scheme = (parts.scheme or "https").lower()
    host = (parts.hostname or "").lower()
    if not host:
        return " ".join(url.split())
    netloc = host
    if parts.port and not ((scheme == "https" and parts.port == 443) or (scheme == "http" and parts.port == 80)):
        netloc = f"{host}:{parts.port}"
    path = re.sub(r"/+$", "", parts.path) or "/"
    query = urlencode(sorted(
        (k, v) for k, v in parse_qsl(parts.query, keep_blank_values=False) if k.lower() not in TRACKING
    ))
    return urlunsplit((scheme, netloc, path, query, ""))


def clean_title(value):
    text = html.unescape(value or "")
    text = re.sub(r"<[^>]+>", " ", text)
    return " ".join(text.split())[:300]


def item_hash(url, title):
    blob = normalise_url(url) + "\n" + clean_title(title).casefold()
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def _valid(year, month, day):
    try:
        return date(int(year), int(month), int(day)).isoformat()
    except ValueError:
        return None


def parse_date(value, host=""):
    if value is None:
        return None
    text = " ".join(str(value).split())
    if not text:
        return None
    m = ISO_RE.search(text)
    if m:
        return _valid(m.group(1), m.group(2), m.group(3))
    m = DMY_NAME.search(text)
    if m and m.group(2).lower().rstrip(".") in MONTHS:
        return _valid(m.group(3), MONTHS[m.group(2).lower().rstrip(".")], m.group(1))
    m = MDY_NAME.search(text)
    if m and m.group(1).lower().rstrip(".") in MONTHS:
        return _valid(m.group(3), MONTHS[m.group(1).lower().rstrip(".")], m.group(2))
    m = NUM_DATE.search(text)
    if m:
        a, b, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        dmy = _valid(year, b, a)
        mdy = _valid(year, a, b)
        if dmy and not mdy:
            return dmy
        if mdy and not dmy:
            return mdy
        if dmy and mdy:
            return dmy if prefers_dmy(host) else mdy
    # A bare year is only used when the whole value is a year (Wolfsberg cards say "2026").
    if re.fullmatch(r"20\d{2}", text):
        return text
    return None


def on_or_before(published, today):
    """Undated listings are already public. Year-only dates start on 1 January."""
    if not published:
        return True
    parts = published.split("-")
    try:
        year = int(parts[0])
        month = int(parts[1]) if len(parts) > 1 else 1
        day = int(parts[2]) if len(parts) > 2 else 1
        return date(year, month, day) <= today
    except ValueError:
        return True


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def looks_like_wall(response):
    ctype = (response.headers.get("Content-Type") or "").lower()
    if "html" not in ctype and "text/plain" not in ctype:
        return False
    head = response.text[:4000].lower()
    return any(s in head for s in (
        "just a moment", "cf-browser-verification", "access denied",
        "<title>maintenance</title>", "failover/images",
    ))


def fetch_url(session, url):
    errors = []
    headers = {
        "Accept": "application/rss+xml, application/atom+xml, application/xml, application/json, text/html;q=0.9, */*;q=0.8",
        "Accept-Language": "en",
    }
    for ua in (UA, UA_ALT):
        try:
            response = session.get(url, headers={**headers, "User-Agent": ua}, timeout=(10, 25), allow_redirects=True)
        except requests.RequestException as exc:
            errors.append(f"{type(exc).__name__}: {exc}")
            time.sleep(2)
            continue
        if response.status_code in (429, 500, 502, 503, 504) or looks_like_wall(response):
            errors.append(f"HTTP {response.status_code} from {response.url} (blocked or transient)")
            time.sleep(2)
            continue
        if response.status_code >= 400:
            errors.append(f"HTTP {response.status_code} from {response.url}")
            time.sleep(1)
            continue
        return response
    raise FetchError("; ".join(errors) or f"fetch failed for {url}")


def entry_link(entry):
    link = entry.get("link") or ""
    if link:
        return link
    for item in entry.get("links") or []:
        if item.get("href") and item.get("rel", "alternate") == "alternate":
            return item["href"]
    return ""


def entry_published(entry, host):
    for key in ("published", "updated", "created"):
        if entry.get(key):
            found = parse_date(entry.get(key), host)
            if found:
                return found
    for key in ("published_parsed", "updated_parsed"):
        stamp = entry.get(key)
        if stamp:
            return _valid(stamp.tm_year, stamp.tm_mon, stamp.tm_mday)
    return None


def parse_feed(content, page_url):
    parsed = feedparser.parse(content)
    if getattr(parsed, "bozo", False) and not parsed.entries:
        raise FetchError(f"feed did not parse: {parsed.bozo_exception}")
    host = host_of(page_url)
    items = []
    for entry in parsed.entries:
        title = clean_title(entry.get("title") or "")
        link = entry_link(entry)
        if not title or not link:
            continue
        url = normalise_url(urljoin(page_url, link))
        items.append({"title": title, "url": url, "published": entry_published(entry, host)})
    return items


def _first_heading(node):
    if node.tag in {"h2", "h3", "h4"}:
        text = node.text()
        if len(text) >= 8:
            return text
    for child in node.children:
        found = _first_heading(child)
        if found:
            return found
    return ""


def _links(node, base):
    found = []
    if node.tag == "a" and node.attrs.get("href"):
        href = node.attrs["href"].strip()
        if href and not href.startswith(("#", "mailto:", "javascript:")):
            found.append((urljoin(base, href), node.text()))
    for child in node.children:
        found.extend(_links(child, base))
    return found


def _block_texts(node):
    if node.tag in {"td", "th", "p", "li", "h2", "h3", "h4"}:
        text = node.text()
        return [text] if text else []
    out = []
    for child in node.children:
        out.extend(_block_texts(child))
    if not out:
        text = node.text()
        if text:
            out.append(text)
    return out


def _attr_date(node, host):
    for key in ("data-iso-date", "datetime"):
        if node.attrs.get(key):
            found = parse_date(node.attrs[key], host)
            if found:
                return found
    for child in node.children:
        found = _attr_date(child, host)
        if found:
            return found
    return None


def _qualifies(node):
    if not node.has_a:
        return False
    cls = node.attrs.get("class") or ""
    if ITEM_CLASS.search(cls) or node.tag in {"tr", "article"}:
        return True
    if node.tag in {"div", "section", "li"} and node.has_h:
        return True
    return False


def _collect(node, out):
    child_hit = False
    for child in node.children:
        if _collect(child, out):
            child_hit = True
    if _qualifies(node) and not child_hit:
        out.append(node)
        return True
    return child_hit


def parse_html(text, page_url):
    parser = ListingHTML()
    parser.feed(text)
    parser.close()
    annotate(parser.root)
    blocks = []
    _collect(parser.root, blocks)
    host = host_of(page_url)
    page = normalise_url(page_url)
    items = []
    seen = set()
    for block in blocks:
        links = []
        for href, label in _links(block, page_url):
            url = normalise_url(href)
            if url and url != page and urlsplit(url).scheme in {"http", "https"}:
                links.append((url, clean_title(label)))
        if not links:
            continue
        docs = [pair for pair in links if re.search(r"\.pdf($|\?)|/system/files/|/recent-actions/20\d{6}", pair[0], re.I)]
        ranked = [pair for pair in links if pair[1].casefold() not in SKIP_LINK]
        if docs:
            url = docs[0][0]
        elif ranked:
            url = max(ranked, key=lambda pair: len(pair[1]))[0]
        else:
            url = links[0][0]
        heading = _first_heading(block)
        texts = [clean_title(t) for t in _block_texts(block)]
        texts = [t for t in texts if t and not parse_date(t, host) and t.casefold() not in SKIP_LINK]
        if heading and len(heading) >= 12:
            title = heading
        elif texts:
            title = max(texts, key=len)
        else:
            title = next((label for _u, label in ranked if len(label) >= 12), "")
        title = clean_title(title)
        if len(title) < 12 or title.casefold() in SKIP_LINK:
            continue
        published = _attr_date(block, host)
        # Prefer a date that is the whole text of one element (a date cell, or a year on a card).
        if not published:
            for bit in _block_texts(block):
                published = parse_date(clean_title(bit), host)
                if published:
                    break
        if not published:
            published = parse_date(block.text(), host)
        if url in seen:
            continue
        document = bool(re.search(r"\.pdf($|\?)|/system/files/|/recent-actions/20\d{6}|/resources/", url, re.I))
        # Undated chrome (logos, section labels) is not a publication. A document URL is enough.
        if not published and not document:
            continue
        seen.add(url)
        items.append({"title": title[:300], "url": url, "published": published})
    if not items:
        raise FetchError(f"no publications parsed from {page_url}")
    return items[:120]


def as_text(value):
    if isinstance(value, list):
        value = value[0] if value else ""
    if value is None:
        return ""
    return clean_title(str(value))


def parse_json(content, source, page_url):
    try:
        payload = json.loads(content.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise FetchError(f"json did not parse: {exc}") from exc
    path = (source.get("json_path") or "").strip()
    cursor = payload
    if path:
        for part in path.split("."):
            if not isinstance(cursor, dict) or part not in cursor:
                raise FetchError(f"json path {path} missing at {part}")
            cursor = cursor[part]
    if isinstance(cursor, dict):
        for key in ("items", "docs", "results", "entries"):
            if isinstance(cursor.get(key), list):
                cursor = cursor[key]
                break
    if not isinstance(cursor, list):
        raise FetchError("json listing was not a list")
    title_key = source.get("json_title") or "title"
    url_key = source.get("json_url") or "url"
    date_key = source.get("json_date") or "published"
    base = source.get("json_url_base") or page_url
    host = host_of(base)
    items = []
    for row in cursor:
        if not isinstance(row, dict):
            continue
        title = as_text(row.get(title_key) or row.get("title") or row.get("name"))
        raw_url = as_text(row.get(url_key) or row.get("url") or row.get("link"))
        if not title or not raw_url:
            continue
        published = parse_date(as_text(row.get(date_key) or row.get("published") or row.get("publishedDate") or ""), host)
        items.append({"title": title, "url": normalise_url(urljoin(base, raw_url)), "published": published})
    return items


def load_seen(path):
    if not path.exists():
        return {"_meta": {"seeded_sources": {}}}, {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"ingest/seen.json is not valid JSON: {exc}")
    if not isinstance(data, dict):
        raise SystemExit("ingest/seen.json must be an object")
    meta = data.get("_meta") if isinstance(data.get("_meta"), dict) else {}
    seeded = meta.get("seeded_sources") if isinstance(meta.get("seeded_sources"), dict) else {}
    items = {k: v for k, v in data.items() if k != "_meta" and isinstance(v, str)}
    return {"_meta": {"seeded_sources": seeded}}, items


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(path)


def write_seen(path, meta, items):
    body = {"_meta": meta}
    for key in sorted(items):
        body[key] = items[key]
    write_json(path, body)


def pr_body(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    items = data.get("items") or []
    day = data.get("date") or "unknown"
    lines = [
        f"Weekly public-source ingest for {day}. These {len(items)} items were not in `ingest/seen.json`.",
        "",
        "An AI reviewer should draft typologies and indicators from these publications only. "
        "A human maker and an independent checker still approve anything that lands in the library. "
        "Indicators stay `review.state: unreviewed` until then.",
        "",
        "| Authority | Title | Link |",
        "|---|---|---|",
    ]
    for item in items:
        title = (item.get("title") or "").replace("|", "\\|")
        authority = (item.get("authority") or "").replace("|", "\\|")
        url = item.get("url") or ""
        lines.append(f"| {authority} | {title} | {url} |")
    if not items:
        lines.append("| | No items in this file. | |")
    print("\n".join(lines))


def ingest(root):
    root = Path(root)
    registry_path = root / "sources" / "registry.yaml"
    if not registry_path.exists():
        raise SystemExit(f"missing {registry_path}")
    registry = yaml.safe_load(registry_path.read_text(encoding="utf-8")) or {}
    sources = registry.get("sources") or []
    today = datetime.now(timezone.utc).date()
    day = today.isoformat()
    seen_path = root / "ingest" / "seen.json"
    meta, seen = load_seen(seen_path)
    seeded = meta["_meta"]["seeded_sources"]
    new_items = []
    failures = []
    session = requests.Session()
    session.max_redirects = 5

    for index, source in enumerate(sources):
        if index:
            time.sleep(1)
        source_id = source.get("id") or "?"
        authority = source.get("authority") or source_id
        method = (source.get("fetch") or "").strip().lower()
        feed_url = (source.get("feed_url") or "").strip()
        if method == "manual":
            print(f"{source_id:12} manual  skipped  {source.get('fetch_note') or feed_url or source.get('url') or ''}")
            continue
        if method not in FETCH_OK or not feed_url:
            failures.append({
                "source_id": source_id, "authority": authority, "fetch": method or None,
                "feed_url": feed_url or None, "error": "registry entry needs fetch (rss, atom, html, json or manual) and feed_url",
            })
            print(f"{source_id:12} {method or '-':6} FAIL  registry entry is incomplete")
            continue
        try:
            response = fetch_url(session, feed_url)
            raw = response.content
            snapshot = {"sha256": sha256_bytes(raw), "of": "response_body", "bytes": len(raw)}
            if method in {"rss", "atom"}:
                parsed = parse_feed(raw, response.url)
            elif method == "html":
                parsed = parse_html(response.text, response.url)
            else:
                parsed = parse_json(raw, source, response.url)
        except FetchError as exc:
            failures.append({
                "source_id": source_id, "authority": authority, "fetch": method,
                "feed_url": feed_url, "error": str(exc),
            })
            print(f"{source_id:12} {method:6} FAIL  {exc}")
            continue
        except Exception as exc:  # one bad parser must not stop the run
            failures.append({
                "source_id": source_id, "authority": authority, "fetch": method,
                "feed_url": feed_url, "error": f"{type(exc).__name__}: {exc}",
            })
            print(f"{source_id:12} {method:6} FAIL  {type(exc).__name__}: {exc}")
            continue

        first = source_id not in seeded
        added = fresh = 0
        for item in parsed:
            digest = item_hash(item["url"], item["title"])
            if digest in seen:
                continue
            if first and on_or_before(item.get("published"), today):
                seen[digest] = day
                added += 1
                continue
            seen[digest] = day
            fresh += 1
            new_items.append({
                "source_id": source_id,
                "authority": authority,
                "title": item["title"],
                "url": item["url"],
                "published": item.get("published"),
                "hash": digest,
                "fetch": method,
                "snapshot": snapshot,
            })
        seeded[source_id] = seeded.get(source_id) or day
        label = "seed" if first else "scan"
        print(f"{source_id:12} {method:6} ok    {label}  fetched {len(parsed):3}  seeded {added:3}  new {fresh:3}")

    write_seen(seen_path, meta["_meta"], seen)
    wrote_new = None
    if new_items:
        wrote_new = root / "ingest" / "new" / f"{day}.json"
        write_json(wrote_new, {
            "date": day,
            "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "items": new_items,
        })
    wrote_q = None
    if failures:
        wrote_q = root / "ingest" / "quarantine" / f"{day}.json"
        write_json(wrote_q, {"date": day, "failures": failures})
    print(f"seen={len(seen)} new={len(new_items)} quarantined={len(failures)}")
    if wrote_new:
        print(f"wrote {wrote_new}")
    if wrote_q:
        print(f"wrote {wrote_q}")
    print(f"wrote {seen_path}")
    return 0


def main(argv):
    parser = argparse.ArgumentParser(description="Fetch and de-duplicate public authority publications.")
    parser.add_argument("root", nargs="?", default=".", help="repository root")
    parser.add_argument("--pr-body", metavar="JSON", help="print a pull-request body for an ingest/new file and exit")
    args = parser.parse_args(argv)
    if args.pr_body:
        pr_body(args.pr_body)
        return 0
    return ingest(args.root)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
