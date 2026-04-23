from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0024_order_platform_fee_amount"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="is_sweet",
            field=models.BooleanField(default=False, verbose_name="sweet"),
        ),
    ]
