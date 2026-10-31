import json
from datetime import timedelta
from unittest.mock import Mock, patch

import requests
from django.test import SimpleTestCase, TestCase
from django.utils import timezone

from .models import Company, CoverLetterVersion, Folder, JobApplication, MemoryNode, StoredFile
from .views import (
    ai_analysis_completion,
    build_resume_pdf_header,
    enrich_analysis_work_schedule,
    format_education_period,
    TAILORED_RESUME_PROMPT,
    COVER_LETTER_PROMPT,
    company_profile_for_application,
    generate_cover_letter,
    parse_analysis_json,
    resume_placeholder_count,
    normalize_resume_template,
    normalize_cover_letter_text,
    pdf_cover_letter_text,
    cover_letter_template_data,
    save_memory_blocks,
    tailored_resume_user_prompt,
    validate_resume_data,
)
from reportlab.lib.styles import getSampleStyleSheet


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


class MemoryArrangementTests(TestCase):
    @patch("chat.views.ai_completion")
    def test_sends_timestamps_and_instructs_ai_to_prefer_newer_conflicting_facts(self, mock_completion):
        older = MemoryNode.objects.create(name="English proficiency", content="Basic", is_leaf=True)
        newer = MemoryNode.objects.create(name="Language update", content="My English level is Intermediate", is_leaf=True)
        MemoryNode.objects.filter(id=older.id).update(updated_at=timezone.now() - timedelta(days=30))
        MemoryNode.objects.filter(id=newer.id).update(updated_at=timezone.now())
        MemoryNode.objects.create(name="Archive before arrangement 2026-01-01 00:00 UTC", content="English: Beginner", is_leaf=True)
        provider_response = Mock()
        provider_response.raise_for_status.return_value = None
        provider_response.json.return_value = {"choices": [{"message": {"content": '{"groups":[{"name":"Languages","items":[{"name":"English proficiency","content":"Intermediate"}]}]}'}}]}
        mock_completion.return_value = provider_response

        response = self.client.post("/api/memory/arrange/")

        self.assertEqual(response.status_code, 200)
        messages = mock_completion.call_args.args[1]["messages"]
        self.assertIn("newest statement", messages[0]["content"])
        self.assertIn("English proficiency: Basic", messages[1]["content"])
        self.assertIn("Language update: My English level is Intermediate", messages[1]["content"])
        self.assertLess(messages[1]["content"].index("Basic"), messages[1]["content"].index("Intermediate"))
        self.assertNotIn("English: Beginner", messages[1]["content"])
        self.assertTrue(MemoryNode.objects.filter(name="English proficiency", content="Intermediate").exists())


class JobApplicationTitleTests(TestCase):
    def test_creates_and_serializes_job_title(self):
        response = self.client.post(
            "/api/job-applications/",
            data={"company_name": "Acme", "job_title": "Senior Backend Engineer"},
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["job_title"], "Senior Backend Engineer")
        self.assertEqual(JobApplication.objects.get().job_title, "Senior Backend Engineer")

    def test_requires_job_title_when_creating_application(self):
        response = self.client.post(
            "/api/job-applications/",
            data={"company_name": "Acme", "job_title": "   "},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "Job title is required.")
        self.assertFalse(JobApplication.objects.exists())

    def test_updates_job_title(self):
        application = JobApplication.objects.create(
            company_name="Acme",
            job_title="Backend Engineer",
        )

        response = self.client.post(
            f"/api/job-applications/{application.id}/",
            data={"company_name": "Acme", "job_title": "Staff Backend Engineer"},
        )

        self.assertEqual(response.status_code, 200)
        application.refresh_from_db()
        self.assertEqual(application.job_title, "Staff Backend Engineer")


