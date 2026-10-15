# HTML to PNG in Python

**Status:** Card PNG export is implemented in source; private-image fidelity and deployment acceptance have gaps below. Generic rendering guidance remains a dated research snapshot. **Source audit:** 2026-10-14. **Research snapshot:** 2026-06-11. **Scope:** Current frontend export call and sibling `magic-worlds-api` card renderer; historical tool comparison retained, not revalidated as a current package/version survey. **Owner / remaining delivery targets:** TBD.

## Actual Magic Worlds implementation

Magic Worlds already uses the recommended browser-rendering approach for **card exports**, rather than a generic HTML-to-PNG service:

| Piece | Current behavior | Evidence |
|---|---|---|
| Frontend action | Gallery Download PNG calls `exportCardImage(cardType, cardId)` and downloads a blob | [API client](../../src/infrastructure/api/index.ts), [gallery actions](../../src/features/gallery/hooks/useGalleryCardActions.tsx), [gallery tests](../../src/features/gallery/components/GalleryPage.test.tsx) |
| Backend route | Authenticated `GET /cards/{card_type}/{card_id}/export.png`; resolves a source in the request workspace, including archived sources | [card export route](/home/andres/PycharmProjects/magic-worlds-api/src/routes/card_exports.py) |
| Supported content | Character, world, item and adventure-template cards; curated content, escaping, truncation and no portable workspace organization | [content renderer](/home/andres/PycharmProjects/magic-worlds-api/src/services/card_export/content.py), [export package](/home/andres/PycharmProjects/magic-worlds-api/src/services/card_export/__init__.py) |
| Pixel output | Chromium/Playwright element screenshot of a 1200×1600 CSS card at scale 2, giving 2400×3200 PNG | [constants](/home/andres/PycharmProjects/magic-worlds-api/src/services/card_export/model.py), [Playwright renderer](/home/andres/PycharmProjects/magic-worlds-api/src/services/card_export/playwright_renderer.py) |
| Readiness | Waits for fonts, then images, then required `data-fit-done="1"`; font/image timeouts allow visual fallbacks, fit timeout fails the render | [readiness tests](/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_card_export_playwright_waits.py) |
| Runtime dependency | Backend `requirements.txt` declares `playwright>=1.57.0,<2.0.0`; install compatible Chromium on the API host or configure an absolute `CARD_EXPORT_CHROMIUM_EXECUTABLE` | [requirements](/home/andres/PycharmProjects/magic-worlds-api/requirements.txt), [configuration loader](/home/andres/PycharmProjects/magic-worlds-api/src/services/card_export/__init__.py) |
| Unavailable renderer | Returns HTTP 503 with public unavailable copy; no Selenium, WeasyPrint or Pillow renderer fallback | [route tests](/home/andres/PycharmProjects/magic-worlds-api/tests/routes/test_card_exports.py), [renderer tests](/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_card_export.py) |

There is no card-export/HTML renderer flag in [featureFlags.ts](../../src/shared/featureFlags.ts). PNG export availability is a backend runtime condition. Exporting adventures through their product surfaces is **WIP / disabled** wherever the adventure gate is false; the reviewed local `.env` enabled it, whereas `.env.example` defaults it off. Actual deployed browser availability has not been checked.

## Gaps, roadmap and TBD

| ID | Priority | Actual status / gap | Work and completion evidence |
|---|---|---|---|
| HTML-1 | P1 | **WIP — private portrait fidelity.** The HTML builder permits protected `/images/assets/{id}` URLs, while a fresh Playwright context has no bearer header/cookie/authenticated asset loader. The asset route requires authentication. Source therefore indicates the private hero request can fail and render fallback art; this was not live reproduced. | Resolve the authorized image in the backend and embed it, or define a narrowly scoped authenticated loading path; preserve card/workspace access checks. Add an actual browser render with a private portrait and verify its pixels, plus missing-image behavior. |
| HTML-2 | P1 | **TBD — host acceptance.** Source tests primarily validate templates, fake renderer output and readiness sequencing. | Install/verify the deployed Chromium/runtime dependencies, render a card with fonts and image, assert 2400×3200 output, and exercise renderer-unavailable 503. Record host/version/date evidence. |
| HTML-3 | P2 | **TBD — concurrency and resource policy.** Each render creates a browser; the async dispatcher uses `asyncio.to_thread`, with no pool/queue policy in this module. | Measure expected concurrency/latency/memory before choosing pooling or a bounded queue; define timeout/failure behavior and run an appropriate load test. No performance defect is established by this audit. |
| HTML-4 | P2 | **TBD — visual regression baseline.** Long/sparse content and font/image fallbacks have source tests, but this audit did not verify rendered golden images. | Record representative character/world/item/adventure output with short/long content, missing images and font fallback; decide a stable visual regression process and allowable clipping. |
| HTML-5 | P3 | **Deferred — generic renderer.** This research discusses arbitrary HTML/URL/PDF workflows; no such general service is part of the current card export contract. | Add only if a separate product need is approved; define controlled templates, asset policy, output limits and isolation rather than treating research snippets as production code. |

