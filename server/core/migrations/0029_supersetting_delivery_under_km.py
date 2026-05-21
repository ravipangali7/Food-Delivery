from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0028_orderchatstaffreadstate"),
    ]

    operations = [
        migrations.AddField(
            model_name="supersetting",
            name="delivery_under_km",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0.00"),
                help_text="Within this distance (km), delivery fee is flat (radius × per-km rate). 0 = charge by actual distance only.",
                max_digits=6,
                verbose_name="short delivery radius (km)",
            ),
        ),
    ]
