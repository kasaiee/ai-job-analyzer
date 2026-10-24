from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("chat", "0004_resumeprofile_jobapplication_tailored_resume_text"),
    ]

    operations = [
        migrations.AddField(
            model_name="folder",
            name="description",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="storedfile",
            name="description",
            field=models.TextField(blank=True),
        ),
    ]
