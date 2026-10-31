from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("chat", "0008_coverletterversion")]

    operations = [
        migrations.AddField(
            model_name="coverletterversion",
            name="template_data",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
