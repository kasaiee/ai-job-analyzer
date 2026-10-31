from django.db import migrations, models
import django.db.models.deletion
import uuid

class Migration(migrations.Migration):
    dependencies = [("chat", "0007_jobapplication_job_title")]
    operations = [migrations.CreateModel(
        name="CoverLetterVersion",
        fields=[
            ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
            ("version_number", models.PositiveIntegerField()), ("name", models.CharField(max_length=200)),
            ("content", models.TextField()), ("model", models.CharField(blank=True, max_length=100)),
            ("is_current", models.BooleanField(default=True)), ("created_at", models.DateTimeField(auto_now_add=True)),
            ("updated_at", models.DateTimeField(auto_now=True)),
            ("job_application", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="cover_letter_versions", to="chat.jobapplication")),
        ], options={"constraints": [models.UniqueConstraint(fields=("job_application", "version_number"), name="unique_job_cover_letter_version")]},
    )]
