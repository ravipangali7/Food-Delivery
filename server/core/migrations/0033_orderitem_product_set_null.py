from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0032_alter_supersetting_delivery_under_km"),
    ]

    operations = [
        migrations.AlterField(
            model_name="orderitem",
            name="product",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="order_items",
                to="core.product",
                verbose_name="product",
            ),
        ),
    ]
