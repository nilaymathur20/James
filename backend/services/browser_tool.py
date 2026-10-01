"""Agentic headless web browsing with SSRF security firewalls.

Prevents Server-Side Request Forgery (SSRF) against loopback addresses,
LAN interfaces, cloud metadata endpoints (169.254.169.254), and private networks.
"""

from __future__ import annotations

import ipaddress
import logging
import re
import socket
import urllib.parse
from typing import Any, List, Optional

import requests

logger = logging.getLogger(__name__)

BLOCKED_IP_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


def is_safe_public_url(url: str) -> tuple[bool, str]:
    """Validate that URL does not point to internal/private infrastructure or metadata services."""
    try:
        parsed = urllib.parse.urlparse(url.strip())
        if parsed.scheme not in {"http", "https"}:
            return False, f"Unsupported URL scheme '{parsed.scheme}'. Only http/https are allowed."

        hostname = parsed.hostname
        if not hostname:
            return False, "Invalid URL: missing hostname."

        if hostname.lower() in {"localhost", "metadata.google.internal", "instance-data"}:
            return False, "Access to localhost or metadata hostnames is forbidden."

        # Resolve DNS host to IPs and verify every resolved IP
        try:
            addr_info = socket.getaddrinfo(hostname, None)
        except socket.gaierror:
            return False, f"Could not resolve hostname '{hostname}'."

        for item in addr_info:
            ip_str = item[4][0]
            ip_obj = ipaddress.ip_address(ip_str)

            if ip_obj.is_loopback or ip_obj.is_private or ip_obj.is_link_local or ip_obj.is_reserved:
                return False, f"Security block: Hostname '{hostname}' resolves to private/loopback IP {ip_str}."

            for blocked_net in BLOCKED_IP_NETWORKS:
                if ip_obj in blocked_net:
                    return False, f"Security block: IP {ip_str} is within forbidden network {blocked_net}."

        return True, "URL is safe."
    except Exception as exc:
        return False, f"URL validation error: {exc}"


def fetch_page_content(url: str, max_chars: int = 8000) -> dict[str, Any]:
    """Fetch and extract readable text/markdown from a web page safely."""
    is_safe, reason = is_safe_public_url(url)
    if not is_safe:
        return {"error": reason, "url": url}

    # Try Playwright first if installed, fallback to requests + html cleaning
    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36")
            page = context.new_page()
            page.goto(url, timeout=20000, wait_until="domcontentloaded")
            title = page.title()
            content = page.evaluate("() => document.body.innerText")
            browser.close()

            clean_text = _clean_html_text(content)[:max_chars]
            return {"title": title, "url": url, "content": clean_text, "engine": "playwright"}
    except Exception as pw_exc:
        logger.debug(f"Playwright unavailable or failed, using HTTP scraper: {pw_exc}")

    # Fallback to requests
    try:
        resp = requests.get(
            url,
            headers={"User-Agent": "James-Assistant/1.0 (Privacy-First Local Agent)"},
            timeout=15,
        )
        if not resp.ok:
            return {"error": f"HTTP request failed with status {resp.status_code}", "url": url}

        text = _clean_raw_html(resp.text)[:max_chars]
        return {"title": url, "url": url, "content": text, "engine": "requests"}
    except Exception as exc:
        return {"error": f"Failed to fetch page: {exc}", "url": url}


def web_search(query: str, num_results: int = 5) -> dict[str, Any]:
    """Perform a web search using DuckDuckGo HTML / Lite."""
    clean_query = query.strip()
    if not clean_query:
        return {"error": "Query cannot be empty."}

    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(clean_query)}"
        resp = requests.post(url, headers=headers, data={"q": clean_query}, timeout=12)

        if not resp.ok:
            return {"error": "Search service unavailable", "query": clean_query}

        # Simple extraction of search snippets
        from html.parser import HTMLParser

        results = []
        raw_text = _clean_raw_html(resp.text)
        return {
            "query": clean_query,
            "results_summary": raw_text[:2000],
            "engine": "duckduckgo",
        }
    except Exception as exc:
        return {"error": f"Search error: {exc}", "query": clean_query}


def _clean_html_text(text: str) -> str:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(lines)


def _clean_raw_html(html: str) -> str:
    no_script = re.sub(r"<(script|style).*?</\1>", "", html, flags=re.DOTALL | re.IGNORECASE)
    no_tags = re.sub(r"<[^>]+>", " ", no_script)
    no_entities = re.sub(r"&[a-z]+;", " ", no_tags)
    return _clean_html_text(no_entities)
