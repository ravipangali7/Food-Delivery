from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0025_product_is_sweet"),
    ]

    operations = [
        migrations.AddField(
            model_name="cartitem",
            name="is_preorder",
            field=models.BooleanField(default=False, verbose_name="pre-order line"),
        ),
        migrations.AddField(
            model_name="order",
            name="is_preorder",
            field=models.BooleanField(default=False, verbose_name="pre-order"),
        ),
        migrations.AddField(
            model_name="order",
            name="pre_order_date_time",
            field=models.DateTimeField(
                blank=True,
                null=True,
                verbose_name="pre-order for",
                help_text="When the customer wants this pre-order prepared or ready.",
            ),
        ),
    ]