Owners and target dates are **TBD**. See the [project roadmap](../ROADMAP.md). No tests, browser renders or deployment checks were executed for this documentation-only audit. Existing tests establish implemented coverage, not successful production rendering.

## Retained tool research

The rest of this document is the **2026-06-11 research snapshot**. Its package versions, maintenance statements and general recommendations are historical observations and must be rechecked before a new dependency/deployment choice. Installation commands and examples are reference code, not the repository's active configuration. The actual implementation table above takes precedence for Magic Worlds.

This research covers practical ways to convert HTML into PNG images from Python.
It focuses on rendering fidelity, maintainability, deployment risk, security,
and the tradeoffs between browser-based screenshots, wrapper libraries,
legacy command-line tools, and PDF-first renderers.

## Executive Recommendation

Use Playwright for new Python projects unless the output is really a paged
document workflow.

Playwright gives Python direct control over a modern browser engine, supports
HTML strings, local files, URLs, JavaScript, modern CSS, web fonts, full-page
screenshots, element screenshots, high-DPI output, and deterministic rendering
controls. It also has active official documentation and installs known browser
binaries through its own CLI.

Use these choices by default:

| Need | Recommended path | Why |
| --- | --- | --- |
| Exact screenshot of HTML/CSS as a browser would show it | Playwright + Chromium | Best balance of modern CSS/JS support, API control, and deployment predictability. |
| Existing Selenium infrastructure | Selenium + Chrome/Firefox | Fine if the project already runs Selenium; less ergonomic for screenshot-specific workflows. |
| Quick trusted HTML snippets with minimal code | `html2image` | Convenient wrapper around installed browsers, but gives less control than Playwright. |
| Static invoice/report HTML where PDF is also required | WeasyPrint to PDF, then PyMuPDF to PNG | Better for paged media and print CSS, not for JavaScript-heavy web pages. |
| Legacy server already using `wkhtmltoimage` | `imgkit` + `wkhtmltoimage` | Viable for old static templates, but not a good default for new work. |
| New dynamic web rendering with pyppeteer | Avoid | The project itself says it is unmaintained and recommends Playwright. |

## Source Findings

Primary sources reviewed:

- Playwright Python installation:
  https://playwright.dev/python/docs/intro
- Playwright Python browser management:
  https://playwright.dev/python/docs/browsers
- Playwright Python screenshots:
  https://playwright.dev/python/docs/screenshots
- Playwright Python API, `page.screenshot` and browser context options:
  https://playwright.dev/python/docs/api/class-page
  https://playwright.dev/python/docs/api/class-browser
- Selenium screenshots:
  https://www.selenium.dev/documentation/webdriver/interactions/windows/
- Selenium Manager:
  https://www.selenium.dev/documentation/selenium_manager/
- `html2image` PyPI:
  https://pypi.org/project/html2image/
- `imgkit` GitHub:
  https://github.com/jarrekk/imgkit
- `wkhtmltopdf` / `wkhtmltoimage` homepage, status, and archived GitHub repo:
  https://wkhtmltopdf.org/
  https://wkhtmltopdf.org/status.html
  https://github.com/wkhtmltopdf/wkhtmltopdf
- WeasyPrint first steps and API reference:
  https://doc.courtbouillon.org/weasyprint/stable/first_steps.html
  https://doc.courtbouillon.org/weasyprint/stable/api_reference.html
- PyMuPDF image recipes:
  https://pymupdf.readthedocs.io/en/latest/recipes-images.html
- `pyppeteer` GitHub and PyPI:
  https://github.com/pyppeteer/pyppeteer
  https://pypi.org/project/pyppeteer/

Important source notes at the 2026-06-11 snapshot:

- Playwright supports Python as a general browser automation tool and supports
  Chromium, WebKit, and Firefox. Its docs say to install required browsers with
  `playwright install`, and browser versions are tied to each Playwright release.
