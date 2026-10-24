from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("chat", "0003_jobapplication_ai_analysis_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="ResumeProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(default="Default resume", max_length=200)),
                ("resume_text", models.TextField(blank=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.AddField(
            model_name="jobapplication",
            name="tailored_resume_text",
            field=models.TextField(blank=True),
        ),
    ]
