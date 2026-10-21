import base64

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

LOGO_COLORS = (
    ("#635BFF", "#8B85FF"),
    ("#147D64", "#35B792"),
    ("#B45309", "#F59E0B"),
    ("#1D4ED8", "#60A5FA"),
)

DEFAULT_COMPANY_COUNT = 55


def fake_logo_data_url(name, color_index):
    """Build a deterministic, self-contained logo for seeded demo companies."""
    initials = "".join(part[0] for part in name.split()[:2]).upper()
    start, end = LOGO_COLORS[color_index % len(LOGO_COLORS)]
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="{start}"/><stop offset="1" stop-color="{end}"/></linearGradient></defs>
<rect width="128" height="128" rx="24" fill="url(#g)"/>
<text x="64" y="72" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="42" font-weight="700">{initials}</text>
</svg>'''
    encoded = base64.b64encode(svg.encode("utf-8")).decode("ascii")
    return f"data:image/svg+xml;base64,{encoded}"


def build_company_data(count=DEFAULT_COMPANY_COUNT):
    companies = []
    for prefix_index, prefix in enumerate(COMPANY_PREFIXES):
        for profile_index, profile in enumerate(COMPANY_PROFILES):
            name = f"{prefix} {profile['suffix']}"
            domain = f"{prefix}-{profile['suffix']}".lower()
            company = {
                    "name": name,
                    "aliases": [f"{prefix} {profile['suffix'][0]}", name.replace(" ", "")],
                    "website": f"https://{domain}.example.com",
                    "linkedin_url": f"https://www.linkedin.com/company/{domain}",
                    "industry": profile["industry"],
                    "size": profile["size"],
                    "location": profile["location"],
                    "summary": profile["summary"],
                }
            # Add fake logos to a representative subset while preserving
            # initials-based fallbacks for the remaining sample companies.
            if (prefix_index + profile_index) % 3 == 0:
                company["brand_image_url"] = fake_logo_data_url(name, prefix_index + profile_index)
            companies.append(company)
    return companies[:count]


class Command(BaseCommand):
    help = "Create 55 sample companies efficiently with bulk_create."

    def add_arguments(self, parser):
        parser.add_argument(
            "--count",
            type=int,
            default=DEFAULT_COMPANY_COUNT,
            help="Number of sample companies to seed (default: 55).",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=55,
            help="Number of companies inserted per database batch (default: 55).",
        )

    def handle(self, *args, **options):
        count = options["count"]
        batch_size = options["batch_size"]
        if count < 1 or count > DEFAULT_COMPANY_COUNT:
            raise CommandError("--count must be between 1 and 55.")
        if batch_size < 1:
            raise CommandError("--batch-size must be greater than zero.")

        company_data = build_company_data(count)
        existing = {
            company.name.casefold(): company
            for company in Company.objects.filter(
                name__in=[company["name"] for company in company_data]
            )
        }
        companies = [
            Company(**data)
            for data in company_data
            if data["name"].casefold() not in existing
        ]
        companies_to_update = []
        for data in company_data:
            company = existing.get(data["name"].casefold())
            fake_logo = data.get("brand_image_url")
            if company and fake_logo and not company.brand_image_url:
                company.brand_image_url = fake_logo
                companies_to_update.append(company)

        with transaction.atomic():
            Company.objects.bulk_create(companies, batch_size=batch_size)
            Company.objects.bulk_update(
                companies_to_update,
                ["brand_image_url"],
                batch_size=batch_size,
            )

        skipped = len(company_data) - len(companies)
        self.stdout.write(
            self.style.SUCCESS(
                f"Created {len(companies)} companies with bulk_create; "
                f"added fake logos to {len(companies_to_update)} existing companies; "
                f"skipped {skipped} existing companies."
            )
        )
