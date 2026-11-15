"""API URL routing for the chat application."""

from django.urls import path

from . import views

urlpatterns = [
    # AI settings
    path("ai/models/", views.ai_models),
    # Resume profile
    path("resume-profile/", views.resume_profile),
    # Job applications
    path("job-applications/", views.job_applications),
    path("job-applications/reorder/", views.reorder_job_applications),
    path("job-applications/<uuid:application_id>/", views.job_application_detail),
    path("job-applications/<uuid:application_id>/analysis/", views.job_application_analysis),
    # Tailored resumes
    path("job-applications/<uuid:application_id>/resumes/", views.tailored_resumes),
    path(
        "job-applications/<uuid:application_id>/resumes/generate/", views.generate_tailored_resume
    ),
    path(
        "job-applications/<uuid:application_id>/resumes/<uuid:resume_id>/",
        views.tailored_resume_detail,
    ),
    path(
        "job-applications/<uuid:application_id>/resumes/<uuid:resume_id>/audit-check/",
        views.check_tailored_resume_audit,
    ),
    path(
        "job-applications/<uuid:application_id>/resumes/<uuid:resume_id>/reassess-quality/",
        views.reassess_tailored_resume_quality,
    ),
    path(
        "job-applications/<uuid:application_id>/resumes/<uuid:resume_id>/pdf/",
        views.tailored_resume_pdf,
    ),
    # Cover letters
    path("job-applications/<uuid:application_id>/cover-letters/", views.cover_letters),
    path(
        "job-applications/<uuid:application_id>/cover-letters/generate/",
        views.generate_cover_letter,
    ),
    path(
        "job-applications/<uuid:application_id>/cover-letters/<uuid:letter_id>/",
        views.cover_letter_detail,
    ),
    path(
        "job-applications/<uuid:application_id>/cover-letters/<uuid:letter_id>/pdf/",
        views.cover_letter_pdf,
    ),
    # Companies
    path("companies/", views.companies),
    path("companies/<uuid:company_id>/", views.company_detail),
    # Chat
    path("conversations/", views.conversations),
    path("conversations/<uuid:conversation_id>/", views.conversation_detail),
    path("chat/", views.chat),
    path("browser-context/", views.browser_context),
    path("browser-context/<uuid:context_id>/", views.browser_context_detail),
    # Personal memory
    path("memory/", views.memory),
    path("memory/capture/", views.memory_capture),
    path("memory/bulk/", views.memory_bulk),
    path("memory/arrange/", views.memory_arrange),
    path("memory/export/", views.memory_export),
    path("memory/import/", views.memory_import),
    path("memory/<uuid:node_id>/", views.memory_detail),
]
