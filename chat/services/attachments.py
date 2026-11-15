import base64
import mimetypes
from io import BytesIO

import fitz
from pypdf import PdfReader

MAX_FILES = 10
MAX_FILE_SIZE = 10 * 1024 * 1024
TEXT_EXTENSIONS = {
    ".txt",
    ".md",
    ".csv",
    ".json",
    ".xml",
    ".html",
    ".css",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".py",
    ".java",
    ".c",
    ".cpp",
    ".h",
    ".sql",
    ".yml",
    ".yaml",
    ".log",
}


def attachment_content(uploaded_files):
    """Turn uploaded files into OpenAI-compatible prompt content."""
    if len(uploaded_files) > MAX_FILES:
        raise ValueError(f"You can attach up to {MAX_FILES} files.")
    parts = []
    for uploaded in uploaded_files:
        if uploaded.size > MAX_FILE_SIZE:
            raise ValueError(f"{uploaded.name} is larger than 10 MB.")
        name = uploaded.name.replace("\n", " ")
        mime = uploaded.content_type or mimetypes.guess_type(name)[0] or "application/octet-stream"
        uploaded.seek(0)
        raw = uploaded.read()
        if mime == "application/pdf" or name.lower().endswith(".pdf"):
            # Extract selectable text first. This is fast and preserves resume text.
            try:
                pdf = PdfReader(BytesIO(raw))
                extracted = "\n\n".join((page.extract_text() or "") for page in pdf.pages).strip()
            except Exception:
                extracted = ""
            if extracted:
                parts.append(
                    {
                        "type": "text",
                        "text": f"\n--- Extracted PDF text: {name} ---\n{extracted}\n--- End extracted text: {name} ---\n",
                    }
                )
            # Render pages too, so the model can read scanned/image-only text.
            try:
                document = fitz.open(stream=raw, filetype="pdf")
                for page_number, page in enumerate(document[:10], start=1):
                    pixmap = page.get_pixmap(matrix=fitz.Matrix(1.35, 1.35), alpha=False)
                    image_bytes = pixmap.tobytes("jpeg", jpg_quality=72)
                    encoded = base64.b64encode(image_bytes).decode("ascii")
                    parts.append(
                        {
                            "type": "text",
                            "text": f"PDF page {page_number} image from {name}; read any text visible in this page.",
                        }
                    )
                    parts.append(
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{encoded}"},
                        }
                    )
                if len(document) > 10:
                    parts.append(
                        {
                            "type": "text",
                            "text": f"Only the first 10 pages of {name} were included.",
                        }
                    )
                document.close()
            except Exception as exc:
                parts.append(
                    {
                        "type": "text",
                        "text": f"PDF page preview could not be rendered for {name}: {exc}",
                    }
                )
        elif mime.startswith("image/"):
            encoded = base64.b64encode(raw).decode("ascii")
            parts.append({"type": "text", "text": f"Attached image: {name}"})
            parts.append(
                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{encoded}"}}
            )
        elif mime.startswith("text/") or any(name.lower().endswith(ext) for ext in TEXT_EXTENSIONS):
            text = raw.decode("utf-8", errors="replace")
            parts.append(
                {
                    "type": "text",
                    "text": f"\n--- Attached file: {name} ---\n{text}\n--- End {name} ---\n",
                }
            )
        else:
            parts.append(
                {
                    "type": "text",
                    "text": f"Attached file: {name} ({mime}). Its binary contents were not extracted; ask the user for a text export if needed.",
                }
            )
    return parts
