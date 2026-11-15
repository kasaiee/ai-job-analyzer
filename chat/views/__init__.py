"""HTTP layer: thin view modules re-exported for chat.urls."""

from .ai import ai_models
from .browser import browser_context, browser_context_detail
from .chat import chat, conversation_detail, conversations
from .companies import companies, company_detail
from .cover_letters import (
    cover_letter_detail,
    cover_letter_pdf,
    cover_letters,
    generate_cover_letter,
)
from .jobs import (
    job_application_analysis,
    job_application_detail,
    job_applications,
    reorder_job_applications,
    resume_profile,
)
from .memory import (
    memory,
    memory_arrange,
    memory_bulk,
    memory_capture,
    memory_detail,
    memory_export,
    memory_import,
)
from .resumes import (
    check_tailored_resume_audit,
    generate_tailored_resume,
    reassess_tailored_resume_quality,
    tailored_resume_detail,
    tailored_resume_pdf,
    tailored_resumes,
)
