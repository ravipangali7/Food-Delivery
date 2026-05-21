# Generated manually for guest checkout support

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0029_supersetting_delivery_under_km"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="guest_access_token",
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text="Token for viewing a guest order without logging in.",
                max_length=64,
                null=True,
                unique=True,
                verbose_name="guest access token",
            ),
        ),
        migrations.AlterField(
            model_name="order",
            name="user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="orders",
                to=settings.AUTH_USER_MODEL,
                verbose_name="customer",
            ),
        ),
    ]