- Playwright screenshots support file output, full-page screenshots, in-memory
  buffers, and element screenshots. The API also exposes options such as
  `full_page`, `clip`, `omit_background`, `animations`, `caret`, and output path.
- Selenium can take browsing-context screenshots with `driver.save_screenshot`
  and element screenshots. Selenium Manager is shipped with Selenium releases
  and can manage drivers and browsers when unavailable, but screenshot work still
  requires more manual sizing and waiting than Playwright.
- `html2image` 2.0.7 was released on 2025-05-16. Its package description says it
  wraps existing browser headless modes and can generate images from URLs,
  HTML/CSS strings, and files. It requires an installed Chrome, Chromium, or Edge
  browser and warns to process trusted content only.
- `wkhtmltoimage` renders HTML using Qt WebKit. The main `wkhtmltopdf`
  repository was archived on 2023-01-02, with latest GitHub release 0.12.6 from
  2020-06-10. The project's status page recommends avoiding untrusted HTML and
  using browser-based tools for dynamic JavaScript sites.
- WeasyPrint stable documentation is for WeasyPrint 69.0 and states Python
  3.10+ plus native layout dependencies. The Python API renders HTML to PDF with
  `HTML(...).write_pdf(...)`; PNG is not the primary output. Rasterization to
  PNG should be done as a second step with a PDF renderer such as PyMuPDF.
- PyMuPDF can rasterize PDF pages with `Page.get_pixmap()`, including higher
  resolution output via a matrix or `dpi`.
- `pyppeteer` 2.0.0 was released on 2024-02-18, but both its GitHub README and
  PyPI project page say the repository is unmaintained and recommend
  Playwright-Python as an alternative.

## What "HTML to PNG" Actually Means

There are several different jobs hidden behind the same phrase:

1. Browser screenshot: render the HTML like Chrome/Firefox/Safari would render a
   web page, then capture pixels.
2. Component screenshot: render a card, receipt, chart, social preview, or email
   snippet and capture only the element.
3. Static HTML report: render controlled HTML/CSS without JavaScript.
4. Print document: render HTML into paged PDF first, then convert one page or all
   pages into PNG.
5. Approximate conversion: parse enough HTML/CSS to draw simple text and boxes.

Most Python image libraries do not implement modern HTML layout. Pillow can draw
text and images, but it is not an HTML/CSS renderer. CairoSVG converts SVG to
PNG, not arbitrary HTML. For real HTML, use a browser engine or a document
renderer.

## Decision Matrix

| Toolchain | Modern CSS | JavaScript | HTML string | URL | Element screenshot | Full-page screenshot | Install complexity | Best use |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Playwright | High | High | Yes | Yes | Yes | Yes | Medium | New production rendering service. |
| Selenium | High | High | Yes, via data URL or temp file | Yes | Yes | Browser-dependent/manual | Medium | Teams already standardized on Selenium. |
| `html2image` | High, via installed browser | Browser-dependent | Yes | Yes | No first-class locator API | Viewport-oriented | Low to medium | Small trusted scripts. |
| `imgkit` + `wkhtmltoimage` | Low to medium | Old WebKit limits | Yes | Yes | No | Yes-ish through options | Medium to high | Legacy static templates. |
| WeasyPrint + PyMuPDF | Print CSS focused | No browser JS | Yes | Yes | Page-oriented | Page-oriented | Medium to high | Reports, invoices, and PDF-first workflows. |
| `pyppeteer` | High in principle | High | Yes | Yes | Yes | Yes | Medium | Avoid for new work. |

## Approach 1: Playwright

### Why It Is the Default

Playwright is the strongest default because it lets Python drive a real browser
with screenshot-specific APIs. It avoids hand-written HTML layout, supports
modern CSS and JavaScript, can wait for the page to be ready, and can capture the
whole page or a specific element.

The official docs show:

- Install Playwright and browser binaries with `pip install playwright` and
  `playwright install`.
- Install Linux system dependencies in CI with `playwright install-deps` or
  `playwright install --with-deps chromium`.
- Save a screenshot with `page.screenshot(path="screenshot.png")`.
- Capture a full scrollable page with `full_page=True`.
- Capture an element with `page.locator(".header").screenshot(...)`.

### Installation

For a new project:

```bash
python -m pip install playwright
python -m playwright install chromium
```

For Linux CI or a container where OS packages may be missing:

```bash
python -m playwright install --with-deps chromium
```

If the service only needs headless Chromium and does not need Playwright's
headless shell distinction, review the current browser install options in the
Playwright browser docs before optimizing image size. Browser install behavior
changes with Playwright releases.

