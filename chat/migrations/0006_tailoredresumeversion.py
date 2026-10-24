import uuid

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("chat", "0005_folder_description_storedfile_description"),
    ]

    operations = [
        migrations.CreateModel(
            name="TailoredResumeVersion",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("version_number", models.PositiveIntegerField()),
                ("name", models.CharField(max_length=200)),
                ("resume_data", models.JSONField(default=dict)),
                ("page_size", models.CharField(default="A4", max_length=10)),
                ("model", models.CharField(blank=True, max_length=100)),
                ("is_current", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("job_application", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="resume_versions", to="chat.jobapplication")),
            ],
        ),
        migrations.AddConstraint(
            model_name="tailoredresumeversion",
            constraint=models.UniqueConstraint(fields=("job_application", "version_number"), name="unique_job_resume_version"),
        ),
    ]
