from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from chat.models import Company


COMPANY_PREFIXES = (
    "Aster",
    "Bluewave",
    "Cedar",
    "Delta",
    "Evergreen",
    "Frontier",
    "Golden",
    "Harbor",
    "Ironwood",
    "Juniper",
    "Keystone",
)

COMPANY_PROFILES = (
    {
        "suffix": "Analytics",
        "industry": "Data and Analytics",
        "size": "51-200 employees",
        "location": "Tehran, Iran",
        "summary": "Builds analytics products that help teams understand and act on business data.",
    },
    {
        "suffix": "Cloud",
        "industry": "Cloud Computing",
        "size": "201-500 employees",
        "location": "Dubai, UAE",
        "summary": "Provides cloud infrastructure and managed platform services for growing businesses.",
    },
    {
        "suffix": "Labs",
        "industry": "Software Development",
        "size": "11-50 employees",
        "location": "Berlin, Germany",
        "summary": "Develops modern software products and prototypes for technology companies.",
    },
    {
        "suffix": "Systems",
        "industry": "Enterprise Software",
        "size": "501-1000 employees",
        "location": "London, United Kingdom",
        "summary": "Creates enterprise systems for operations, finance, and customer management.",
    },
    {
        "suffix": "Works",
        "industry": "Digital Products",
        "size": "51-200 employees",
        "location": "Toronto, Canada",
        "summary": "Designs and delivers digital products for organizations across multiple industries.",
    },
)


def build_company_data():
    companies = []
    for prefix in COMPANY_PREFIXES:
        for profile in COMPANY_PROFILES:
            name = f"{prefix} {profile['suffix']}"
            domain = f"{prefix}-{profile['suffix']}".lower()
            companies.append(
                {
                    "name": name,
                    "aliases": [f"{prefix} {profile['suffix'][0]}", name.replace(" ", "")],
                    "website": f"https://{domain}.example.com",
                    "linkedin_url": f"https://www.linkedin.com/company/{domain}",
                    "industry": profile["industry"],
                    "size": profile["size"],
                    "location": profile["location"],
                    "summary": profile["summary"],
                }
            )
    return companies


class Command(BaseCommand):
    help = "Create 55 sample companies efficiently with bulk_create."

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size",
            type=int,
            default=55,
            help="Number of companies inserted per database batch (default: 55).",
        )

    def handle(self, *args, **options):
        batch_size = options["batch_size"]
        if batch_size < 1:
            raise CommandError("--batch-size must be greater than zero.")

        company_data = build_company_data()
        existing_names = {
            name.casefold()
            for name in Company.objects.filter(
                name__in=[company["name"] for company in company_data]
            ).values_list("name", flat=True)
        }
        companies = [
            Company(**data)
            for data in company_data
            if data["name"].casefold() not in existing_names
        ]

        with transaction.atomic():
            Company.objects.bulk_create(companies, batch_size=batch_size)

        skipped = len(company_data) - len(companies)
        self.stdout.write(
            self.style.SUCCESS(
                f"Created {len(companies)} companies with bulk_create; "
                f"skipped {skipped} existing companies."
            )
        )