### Minimal HTML String to PNG

```python
from pathlib import Path

from playwright.sync_api import sync_playwright


def html_to_png(
    html: str,
    output_path: str | Path,
    *,
    width: int = 1200,
    height: int = 800,
    device_scale_factor: float = 2,
) -> None:
    output_path = Path(output_path)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(
            viewport={"width": width, "height": height},
            device_scale_factor=device_scale_factor,
            color_scheme="light",
        )
        page = context.new_page()
        page.emulate_media(media="screen")
        page.set_content(html, wait_until="load")
        page.wait_for_function(
            "() => !document.fonts || document.fonts.status === 'loaded'"
        )
        page.screenshot(
            path=str(output_path),
            full_page=True,
            animations="disabled",
            caret="hide",
        )
        browser.close()
```

Notes:

- `width` and `height` are viewport dimensions in CSS pixels.
- `device_scale_factor=2` produces sharper output for social cards, previews,
  and retina-style displays.
- `full_page=True` captures the scrollable page, not just the viewport.
- `animations="disabled"` makes output more deterministic.
- Waiting for `document.fonts.status === 'loaded'` avoids many missing-font or
  layout-shift screenshots.

### Capture a Single Component

For exact cards, badges, receipts, OG images, charts, or thumbnails, capture a
specific element instead of the whole page.

```python
from pathlib import Path

from playwright.sync_api import sync_playwright


def component_to_png(html: str, selector: str, output_path: str | Path) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(
            viewport={"width": 1400, "height": 1000},
            device_scale_factor=2,
        )
        page.set_content(html, wait_until="load")
        page.wait_for_function(
            "() => !document.fonts || document.fonts.status === 'loaded'"
        )
        page.locator(selector).screenshot(
            path=str(output_path),
            animations="disabled",
        )
        browser.close()
```

This is usually more stable than `full_page=True` because the output dimensions
come from the target element's layout box.

### Transparent PNG

Use `omit_background=True` and make sure the page itself is transparent.

```python
page.set_content(
    """
    <style>
      html, body { margin: 0; background: transparent; }
      .badge { padding: 24px; background: rgba(255, 255, 255, 0.85); }
    </style>
    <div class="badge">Transparent canvas</div>
    """,
    wait_until="load",
)
page.locator(".badge").screenshot(
    path="badge.png",
    omit_background=True,
    animations="disabled",
)
```

### Local Files and Relative Assets

Relative URLs in an HTML string are the most common source of broken images and
fonts. Prefer one of these patterns:

- Serve the HTML and assets from a local HTTP server and call `page.goto(...)`.
- Write a temporary HTML file next to the assets and open it with a `file://`
  URL.
- Use absolute `file://` or `https://` URLs.
- Embed small assets as data URIs.
- Add a `<base href="...">` tag when rendering trusted HTML strings.

For production, a tiny local HTTP server or an internal object-storage URL is
usually less surprising than `file://` paths because browser and security
behavior around local files can differ by environment.

### URL to PNG

```python
from playwright.sync_api import sync_playwright


def url_to_png(url: str, output_path: str) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(
            viewport={"width": 1280, "height": 720},
            device_scale_factor=2,
        )
        page = context.new_page()
        page.goto(url, wait_until="load")
        page.wait_for_function(
            "() => !document.fonts || document.fonts.status === 'loaded'"
        )
        page.screenshot(path=output_path, full_page=True, animations="disabled")
        browser.close()
```

Avoid using `networkidle` as the only readiness signal. Playwright documents
`networkidle` as discouraged for testing because pages can keep sockets,
analytics, streaming requests, or polling connections open. For screenshot jobs,
wait for a known selector, a known JavaScript flag, fonts, and any app-specific
data state.

### Async Service Pattern

For a web service, keep one browser process alive and create a new browser
context per job. A context is cheaper than a new browser and isolates cookies,
storage, viewport, locale, and permissions.

```python
from pathlib import Path

from playwright.async_api import async_playwright


class HtmlScreenshotter:
    def __init__(self) -> None:
        self._playwright = None
        self._browser = None

    async def start(self) -> None:
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch()

    async def stop(self) -> None:
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()

    async def render_html(
        self,
        html: str,
        output_path: str | Path,
        *,
        width: int = 1200,
        height: int = 800,
    ) -> None:
        if self._browser is None:
            raise RuntimeError("Screenshotter has not been started")

        context = await self._browser.new_context(
            viewport={"width": width, "height": height},
            device_scale_factor=2,
            color_scheme="light",
        )
        try:
            page = await context.new_page()
            await page.set_content(html, wait_until="load")
            await page.wait_for_function(
                "() => !document.fonts || document.fonts.status === 'loaded'"
            )
            await page.screenshot(
                path=str(output_path),
                full_page=True,
                animations="disabled",
            )
        finally:
            await context.close()
```

