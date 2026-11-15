from .models import JobApplication


def get_job_application(application_id):
    try:
        return JobApplication.objects.get(id=application_id)
    except (JobApplication.DoesNotExist, ValueError):
        return None