class JobAnalysisValidationTests(SimpleTestCase):
    def valid_analysis(self):
        return {
            "meta": {"candidate_name": "Candidate", "job_title": "Engineer", "company": "Acme", "location": "Remote", "seniority": "Senior", "analysis_confidence": 0.8},
            "confidence_assessment": {"missing_information": []},
            "resume_quality_assessment": {"missing_information": [{"title": "Project metrics", "detail": "Add supported project outcomes."}]},
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

    def test_accepts_evidence_backed_radar_rationales(self):
        analysis = self.valid_analysis()
        dimensions = analysis["radar_chart"]["dimensions"]
        analysis["radar_chart"]["rationales"] = [
            {
                "dimension": dimension,
                "candidate_reason": f"Candidate evidence for {dimension} supports this score.",
                "expectation_reason": f"The job description requires this level of {dimension}.",
            }
            for dimension in dimensions
        ]

        result = parse_analysis_json(json.dumps(analysis))

        education = result["radar_chart"]["rationales"][-1]
        self.assertEqual(education["dimension"], "Education")
        self.assertIn("Candidate evidence", education["candidate_reason"])

    def test_rejects_incomplete_radar_rationales(self):
        analysis = self.valid_analysis()
        analysis["radar_chart"]["rationales"] = [{
            "dimension": "Skills",
            "candidate_reason": "The candidate has matching skills.",
            "expectation_reason": "The role requires these skills.",
        }]

        with self.assertRaisesRegex(ValueError, "one entry per dimension"):
            parse_analysis_json(json.dumps(analysis))

    def test_truncates_skill_evidence_that_exceeds_model_word_limit(self):
        analysis = self.valid_analysis()
        analysis["skills_breakdown"][0]["evidence"] = " ".join(
            f"word-{index}" for index in range(1, 24)
        )

        result = parse_analysis_json(json.dumps(analysis))

        evidence = result["skills_breakdown"][0]["evidence"]
        self.assertEqual(len(evidence.split()), 20)
        self.assertEqual(evidence.split()[-1], "word-20")

    def test_rejects_non_string_skill_evidence(self):
        analysis = self.valid_analysis()
        analysis["skills_breakdown"][0]["evidence"] = ["Built Python services"]

        with self.assertRaisesRegex(ValueError, "Skill evidence must be a string"):
            parse_analysis_json(json.dumps(analysis))

    def test_server_calculates_resume_facts_and_category_coverage(self):
        analysis = self.valid_analysis()
        resume = "candidate@example.com +49 123 456 7890 " + "word " * 298

        result = parse_analysis_json(json.dumps(analysis), resume_text=resume)

        self.assertEqual(result["resume_audit"]["word_count"]["status"], "OPTIMAL")
        self.assertTrue(result["resume_audit"]["contact_info"]["has_email"])
        self.assertTrue(result["resume_audit"]["contact_info"]["has_phone"])
        self.assertEqual(result["scores"]["keyword_coverage_split"]["hard_skills"]["ratio"], "1/1")

    def test_work_schedule_uses_company_dst_rules_for_summer_and_winter(self):
        analysis = {
            "work_schedule": {
                "company_timezone": "Europe/Berlin",
                "company_work_start": "09:00",
                "company_work_end": "17:00",
                "schedule_confidence": 0.9,
            }
        }

        result = enrich_analysis_work_schedule(analysis, "Asia/Tehran")
        schedules = {
            item["season"]: item
            for item in result["work_schedule"]["seasonal_schedules"]
        }

        self.assertEqual(schedules["summer"]["user_work_start"], "10:30")
        self.assertEqual(schedules["winter"]["user_work_start"], "11:30")
        self.assertEqual(schedules["summer"]["utc_offset_difference_minutes"], -90)
        self.assertEqual(schedules["winter"]["utc_offset_difference_minutes"], -150)
        self.assertEqual(schedules["summer"]["company_utc_offset_minutes"], 120)
        self.assertEqual(schedules["winter"]["company_utc_offset_minutes"], 60)

    def test_southern_hemisphere_dst_is_identified_as_summer(self):
        analysis = {
            "work_schedule": {
                "company_timezone": "Australia/Sydney",
                "company_work_start": "09:00",
                "company_work_end": "17:00",
                "schedule_confidence": 0.9,
            }
        }

        result = enrich_analysis_work_schedule(analysis, "UTC")
        schedules = {
            item["season"]: item
            for item in result["work_schedule"]["seasonal_schedules"]
        }

        self.assertTrue(schedules["summer"]["reference_date"].endswith("-01-15"))
        self.assertEqual(schedules["summer"]["user_work_start"], "22:00")
        self.assertEqual(schedules["summer"]["user_work_start_day_offset"], -1)
        self.assertEqual(schedules["winter"]["user_work_start"], "23:00")

    def test_location_without_seasonal_offset_returns_both_seasonal_schedules(self):
        analysis = {
            "work_schedule": {
                "company_timezone": "Asia/Tehran",
                "company_work_start": "09:00",
                "company_work_end": "17:00",
                "schedule_confidence": 0.9,
            }
        }

        result = enrich_analysis_work_schedule(analysis, "UTC")
        schedules = result["work_schedule"]["seasonal_schedules"]

        self.assertEqual([item["season"] for item in schedules], ["winter", "summer"])
        self.assertEqual(schedules[0]["company_utc_offset_minutes"], 210)
        self.assertEqual(schedules[1]["company_utc_offset_minutes"], 210)
        self.assertFalse(schedules[0]["has_seasonal_time_change"])
        self.assertFalse(schedules[1]["has_seasonal_time_change"])
        self.assertEqual(result["work_schedule"]["user_work_start"], "05:30")

    def test_missing_hours_use_estimated_office_hours_from_company_timezone(self):
        analysis = {
            "work_schedule": {
                "company_timezone": "Asia/Dubai",
                "company_work_start": None,
                "company_work_end": None,
                "work_hours_basis": "The posting does not state working hours.",
                "schedule_confidence": 0.34,
            }
        }

        result = enrich_analysis_work_schedule(analysis, "Asia/Tehran")["work_schedule"]

        self.assertEqual(result["company_work_start"], "09:00")
        self.assertEqual(result["company_work_end"], "18:00")
        self.assertEqual(result["user_work_start"], "08:30")
        self.assertEqual(result["user_work_end"], "17:30")
        self.assertEqual(result["company_work_days"], ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
        self.assertTrue(result["work_hours_estimated"])
        self.assertTrue(result["work_days_estimated"])
        self.assertIn("Asia/Dubai", result["work_hours_basis"])

    def test_missing_timezone_does_not_estimate_working_hours(self):
        result = enrich_analysis_work_schedule({"work_schedule": {}}, "Asia/Tehran")["work_schedule"]

        self.assertIsNone(result["company_work_start"])
        self.assertIsNone(result["company_work_end"])
        self.assertEqual(result["company_work_days"], [])

    def test_explicit_working_days_are_not_replaced_by_location_estimate(self):
        analysis = {
            "work_schedule": {
                "company_timezone": "Asia/Dubai",
                "company_work_start": "10:00",
                "company_work_end": "19:00",
                "company_work_days": ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
                "work_days_basis": "Explicitly stated in the posting.",
            }
        }

        result = enrich_analysis_work_schedule(analysis, "Asia/Tehran")["work_schedule"]

        self.assertEqual(result["company_work_days"], ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"])
        self.assertFalse(result["work_days_estimated"])
        self.assertEqual(result["work_days_basis"], "Explicitly stated in the posting.")

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


class JobAnalysisMemoryTests(TestCase):
    def setUp(self):
        self.application = JobApplication.objects.create(
            company_name="Acme",
            job_description="Build and maintain Python services.",
        )
        self.analysis_url = f"/api/job-applications/{self.application.id}/analysis/"

    @patch("chat.views.ai_analysis_completion", side_effect=requests.Timeout)
    def test_allows_job_only_analysis_when_resume_and_memory_are_empty(self, completion):
        response = self.client.post(
            self.analysis_url,
            data=json.dumps({"model": "test-model"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 504)
        payload = completion.call_args.args[1]
        candidate_input = payload["messages"][1]["content"]
        self.assertTrue(candidate_input.startswith("CANDIDATE_BACKGROUND"))
        self.assertIn("If CANDIDATE_BACKGROUND is empty", candidate_input)

    @patch("chat.views.ai_analysis_completion", side_effect=requests.Timeout)
    def test_uses_personal_memory_when_resume_is_empty(self, completion):
        MemoryNode.objects.create(
            name="Backend experience",
            content="Built Python services for four years.",
            is_leaf=True,
        )

        response = self.client.post(
            self.analysis_url,
            data=json.dumps({"model": "test-model"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 504)
        payload = completion.call_args.args[1]
        candidate_input = payload["messages"][1]["content"]
        self.assertTrue(candidate_input.startswith("CANDIDATE_BACKGROUND"))
        self.assertIn("Built Python services for four years.", candidate_input)
        self.assertIn("Build and maintain Python services.", candidate_input)

    @patch("chat.views.ai_analysis_completion", side_effect=requests.Timeout)
    def test_uses_company_data_extraction_prompt_for_sync_analysis(self, completion):
        company = Company.objects.create(
            name="Acme",
            website="https://acme.example",
            location="Berlin, Germany",
        )

        response = self.client.post(
            self.analysis_url,
            data=json.dumps({"model": "test-model"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 504)
        payload = completion.call_args.args[1]
        system_prompt = payload["messages"][0]["content"]
        self.assertIn("COMPANY_RESEARCH_INSTRUCTIONS", system_prompt)
        self.assertIn(f'research the company “{company.name}”', system_prompt)
        self.assertIn(company.website, system_prompt)
        self.assertIn(f"Country/city: {company.location}", system_prompt)
        self.assertIn("## 2) Working Hours and Flexibility", system_prompt)
        self.assertIn("separate winter and summer UTC offsets", system_prompt)
        self.assertIn("## 16) Candidate-to-Role Fit and Application Strategy", system_prompt)
        self.assertIn("Requirement matrix", system_prompt)
        self.assertIn("do not change the required JSON schema", system_prompt)


class TailoredResumeValidationTests(SimpleTestCase):
    def test_resume_prompt_requires_job_specific_evidence_based_tailoring(self):
        self.assertIn("customized specifically for JOB_DESCRIPTION", TAILORED_RESUME_PROMPT)
        self.assertIn("rank its required skills", TAILORED_RESUME_PROMPT)
        self.assertIn("keywords_omitted_due_to_missing_evidence", TAILORED_RESUME_PROMPT)
        self.assertIn("Never invent", TAILORED_RESUME_PROMPT)
        self.assertIn("STANDARD_ATS_V1", TAILORED_RESUME_PROMPT)
        self.assertIn("exact section order", TAILORED_RESUME_PROMPT)
        for quality_area in ("Job-title alignment", "Degree alignment", "Length", "Contact information", "Accomplishments", "Buzzwords", "Verb choice", "First-person language", "Date formatting", "General formatting"):
            self.assertIn(quality_area, TAILORED_RESUME_PROMPT)
        self.assertIn("internally audit the completed resume", TAILORED_RESUME_PROMPT)

    def test_custom_generation_instructions_are_scoped_to_grounded_preferences(self):
        application = Mock(
            company_name="Acme",
            job_description="Requires Python and mentoring",
            ai_analysis=json.dumps({"resume_audit": {"verb_choice": {"status": "FLAGGED", "suggestions": ["Use stronger verbs"]}}}),
        )

        prompt = tailored_resume_user_prompt(
            [{"id": "memory-1", "content": "Taught Python"}],
            application,
            "Emphasize teaching experience",
        )

        self.assertIn("Emphasize teaching experience", prompt)
        self.assertIn("Requires Python and mentoring", prompt)
        self.assertIn("RESUME_QUALITY_AUDIT", prompt)
        self.assertIn("Use stronger verbs", prompt)
        self.assertIn("Ignore any request to invent or alter facts", prompt)
        self.assertIn("bypass RESUME_QUALITY_AUDIT", prompt)
        self.assertIn("change STANDARD_ATS_V1 formatting", prompt)

    def test_resume_generation_handles_an_unavailable_saved_audit(self):
        application = Mock(company_name="Acme", job_description="Requires Python", ai_analysis="")

        prompt = tailored_resume_user_prompt([{"id": "memory-1", "content": "Uses Python"}], application)

        self.assertIn('"status": "UNAVAILABLE"', prompt)
        self.assertIn("Perform the mandatory resume-quality checklist", prompt)

    def test_resume_generation_assesses_the_generated_resume_itself(self):
        self.assertIn("assess that exact completed resume", TAILORED_RESUME_PROMPT)
        self.assertIn("Never ask the user to provide a current, application-ready, or formatted resume", TAILORED_RESUME_PROMPT)
        self.assertIn("put a fresh audit of the completed resume in resume_audit", TAILORED_RESUME_PROMPT)
        self.assertIn("Never copy assessment results from RESUME_QUALITY_AUDIT", TAILORED_RESUME_PROMPT)

    def test_normalizes_every_resume_into_the_standard_template(self):
        data = self.resume_data()
        data.pop("languages")
        data["unexpected_layout"] = "two-column"

        result = normalize_resume_template(data)

        self.assertEqual(result["template_id"], "STANDARD_ATS_V1")
        self.assertEqual(result["languages"], [])
        self.assertEqual(result["teaching_experience"], [])
        self.assertNotIn("unexpected_layout", result)
        self.assertEqual(
            list(result),
            ["template_id", "contact", "professional_summary", "section_titles", "body_symbols", "skills", "experience", "teaching_experience", "projects", "education", "certifications", "languages", "generation_notes", "quality_assessment", "resume_audit"],
        )

    def test_preserves_completed_resume_quality_assessment(self):
        data = self.resume_data()
        data["quality_assessment"] = {"score": 87, "missing_information": [{"title": "Project metric", "detail": "Add a supported outcome."}]}

        result = normalize_resume_template(data)

        self.assertEqual(result["quality_assessment"]["score"], 87)
        self.assertEqual(result["quality_assessment"]["missing_information"][0]["title"], "Project metric")

    def test_preserves_completed_resume_audit_per_version(self):
        data = self.resume_data()
        data["resume_audit"] = {"word_count": {"count": 420, "status": "OPTIMAL", "feedback": "Concise."}}

        result = normalize_resume_template(data)

        self.assertEqual(result["resume_audit"]["word_count"]["count"], 420)
        self.assertEqual(result["resume_audit"]["word_count"]["status"], "OPTIMAL")

    def test_formats_numeric_education_periods_with_month_names(self):
        self.assertEqual(
            format_education_period("2020-09 – 2024/06"),
            "Sep 2020 – Jun 2024",
        )
        self.assertEqual(
            format_education_period("09/2020 - Present"),
            "Sep 2020 - Present",
        )
        self.assertEqual(format_education_period("2024-10"), "Oct 2024")
        self.assertEqual(format_education_period("October 2024"), "Oct 2024")
        self.assertEqual(format_education_period("September 2020 – January 2024"), "Sep 2020 – Jan 2024")

    def test_pdf_header_has_two_columns_and_stacked_name_and_position(self):
        contact = {
            "name": "Candidate Name",
            "headline": "Backend Engineer",
            "email": "candidate@example.com",
            "phone": "+49 123 456",
            "location": "Berlin",
            "links": ["https://www.linkedin.com/in/candidate"],
        }

        header = build_resume_pdf_header(contact, getSampleStyleSheet())

        self.assertEqual(len(header._cellvalues[0]), 2)
        identity = header._cellvalues[0][0]
        contact_details = header._cellvalues[0][1]
        self.assertEqual(len(identity), 2)
        self.assertIn("Candidate Name", identity[0].getPlainText())
        self.assertIn("Backend Engineer", identity[1].getPlainText())
        self.assertEqual(len(contact_details), 3)
        self.assertIn("candidate@example.com", contact_details[0].getPlainText())
        self.assertEqual(contact_details[1].getPlainText(), "+49 123 456 | Berlin")
        self.assertEqual(contact_details[2].getPlainText(), "linkedin.com/in/candidate")

    def resume_data(self):
        return {"contact": {"name": "Candidate", "headline": "Engineer", "email": "[ADD EMAIL]", "phone": "", "location": "", "links": []}, "professional_summary": "Engineer", "skills": [{"name": "Python", "source_memory_ids": ["memory-1"]}], "experience": [{"company": "Acme", "role": "Engineer", "location": "", "start_date": "2020", "end_date": "2024", "bullets": [{"text": "Built services", "source_memory_ids": ["memory-1"]}], "source_memory_ids": ["memory-1"]}], "projects": [], "education": [], "certifications": [], "languages": [], "generation_notes": {"keywords_used": ["Python"], "keywords_omitted_due_to_missing_evidence": [], "placeholder_fields": ["email"]}}

    def test_accepts_memory_grounded_resume(self):
        result = validate_resume_data(self.resume_data(), {"memory-1"}, require_sources=True)
        self.assertEqual(result["teaching_experience"], [])

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


class CoverLetterGenerationTests(TestCase):
    def setUp(self):
        self.application = JobApplication.objects.create(
            company_name="Acme", job_title="Engineer", job_description="Build reliable systems",
            company_description="Acme makes developer tools",
        )
        MemoryNode.objects.create(name="Experience", content="Built reliable Python services", is_leaf=True)

    @patch("chat.views.ai_analysis_completion")
    def test_first_generation_creates_cover_letter_version_one_with_job_and_company_context(self, completion):
        completion.return_value = Mock(raise_for_status=Mock(), json=Mock(return_value={"choices": [{"message": {"content": "Dear Hiring Team,\nI built reliable Python services.\nSincerely,\nCandidate"}}]}))

        response = self.client.post(
            f"/api/job-applications/{self.application.id}/cover-letters/generate/",
            data=json.dumps({"model": "test-model"}), content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["version_number"], 1)
        self.assertTrue(response.json()["is_current"])
        prompt = completion.call_args.args[1]["messages"]
        self.assertIn("COMPANY_PROFILE", prompt[1]["content"])
        self.assertIn("Build reliable systems", prompt[1]["content"])
        self.assertIn("Acme makes developer tools", prompt[1]["content"])
        self.assertIn("Never invent facts", COVER_LETTER_PROMPT)
        self.assertIn("separate signature block", COVER_LETTER_PROMPT)
        self.assertIn("Never join the closing, name, email, or phone", COVER_LETTER_PROMPT)
        self.assertIn("without Markdown, page numbers, sender header", COVER_LETTER_PROMPT)
        self.assertIn("Start with the greeting", COVER_LETTER_PROMPT)

    def test_requires_job_description_before_generation(self):
        self.application.job_description = ""
        self.application.save()

        response = self.client.post(
            f"/api/job-applications/{self.application.id}/cover-letters/generate/",
            data="{}", content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(CoverLetterVersion.objects.count(), 0)

    def test_pdf_export_accepts_current_edited_content(self):
        letter = CoverLetterVersion.objects.create(
            job_application=self.application,
            version_number=1,
            name="Acme cover letter v1",
            content="Saved content",
            is_current=True,
        )

        response = self.client.post(
            f"/api/job-applications/{self.application.id}/cover-letters/{letter.id}/pdf/",
            data=json.dumps({"content": "Dear Hiring Team,\n\nCurrent edited content"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn("attachment", response["Content-Disposition"])

    def test_normalizes_compound_words_and_signature_spacing(self):
        result = normalize_cover_letter_text(
            "I build full- stack systems.\n\nSincerely, Reza Sharifi reza@example.com"
        )

        self.assertEqual(
            result,
            "I build full-stack systems.\n\nSincerely,\n\nReza Sharifi\nreza@example.com",
        )

    def test_removes_extracted_page_number_and_prevents_pdf_hyphen_breaks(self):
        self.assertEqual(
            normalize_cover_letter_text("1\nfull- stack and Warsaw- based"),
            "full-stack and Warsaw-based",
        )
        self.assertEqual(pdf_cover_letter_text("full-stack"), "<nobr>full-stack</nobr>")

    def test_template_fields_are_editable_and_have_no_visible_placeholders(self):
        letter = CoverLetterVersion.objects.create(
            job_application=self.application,
            version_number=9,
            name="Editable template",
            content="Dear Team,\n\nBody.\n\nSincerely,\n\nReza Sharifi\nreza@example.com",
            template_data={"sender_name": "Edited Name", "role": "Edited Role", "company": "Edited Company", "date": "", "sender_email": ""},
        )

        fields = cover_letter_template_data(letter)

        self.assertEqual(fields["sender_name"], "Edited Name")
        self.assertEqual(fields["role"], "Edited Role")
        self.assertEqual(fields["company"], "Edited Company")
        self.assertEqual(fields["date"], "")
        self.assertEqual(fields["sender_email"], "")