Production details:

- Put a concurrency limit around rendering jobs. Browser rendering is CPU and
  memory intensive.
- Apply a per-job timeout.
- Close contexts even on failure.
- Recycle the browser process after a fixed number of jobs or when memory grows.
- Log output dimensions, render duration, browser errors, failed network
  requests, and screenshot byte size.

### Playwright Pros

- Modern browser fidelity.
- Active official Python documentation.
- Simple full-page and element screenshots.
- Device scale factor, viewport, media, locale, timezone, color scheme, and
  permission controls.
- Good fit for React/Vue/Svelte/Tailwind-generated HTML.
- Can run JavaScript when the HTML needs it.
- Can block requests, mock APIs, or inject CSS before capture.

### Playwright Cons

- Requires browser binaries and native OS dependencies.
- Browser startup is expensive if done for every screenshot.
- Output can vary when fonts, OS rendering, browser version, or external network
  assets vary.
- Running untrusted HTML is security-sensitive.

## Approach 2: Selenium

Selenium is a reasonable choice if the team already has Selenium, WebDriver
Grid, or browser infrastructure. It can drive Chrome, Firefox, Edge, and other
supported browsers and can save screenshots from Python.

The official Selenium docs show `driver.save_screenshot('./image.png')` for the
current browsing context and element screenshot support. Selenium Manager is
included with Selenium releases and can manage drivers and browsers when they
are not already available.

### HTML String to PNG with Selenium

```python
from pathlib import Path
from urllib.parse import quote

from selenium import webdriver
from selenium.webdriver.chrome.options import Options


def html_to_png_selenium(
    html: str,
    output_path: str | Path,
    *,
    width: int = 1200,
    height: int = 800,
) -> None:
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument(f"--window-size={width},{height}")

    driver = webdriver.Chrome(options=options)
    try:
        driver.get("data:text/html;charset=utf-8," + quote(html))

        total_width = driver.execute_script(
            "return Math.max("
            "document.body.scrollWidth, "
            "document.documentElement.scrollWidth)"
        )
        total_height = driver.execute_script(
            "return Math.max("
            "document.body.scrollHeight, "
            "document.documentElement.scrollHeight)"
        )
        driver.set_window_size(total_width, total_height)
        driver.save_screenshot(str(output_path))
    finally:
        driver.quit()
```

### When Selenium Is a Good Fit

- The organization already runs Selenium Grid.
- Existing tests already log in, navigate, and prepare the page state.
- The screenshot is part of a browser test or web QA workflow.
- Browser choice is important and WebDriver behavior is already understood by
  the team.

### Selenium Caveats

- Full-page screenshots are less ergonomic than Playwright's `full_page=True`.
- You usually have to resize the browser to document dimensions or use
  browser-specific APIs.
- Very tall pages can hit browser texture or screenshot size limits.
- Waiting for readiness is manual: use explicit waits, selectors, app signals,
  and font checks.
- Data URLs can be awkward for large HTML. Temporary files or a local server are
  better for large documents and relative assets.

## Approach 3: `html2image`

`html2image` is a convenience wrapper around existing browser headless modes. It
can generate images from URLs, HTML/CSS strings, and files. Its PyPI page says it
requires at least one installed browser among Google Chrome, Chromium Browser,
or Microsoft Edge.

### Example

```python
from html2image import Html2Image


html = "<main><h1>Card title</h1><p>Rendered by a browser.</p></main>"
css = """
body { margin: 0; font: 24px system-ui; }
main { width: 800px; padding: 48px; background: #f7f2e8; }
"""

hti = Html2Image(size=(900, 500), output_path=".")
paths = hti.screenshot(
    html_str=html,
    css_str=css,
    save_as="card.png",
)
print(paths)
```

### Best Use

Use it for trusted internal scripts, quick generated cards, prototypes, or batch
jobs where you want a simple API and can accept less control over the browser
session.

### Caveats

- It depends on an installed browser rather than installing pinned browser
  binaries for you.
- It is less expressive than Playwright for waiting, routing, authentication,
  element capture, tracing, and browser context control.
- The package itself warns to use trusted content only because processing
  untrusted or unsanitized input can lead to malicious code execution.
