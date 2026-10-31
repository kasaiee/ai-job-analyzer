from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("chat", "0006_tailoredresumeversion"),
    ]

    operations = [
        migrations.AddField(
            model_name="jobapplication",
            name="job_title",
            field=models.CharField(blank=True, max_length=300),
        ),
    ]
