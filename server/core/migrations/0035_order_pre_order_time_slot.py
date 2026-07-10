from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0034_product_variants"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="pre_order_time_slot",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Customer-selected delivery time slot label (e.g. 9:00 AM – 11:00 AM).",
                max_length=64,
                verbose_name="pre-order time slot",
            ),
        ),
    ]