- It is not ideal for large multi-tenant rendering services where isolation,
  request blocking, timeouts, and observability matter.

## Approach 4: `imgkit` + `wkhtmltoimage`

`imgkit` wraps the `wkhtmltoimage` command-line utility. `wkhtmltoimage` is part
of the `wkhtmltopdf` project and renders HTML into images using Qt WebKit.

### Example

```python
import imgkit


html = """
<html>
  <body>
    <h1>Invoice #123</h1>
    <p>Total: $42.00</p>
  </body>
</html>
"""

options = {
    "format": "png",
    "encoding": "UTF-8",
    "width": 1200,
    "quiet": "",
}

imgkit.from_string(html, "invoice.png", options=options)
```

### Current Risk

This is a legacy choice. The `wkhtmltopdf` GitHub repository was archived on
2023-01-02 and latest GitHub release is 0.12.6 from 2020-06-10. The project's
own status page explains the old Qt WebKit foundation and recommends modern
browser tools for dynamic JavaScript sites.

### Best Use

- Existing systems already using `wkhtmltoimage`.
- Static, controlled HTML templates.
- Invoices or labels that were already designed around wkhtmltoimage behavior.
- Environments where introducing a Chromium automation stack is not possible.

### Caveats

- Not a modern web engine.
- CSS Grid, modern Flexbox details, web fonts, modern JavaScript, SVG edge
  cases, and browser APIs may not match Chrome or Firefox.
- Debian/Ubuntu package builds can have reduced functionality compared with
  official static binaries.
- It is not a strong choice for untrusted HTML.
- Long-term maintenance risk is high because the upstream repository is
  archived.

## Approach 5: WeasyPrint + PyMuPDF

WeasyPrint is excellent when the actual problem is "HTML to paged document" and
PNG is just a preview artifact. It uses HTML/CSS layout for PDF output. It is not
a browser screenshot tool, and JavaScript execution is not the model.

Use this path for:

- Invoices.
- Printable reports.
- Legal or administrative documents.
- PDF generation where PNG previews are needed.
- Workflows that care about page size, margins, print CSS, and page breaks.

### HTML to First PDF Page PNG

```python
from pathlib import Path

import pymupdf
from weasyprint import HTML


def html_document_to_first_page_png(
    html: str,
    output_path: str | Path,
    *,
    base_url: str | Path | None = None,
    dpi: int = 192,
) -> None:
    pdf_bytes = HTML(
        string=html,
        base_url=str(base_url) if base_url is not None else None,
    ).write_pdf()

    document = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    page = document[0]
    pixmap = page.get_pixmap(dpi=dpi, alpha=False)
    pixmap.save(str(output_path))
```

### Multiple Pages

```python
from pathlib import Path

import pymupdf
from weasyprint import HTML


def html_document_to_png_pages(html: str, output_dir: str | Path) -> list[Path]:
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    pdf_bytes = HTML(string=html).write_pdf()
    document = pymupdf.open(stream=pdf_bytes, filetype="pdf")

    paths: list[Path] = []
    for index, page in enumerate(document):
        path = output_dir / f"page-{index + 1}.png"
        page.get_pixmap(dpi=192, alpha=False).save(str(path))
        paths.append(path)
    return paths
```

### Caveats

- WeasyPrint's API is PDF-first; PNG is a second step.
- It defaults to print-oriented rendering behavior. The API reference documents
  `media_type` with a default of `print`.
- It needs native dependencies such as Pango.
- It warns that untrusted HTML/CSS can cause security problems, long renders,
  local file leaks, and high memory usage.
- It is not the right tool for a JavaScript app screenshot.

## Tools to Avoid or Scope Narrowly

### pyppeteer

Avoid pyppeteer for new work. Its own project text says the repo is unmaintained
and recommends Playwright-Python as an alternative. It can still take screenshots
through Chromium, but choosing it now creates avoidable maintenance risk.

### Pillow

Pillow is useful after rendering: crop, resize, optimize, watermark, compose, or
validate the PNG. It should not be treated as an HTML renderer.

### CairoSVG

CairoSVG is useful when the input is SVG. It does not solve arbitrary HTML/CSS
layout.

### Cloud Screenshot APIs

Cloud screenshot APIs can be useful when operations and browser maintenance are
not worth building in-house. The tradeoff is data exposure, recurring cost,
vendor lock-in, latency, and less direct rendering control. For private user
HTML or internal documents, self-hosted Playwright is usually easier to reason
about.

## Production Design

### Rendering Pipeline

