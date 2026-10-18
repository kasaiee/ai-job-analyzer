from django.urls import path
from . import views
urlpatterns = [path("conversations/", views.conversations), path("conversations/<uuid:conversation_id>/", views.conversation_detail), path("chat/", views.chat)]
