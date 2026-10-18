import uuid
from django.db import models

class Folder(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    parent = models.ForeignKey("self", null=True, blank=True, related_name="children", on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

class StoredFile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    file = models.FileField(upload_to="drive/")
    mime_type = models.CharField(max_length=150, blank=True)
    size = models.PositiveBigIntegerField(default=0)
    folder = models.ForeignKey(Folder, null=True, blank=True, related_name="files", on_delete=models.CASCADE)
    extracted_text = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class MemoryNode(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    content = models.TextField(blank=True)
    parent = models.ForeignKey("self", null=True, blank=True, related_name="children", on_delete=models.CASCADE)
    is_leaf = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class BrowserContext(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    url = models.URLField(max_length=2048)
    title = models.CharField(max_length=300, blank=True)
    text = models.TextField(blank=True)
    selection = models.TextField(blank=True)
    screenshot = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class Conversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200, default="New conversation")
    model = models.CharField(max_length=100, default="sub-gpt-5.6-luna")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
class Message(models.Model):
    conversation = models.ForeignKey(Conversation, related_name="messages", on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=[("user", "User"), ("assistant", "Assistant")])
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
