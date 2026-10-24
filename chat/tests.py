import json
from unittest.mock import Mock, patch

import requests
from django.test import SimpleTestCase, TestCase

from .models import Folder, MemoryNode, StoredFile
from .views import (
    ai_analysis_completion,
    parse_analysis_json,
    resume_placeholder_count,
    save_memory_blocks,
    validate_resume_data,
)


class AssistantMemoryActionsTests(TestCase):
    def test_assistant_can_update_an_existing_memory_by_id(self):
        memory = MemoryNode.objects.create(
            name="Preferred role",
            content="The user prefers backend roles.",
            is_leaf=True,
        )
        action = json.dumps(
            {
                "action": "update",
                "id": str(memory.id),
                "name": "Preferred role",
                "content": "The user prefers full-stack roles.",
            }
        )

        results = save_memory_blocks(f"```memory-action\n{action}\n```")

        memory.refresh_from_db()
        self.assertEqual(memory.content, "The user prefers full-stack roles.")
        self.assertEqual(results[0]["action"], "update")

    def test_assistant_can_delete_an_existing_memory_by_id(self):
        memory = MemoryNode.objects.create(name="Old preference", content="Obsolete", is_leaf=True)
        action = json.dumps({"action": "delete", "id": str(memory.id)})

        results = save_memory_blocks(f"```memory-action\n{action}\n```")

        self.assertFalse(MemoryNode.objects.filter(id=memory.id).exists())
        self.assertEqual(results, [{"id": str(memory.id), "action": "delete"}])

    def test_invalid_id_does_not_change_memory(self):
        memory = MemoryNode.objects.create(name="Location", content="Berlin", is_leaf=True)
        action = json.dumps(
            {
                "action": "update",
                "id": "not-a-valid-id",
                "name": "Location",
                "content": "Paris",
            }
        )

        results = save_memory_blocks(f"```memory-action\n{action}\n```")

        memory.refresh_from_db()
        self.assertEqual(memory.content, "Berlin")
        self.assertEqual(results, [])

    def test_existing_create_format_remains_supported(self):
        results = save_memory_blocks("```memory: Target role\nStaff engineer\n```")

        memory = MemoryNode.objects.get(name="Target role")
        self.assertEqual(memory.content, "Staff engineer")
        self.assertEqual(results[0]["action"], "create")

    def test_non_object_action_is_ignored(self):
        memory = MemoryNode.objects.create(name="Location", content="Berlin", is_leaf=True)

        results = save_memory_blocks('```memory-action\n["delete everything"]\n```')

        self.assertTrue(MemoryNode.objects.filter(id=memory.id).exists())
        self.assertEqual(results, [])

    def test_unfenced_batch_memory_response_is_saved(self):
        response = """موارد زیر به مموری شخصی شما اضافه شد:

memory: ترجیح شغلی
ترجیح می‌دهم در نقش‌های فول‌استکِ کاملاً دورکار فعالیت کنم.

memory: حداقل حقوق مورد انتظار
حداقل حقوق مورد انتظار من €80,000 است.

memory: زمان آمادگی برای شروع
برای شروع کار از ماه ژانویه در دسترس هستم."""

        results = save_memory_blocks(response)

        self.assertEqual(len(results), 3)
        self.assertEqual(MemoryNode.objects.count(), 3)
        self.assertTrue(MemoryNode.objects.filter(name="ترجیح شغلی").exists())
        self.assertTrue(MemoryNode.objects.filter(name="حداقل حقوق مورد انتظار").exists())
        self.assertTrue(MemoryNode.objects.filter(name="زمان آمادگی برای شروع").exists())


