from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0023_supersetting_customer_content"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="platform_fee_amount",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0.00"),
                help_text="Service/platform fee included in totals when applicable.",
                max_digits=10,
                verbose_name="platform fee",
            ),
        ),
    ]
