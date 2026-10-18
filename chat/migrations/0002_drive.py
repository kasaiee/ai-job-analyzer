from django.db import migrations, models
import django.db.models.deletion
import uuid

class Migration(migrations.Migration):
    dependencies = [("chat", "0001_initial")]
    operations = [
        migrations.CreateModel(name="MemoryNode", fields=[
            ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
            ("name", models.CharField(max_length=200)),
            ("content", models.TextField(blank=True)),
            ("is_leaf", models.BooleanField(default=True)),
            ("created_at", models.DateTimeField(auto_now_add=True)),
            ("updated_at", models.DateTimeField(auto_now=True)),
            ("parent", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="children", to="chat.memorynode")),
        ]),
        migrations.CreateModel(name="Folder", fields=[
            ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
            ("name", models.CharField(max_length=200)),
            ("created_at", models.DateTimeField(auto_now_add=True)),
            ("parent", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="children", to="chat.folder")),
        ]),
        migrations.CreateModel(name="StoredFile", fields=[
            ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
            ("name", models.CharField(max_length=255)),
            ("file", models.FileField(upload_to="drive/")),
            ("mime_type", models.CharField(blank=True, max_length=150)),
            ("size", models.PositiveBigIntegerField(default=0)),
            ("extracted_text", models.TextField(blank=True)),
            ("created_at", models.DateTimeField(auto_now_add=True)),
            ("folder", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="files", to="chat.folder")),
        ]),
    ]
