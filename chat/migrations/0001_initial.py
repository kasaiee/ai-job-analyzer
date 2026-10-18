from django.db import migrations, models
import django.db.models.deletion
import uuid
class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [migrations.CreateModel(name="Conversation", fields=[("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ("title", models.CharField(default="New conversation", max_length=200)), ("model", models.CharField(default="sub-gpt-5.6-luna", max_length=100)), ("created_at", models.DateTimeField(auto_now_add=True)), ("updated_at", models.DateTimeField(auto_now=True))]), migrations.CreateModel(name="Message", fields=[("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")), ("role", models.CharField(choices=[("user", "User"), ("assistant", "Assistant")], max_length=20)), ("content", models.TextField()), ("created_at", models.DateTimeField(auto_now_add=True)), ("conversation", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="messages", to="chat.conversation"))])]