A robust service should make rendering explicit:

1. Receive trusted HTML or generate HTML from trusted templates.
2. Resolve assets to absolute URLs or embed small assets.
3. Choose dimensions: viewport, target element, or page size.
4. Launch or reuse a browser.
5. Create an isolated context.
6. Load HTML.
7. Wait for deterministic readiness.
8. Capture PNG.
9. Validate image dimensions and non-empty output.
10. Store the image and metadata.
11. Close page/context.

### Sizing Rules

Prefer fixed-size templates for generated images.

For example, an Open Graph image should be a 1200 x 630 CSS pixel layout. If
capturing at `device_scale_factor=2`, the produced bitmap can be 2400 x 1260
device pixels while preserving the same visual proportions.

For document-like pages:

- Use `full_page=True` only when the full scroll height matters.
- Watch for extremely tall pages. Browser screenshots can fail or consume a lot
  of memory.
- For long content, paginate intentionally or render PDF pages.

For components:

- Give the component a stable CSS width and min-height.
- Capture the component locator.
- Avoid relying on the body dimensions when only one card matters.

### Readiness

Good readiness signals:

- A known selector is visible.
- A known element contains expected text.
- `document.fonts.status === 'loaded'`.
- The app sets `window.__SCREENSHOT_READY__ = true`.
- Specific images have loaded.
- Specific network calls have completed.

Weak readiness signals:

- Fixed `sleep(1)`.
- Generic `networkidle` on pages with analytics, polling, sockets, or streaming.
- Assuming `DOMContentLoaded` is enough when fonts or images matter.

### Determinism

Set as many inputs as possible:

- Browser version.
- Viewport.
- Device scale factor.
- Locale and timezone.
- Color scheme.
- Fonts.
- CSS media type.
- Random seeds, dates, and generated data.
- External API responses.

Disable or control:

- CSS animations and transitions.
- Video and GIF animation when a frame matters.
- Caret blinking.
- Third-party requests.
- Ads, analytics, cookie banners, and A/B test scripts.

### Fonts

Missing fonts are a leading cause of different screenshots across machines.

Use one of these strategies:

- Install required fonts in the container image.
- Use `@font-face` with local bundled font files.
- Use data-URI fonts for small controlled assets.
- Use a known system font stack only when exact pixel output does not matter.

Then wait for `document.fonts` before capture.

### Assets

Images and CSS should be deterministic:

- Use absolute URLs.
- Use signed URLs with enough lifetime for the render.
- Avoid external URLs that may block, redirect, rate-limit, or change.
- Cache immutable assets.
- Log failed network requests.
- Fail closed when required assets do not load.

### Security

Rendering HTML is not a safe string conversion. A browser can execute JavaScript,
make network requests, allocate large memory, fingerprint environment details,
and potentially reach internal services if network rules allow it.

For untrusted or user-supplied HTML:

- Prefer not to execute JavaScript.
- Sanitize HTML and CSS before rendering.
- Run renderers as a non-root user.
- Use containers, seccomp/AppArmor/SELinux where available, and minimal mounts.
- Restrict network egress. Block metadata services and internal networks.
- Deny `file://` access to host secrets.
- Apply CPU, memory, process, and wall-clock limits.
- Cap HTML size, image dimensions, and asset count.
- Close the context and kill stuck jobs.
- Store inputs and outputs according to data retention rules.

Playwright can help by creating isolated contexts, blocking network requests,
and disabling JavaScript for contexts that do not need it. Isolation still needs
OS-level controls for hostile input.

### Request Blocking with Playwright

For controlled templates, block everything except expected asset hosts.

```python
from urllib.parse import urlparse


ALLOWED_HOSTS = {"assets.example.com"}


def allow_expected_assets(route) -> None:
    url = route.request.url
    parsed = urlparse(url)

    if parsed.scheme in {"data", "blob"}:
        route.continue_()
        return

    if parsed.hostname in ALLOWED_HOSTS:
        route.continue_()
        return

    route.abort()


page.route("**/*", allow_expected_assets)
```

For local-only screenshots, consider aborting all external HTTP requests and
embedding assets.

### Performance

Browser rendering is heavier than image manipulation.

Practical guidance:

- Reuse one browser process per worker.
- Create one context per job.
- Limit concurrent contexts.
- Keep HTML small and asset sizes bounded.
- Avoid remote fonts and remote images in hot paths.
- Write outputs to local temporary storage first, then upload.
- Measure p50, p95, p99 render time and memory.
- Queue bursty workloads instead of letting request threads spawn browsers.

