"""Web-page retrieval with a fast HTTP path and optional Selenium fallback."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup


@dataclass(frozen=True)
class ScrapeResult:
    text: str
    used_selenium: bool


class ScrapeError(Exception):
    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def scrape_page(url: str) -> ScrapeResult:
    """Fetch readable page text, using Chrome only when normal HTML fails.

    Selenium is intentionally a fallback: it avoids needing Chrome for ordinary
    pages while still supporting JavaScript-rendered documentation sites.
    """
    normalized_url = _validate_url(url)
    request_error: requests.RequestException | None = None
    text = ""

    try:
        response = requests.get(
            normalized_url,
            timeout=(10, 30),
            headers={"User-Agent": "Local-System-RAG-Agent/1.0"},
        )
        response.raise_for_status()
        content_type = response.headers.get("content-type", "").lower()
        if content_type and "html" not in content_type and "xhtml" not in content_type:
            raise ScrapeError("Only HTML web pages can be indexed.", status_code=415)
        text = _html_to_text(response.text)
    except ScrapeError:
        raise
    except requests.RequestException as exc:
        request_error = exc

    if text:
        return ScrapeResult(text=text, used_selenium=False)

    rendered_text = _scrape_with_selenium(normalized_url)
    if rendered_text:
        return ScrapeResult(text=rendered_text, used_selenium=True)

    if request_error is not None:
        raise ScrapeError("Could not retrieve the requested web page.") from request_error
    raise ScrapeError(
        "The page did not contain readable text. Install Chrome and Selenium for JavaScript-rendered pages.",
        status_code=422,
    )


def _validate_url(url: str) -> str:
    normalized_url = url.strip()
    parsed = urlparse(normalized_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc or not parsed.hostname:
        raise ScrapeError("URL must be an absolute http:// or https:// address.", status_code=422)
    return normalized_url


def _html_to_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for element in soup(["script", "style", "noscript", "template", "svg"]):
        element.decompose()
    return " ".join(soup.get_text(" ", strip=True).split())


def _scrape_with_selenium(url: str) -> str:
    """Return browser-rendered body text, or an empty string if unavailable."""
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.common.by import By
    except ImportError:
        return ""

    driver: Any | None = None
    try:
        options = Options()
        options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")

        driver = webdriver.Chrome(options=options)
        driver.set_page_load_timeout(30)
        driver.get(url)
        return driver.find_element(By.TAG_NAME, "body").text.strip()
    except Exception:
        # The route returns a user-friendly error rather than crashing the API
        # when Chrome, ChromeDriver, or a display environment is unavailable.
        return ""
    finally:
        if driver is not None:
            try:
                driver.quit()
            except Exception:
                pass