class DriveDescriptionTests(TestCase):
    def test_folder_description_can_be_saved(self):
        folder = Folder.objects.create(name="Resumes")

        response = self.client.patch(
            f"/api/drive/folders/{folder.id}/",
            data=json.dumps({"description": "Tailored resumes for engineering roles"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        folder.refresh_from_db()
        self.assertEqual(folder.description, "Tailored resumes for engineering roles")

    def test_file_description_can_be_saved(self):
        stored_file = StoredFile.objects.create(name="resume.txt", file="drive/resume.txt")

        response = self.client.patch(
            f"/api/drive/files/{stored_file.id}/",
            data=json.dumps({"description": "Current backend resume"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        stored_file.refresh_from_db()
        self.assertEqual(stored_file.description, "Current backend resume")


class MemoryFolderTests(TestCase):
    def test_lists_current_folder_with_breadcrumbs(self):
        parent = MemoryNode.objects.create(name="Career", is_leaf=False)
        child = MemoryNode.objects.create(name="Preferences", is_leaf=False, parent=parent)
        MemoryNode.objects.create(name="Remote work", content="Prefers remote roles", parent=child)

        response = self.client.get(f"/api/memory/?parent={child.id}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["name"] for item in response.json()["breadcrumbs"]], ["Career", "Preferences"])
        self.assertEqual(response.json()["memories"][0]["name"], "Remote work")

    def test_moves_memory_to_folder(self):
        folder = MemoryNode.objects.create(name="Career", is_leaf=False)
        memory = MemoryNode.objects.create(name="Role", content="Engineer")

        response = self.client.post(
            "/api/memory/bulk/",
            data=json.dumps({"action": "move", "item_ids": [str(memory.id)], "parent_id": str(folder.id)}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        memory.refresh_from_db()
        self.assertEqual(memory.parent, folder)

    def test_prevents_moving_folder_into_descendant(self):
        parent = MemoryNode.objects.create(name="Career", is_leaf=False)
        child = MemoryNode.objects.create(name="Preferences", is_leaf=False, parent=parent)

        response = self.client.post(
            "/api/memory/bulk/",
            data=json.dumps({"action": "move", "item_ids": [str(parent.id)], "parent_id": str(child.id)}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        parent.refresh_from_db()
        self.assertIsNone(parent.parent)

    def test_bulk_delete_removes_nested_memories(self):
        folder = MemoryNode.objects.create(name="Career", is_leaf=False)
        memory = MemoryNode.objects.create(name="Role", content="Engineer", parent=folder)

        response = self.client.post(
            "/api/memory/bulk/",
            data=json.dumps({"action": "delete", "item_ids": [str(folder.id)]}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(MemoryNode.objects.filter(id=folder.id).exists())
        self.assertFalse(MemoryNode.objects.filter(id=memory.id).exists())


class JobAnalysisValidationTests(SimpleTestCase):
    def valid_analysis(self):
        return {
            "meta": {"candidate_name": "Candidate", "job_title": "Engineer", "company": "Acme", "location": "Remote", "seniority": "Senior", "analysis_confidence": 0.8},
            "scores": {"overall_match_score": 1, "resume_quality_score": 75, "skills_match_score": 80, "experience_match_score": 70, "seniority_match_score": 60, "domain_match_score": 50, "culture_soft_skills_score": 90, "weights_used": {"skills": 0.35, "experience": 0.25, "seniority": 0.15, "domain": 0.15, "culture": 0.10}, "keyword_coverage_split": {"hard_skills": {}, "soft_skills": {}, "other_keywords": {}}},
            "verdict": {"label": "GOOD_MATCH", "one_liner": "Good evidence for most requirements.", "summary": "A calibrated summary."},
            "radar_chart": {"dimensions": ["Skills", "Experience", "Seniority", "Domain", "Culture", "Education"], "candidate": [80, 70, 60, 50, 90, 70], "job_expectation": [100, 100, 100, 100, 100, 100]},
            "skills_breakdown": [{"skill": "Python", "category": "HARD", "importance": "REQUIRED", "status": "MATCHED", "evidence": "Built Python services", "gap_severity": "NONE"}],
            "experience_timeline": [{"company": "Acme", "role": "Engineer", "period": "2020-2024", "duration_months": 48, "relevance_to_job": "HIGH"}],
            "resume_audit": {"job_title_match": {"status": "MATCH", "feedback": "Present"}, "degree_match": {"status": "NO_REQUIREMENT", "feedback": "Not required"}, "word_count": {"count": 300, "status": "OPTIMAL", "feedback": "Good"}, "contact_info": {"has_email": True, "has_phone": True, "feedback": "Present"}, "accomplishments": {"count": 2, "status": "GOOD", "feedback": "Measured"}, "buzz_words": {"status": "CLEAN", "suggestions": []}, "verb_choice": {"status": "CLEAN", "suggestions": []}, "first_person": {"status": "CLEAN", "suggestions": []}, "date_formatting": {"status": "CLEAN", "suggestions": []}, "general_formatting": {"status": "NOT_ASSESSABLE", "suggestions": []}},
            "strengths": [{"title": "Python", "detail": "Relevant experience", "evidence": "Built Python services"}],
            "gaps": [{"title": "Domain", "detail": "Limited evidence", "severity": "LOW", "mitigation": "Study the domain"}],
            "deal_breakers": [], "resume_improvements": ["Add metrics"], "interview_prep": ["System design"],
            "keyword_coverage": {"matched_keywords": ["Python"], "missing_keywords": [], "coverage_percent": 100},
            "visualization_hints": {"highlight_color_theme": "green_amber_red", "primary_chart": "radar", "secondary_charts": ["score_bars"], "show_gauge_for_overall": True},
        }

    def test_valid_analysis_recalculates_weighted_overall_score(self):
        result = parse_analysis_json(json.dumps(self.valid_analysis()))

        self.assertEqual(result["scores"]["overall_match_score"], 71)

    def test_accepts_json_markdown_fence(self):
        result = parse_analysis_json(f"```json\n{json.dumps(self.valid_analysis())}\n```")

        self.assertEqual(result["verdict"]["label"], "GOOD_MATCH")

    def test_rejects_invalid_score(self):
        analysis = self.valid_analysis()
        analysis["scores"]["skills_match_score"] = 101

        with self.assertRaisesRegex(ValueError, "skills_match_score"):
            parse_analysis_json(json.dumps(analysis))

    def test_rejects_unreadable_input_response(self):
        with self.assertRaisesRegex(ValueError, "resume is empty"):
            parse_analysis_json('{"error":"UNREADABLE_INPUT","details":"The resume is empty"}')

    def test_server_calculates_resume_facts_and_category_coverage(self):
        analysis = self.valid_analysis()
        resume = "candidate@example.com +49 123 456 7890 " + "word " * 298

        result = parse_analysis_json(json.dumps(analysis), resume_text=resume)

        self.assertEqual(result["resume_audit"]["word_count"]["status"], "OPTIMAL")
        self.assertTrue(result["resume_audit"]["contact_info"]["has_email"])
        self.assertTrue(result["resume_audit"]["contact_info"]["has_phone"])
        self.assertEqual(result["scores"]["keyword_coverage_split"]["hard_skills"]["ratio"], "1/1")

    @patch("chat.views.time.sleep")
    @patch("chat.views.ai_completion")
    def test_analysis_retries_one_timeout(self, completion, sleep):
        expected_response = Mock()
        completion.side_effect = [requests.ReadTimeout("slow provider"), expected_response]

        result = ai_analysis_completion(Mock(), {"model": "test", "messages": []})

        self.assertIs(result, expected_response)
        self.assertEqual(completion.call_count, 2)
        self.assertEqual(completion.call_args.kwargs["timeout"], (15, 300))
        sleep.assert_called_once_with(1)

    @patch("chat.views.time.sleep")
    @patch("chat.views.ai_completion_with_curl")
    @patch("chat.views.ai_completion")
    def test_analysis_uses_curl_after_ssl_retries(self, completion, curl_completion, sleep):
        completion.side_effect = requests.exceptions.SSLError("unexpected EOF")
        expected_response = Mock()
        curl_completion.return_value = expected_response

        request = Mock()
        payload = {"model": "test", "messages": []}
        result = ai_analysis_completion(request, payload)

        self.assertIs(result, expected_response)
        self.assertEqual(completion.call_count, 3)
        self.assertEqual([call.args[0] for call in sleep.call_args_list], [1, 3])
        curl_completion.assert_called_once_with(request, payload)


class TailoredResumeValidationTests(SimpleTestCase):
    def resume_data(self):
        return {"contact": {"name": "Candidate", "headline": "Engineer", "email": "[ADD EMAIL]", "phone": "", "location": "", "links": []}, "professional_summary": "Engineer", "skills": [{"name": "Python", "source_memory_ids": ["memory-1"]}], "experience": [{"company": "Acme", "role": "Engineer", "location": "", "start_date": "2020", "end_date": "2024", "bullets": [{"text": "Built services", "source_memory_ids": ["memory-1"]}], "source_memory_ids": ["memory-1"]}], "projects": [], "education": [], "certifications": [], "languages": [], "generation_notes": {"keywords_used": ["Python"], "keywords_omitted_due_to_missing_evidence": [], "placeholder_fields": ["email"]}}

    def test_accepts_memory_grounded_resume(self):
        result = validate_resume_data(self.resume_data(), {"memory-1"}, require_sources=True)

        self.assertEqual(result["skills"][0]["name"], "Python")
        self.assertEqual(resume_placeholder_count(result), 1)

    def test_rejects_unknown_memory_source(self):
        with self.assertRaisesRegex(ValueError, "unknown Personal Memory"):
            validate_resume_data(self.resume_data(), {"different-memory"}, require_sources=True)

    def test_rejects_generated_bullet_without_source(self):
        data = self.resume_data()
        data["experience"][0]["bullets"][0]["source_memory_ids"] = []

        with self.assertRaisesRegex(ValueError, "must cite Personal Memory"):
            validate_resume_data(data, {"memory-1"}, require_sources=True)