### Deployment

For Playwright in Docker:

- Install Python dependencies.
- Run `python -m playwright install --with-deps chromium` during image build.
- Install fonts in the image.
- Run as a non-root user.
- Use a writable temp directory.
- Set a memory limit and render timeout.

Do not run `playwright install` at request time. Browser downloads should happen
at build or deploy time.

## Recommended Implementation for New Projects

Use a small internal rendering module with Playwright:

```python
from pathlib import Path

from playwright.sync_api import sync_playwright


class HtmlToPngRenderer:
    def __init__(self, *, width: int = 1200, height: int = 630) -> None:
        self.width = width
        self.height = height

    def render(self, html: str, output_path: str | Path) -> None:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            try:
                context = browser.new_context(
                    viewport={"width": self.width, "height": self.height},
                    device_scale_factor=2,
                    color_scheme="light",
                    locale="en-US",
                    timezone_id="UTC",
                )
                page = context.new_page()
                page.emulate_media(media="screen")
                page.set_content(html, wait_until="load")
                page.wait_for_function(
                    "() => !document.fonts || document.fonts.status === 'loaded'"
                )
                page.locator("[data-screenshot-root]").screenshot(
                    path=str(output_path),
                    animations="disabled",
                    caret="hide",
                )
            finally:
                browser.close()
```

Template requirement:

```html
<main data-screenshot-root>
  <!-- fixed-size screenshot content -->
</main>
```

CSS requirement:

```css
html,
body {
  margin: 0;
  background: transparent;
}

[data-screenshot-root] {
  width: 1200px;
  height: 630px;
  overflow: hidden;
}
```

For high-throughput services, adapt this to the async service pattern so the
browser is started once and contexts are created per job.

## Validation

After rendering, validate the file before treating the job as successful.

```python
from pathlib import Path

from PIL import Image


def validate_png(path: str | Path, expected_size: tuple[int, int] | None = None) -> None:
    path = Path(path)
    if not path.exists() or path.stat().st_size == 0:
        raise ValueError(f"Missing or empty PNG: {path}")

    with Image.open(path) as image:
        if image.format != "PNG":
            raise ValueError(f"Expected PNG, got {image.format}")
        if expected_size is not None and image.size != expected_size:
            raise ValueError(f"Expected {expected_size}, got {image.size}")
```

For automated tests, combine:

- Exact dimension checks.
- Non-empty file checks.
- Optional perceptual/golden-image diffs for stable templates.
- A smoke test that renders fonts and images.
- A failure test where a required asset is missing.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Blank white PNG | HTML loaded before app content rendered, external assets blocked, wrong selector, or transparent content on white background | Wait for an app-specific selector or flag; log console/network errors; validate selector count. |
| Missing images | Relative URLs do not resolve from an HTML string | Serve assets, use absolute URLs, use a temp file with correct location, or embed data URIs. |
| Different font metrics in CI | Fonts are not installed or web fonts were not loaded | Install fonts in the image and wait for `document.fonts`. |
| Cropped output | Viewport too small or component has overflow | Capture a stable root element or use `full_page=True`; set fixed dimensions. |
| Massive output file | Full-page screenshot of long content or high DPR | Paginate, lower device scale factor, or capture a component. |
| Selenium screenshot only captures viewport | WebDriver screenshot behavior and browser window size | Resize to document dimensions or switch to Playwright full-page capture. |
| wkhtmltoimage CSS mismatch | Qt WebKit is old | Use Playwright or redesign the template for wkhtmltoimage limitations. |
| WeasyPrint ignores dynamic content | JavaScript is not part of the rendering model | Pre-render dynamic data into HTML or use a browser renderer. |

## Final Guidance

The June 2026 research recommends Playwright for most Python HTML-to-PNG work:

- It is the best default for modern HTML.
- It gives direct screenshot APIs.
- It can be deployed predictably with pinned browser binaries.
- It handles JavaScript, CSS, fonts, element screenshots, and full-page output.

Choose a different path only when the constraints are explicit:

- Selenium if the organization already operates WebDriver infrastructure.
- `html2image` for small trusted scripts where a wrapper is enough.
- WeasyPrint + PyMuPDF when PDF or paged print layout is the primary artifact.
- `imgkit` + `wkhtmltoimage` only for legacy static templates.

The hard parts are not the few lines that call `screenshot()`. The hard parts
are deterministic assets, fonts, readiness, isolation, resource limits, and
deployment. Treat HTML rendering as browser automation in production, not as a
simple file conversion.
