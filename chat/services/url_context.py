import re
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from ..models import Company, CompanyFact
from ..serializers import serialize_company

URL_PATTERN = re.compile(r"https?://[^\s<>()\[\]{}\"']+", re.IGNORECASE)
MAX_URLS = 5
MAX_URL_BYTES = 2 * 1024 * 1024


def url_context(text):
    """Fetch readable text from public URLs mentioned in a prompt."""
    urls = []
    for candidate in URL_PATTERN.findall(text or ""):
        candidate = candidate.rstrip(".,!?;:")
        parsed = urlparse(candidate)
        if parsed.scheme in {"http", "https"} and parsed.netloc and candidate not in urls:
            urls.append(candidate)
    parts = []
    for url in urls[:MAX_URLS]:
        try:
            response = requests.get(
                url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; JobAnalyzer/1.0)"},
                timeout=15,
                stream=True,
                allow_redirects=True,
            )
            response.raise_for_status()
            content_type = response.headers.get("content-type", "").lower()
            if (
                "text" not in content_type
                and "json" not in content_type
                and "xml" not in content_type
            ):
                parts.append(
                    f"URL: {url}\nThis URL returned a non-text resource ({content_type}); no text was extracted."
                )
                continue
            chunks = []
            total = 0
            for chunk in response.iter_content(chunk_size=65536):
                total += len(chunk)
                if total > MAX_URL_BYTES:
                    break
                chunks.append(chunk)
            raw = b"".join(chunks)
            if "html" in content_type or "xhtml" in content_type:
                soup = BeautifulSoup(raw, "html.parser")
                for tag in soup(["script", "style", "noscript", "svg", "nav", "footer", "header"]):
                    tag.decompose()
                title = soup.title.get_text(" ", strip=True) if soup.title else ""
                logo = soup.find("img", alt=re.compile(r"company logo", re.IGNORECASE))
                logo_url = urljoin(url, logo.get("src", "")) if logo and logo.get("src") else ""
                extracted = soup.get_text(" ", strip=True)
            else:
                title = ""
                logo_url = ""
                extracted = raw.decode("utf-8", errors="replace")
            extracted = re.sub(r"\s+", " ", extracted).strip()[:30000]
            parts.append(
                f"URL: {url}\nTitle: {title}\nCompany logo: {logo_url}\nContent:\n{extracted or '[No readable text found]'}"
            )
        except requests.RequestException as exc:
            parts.append(f"URL: {url}\nThe page could not be fetched: {exc}")
    if len(urls) > MAX_URLS:
        parts.append(f"Only the first {MAX_URLS} URLs were fetched.")
    return "\n\n---\n\n".join(parts)


def company_name_from_job_url(url, page_text=""):
    """Infer the employer from common job-board URL/title patterns."""
    path = urlparse(url).path.lower()
    match = re.search(r"(?:^|[-_/])at-([a-z0-9][a-z0-9-]*)(?:[-_/]|$)", path)
    if match:
        name = re.sub(r"\s+", " ", match.group(1).replace("-", " ")).strip()
        name = re.sub(
            r"\s+(?:remote|hybrid|onsite|full time|part time|canada|usa|uk|ireland|israel)$",
            "",
            name,
            flags=re.IGNORECASE,
        )
        return name.title()
    title_match = re.search(r"\bat\s+([A-Z][A-Za-z0-9&.' -]{1,80})", page_text or "")
    if title_match:
        return title_match.group(1).strip(" -|,.")
    return ""


def save_url_company_profiles(message, fetched_context):
    """Create/update companies for job URLs even when the model emits no company block."""
    saved = []
    for url in URL_PATTERN.findall(message or "")[:MAX_URLS]:
        url = url.rstrip(".,!?;:")
        blocks = re.findall(
            rf"URL: {re.escape(url)}\n([\s\S]*?)(?=\n\n---\n\n|$)", fetched_context or ""
        )
        page_data = blocks[0].strip() if blocks else ""
        name = company_name_from_job_url(url, page_data)
        if not name:
            continue
        company = Company.objects.filter(name__iexact=name).first() or Company.objects.create(
            name=name
        )
        if not company.website and urlparse(url).netloc not in {
            "www.codingjobboard.com",
            "codingjobboard.com",
        }:
            company.website = f"{urlparse(url).scheme}://{urlparse(url).netloc}"
        logo_match = re.search(r"^Company logo:\s*(\S+)", page_data, re.MULTILINE)
        if logo_match and logo_match.group(1):
            company.brand_image_url = logo_match.group(1)
        if page_data:
            title = re.search(r"^Title: (.+)$", page_data, re.MULTILINE)
            if title and not company.summary:
                company.summary = title.group(1).strip()[:2000]
            fact_text = page_data[:30000]
        else:
            fact_text = f"Job page URL: {url}"
        company.save()
        if not CompanyFact.objects.filter(company=company, source=url, fact=fact_text).exists():
            CompanyFact.objects.create(
                company=company,
                category="job posting",
                fact=fact_text,
                source=url,
                confidence="medium",
            )
        saved.append(serialize_company(company))
    return saved
