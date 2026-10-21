from django.core.management.base import BaseCommand
from django.db import transaction

from chat.management.commands.seed_companies import build_company_data
from chat.models import Company


class Command(BaseCommand):
    help = "Remove the sample companies created by the seed_companies command."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show how many seeded companies would be removed without deleting them.",
        )

    def handle(self, *args, **options):
        seeded_websites = [company["website"] for company in build_company_data()]
        seeded_companies = Company.objects.filter(website__in=seeded_websites)
        company_count = seeded_companies.count()

        if options["dry_run"]:
            self.stdout.write(
                self.style.WARNING(
                    f"Dry run: {company_count} seeded companies would be removed."
                )
            )
            return

        with transaction.atomic():
            deleted_objects, deletion_details = seeded_companies.delete()

        deleted_companies = deletion_details.get(Company._meta.label, 0)
        related_objects = deleted_objects - deleted_companies
        self.stdout.write(
            self.style.SUCCESS(
                f"Removed {deleted_companies} seeded companies and "
                f"{related_objects} related records."
            )
        )
