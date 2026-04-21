from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0019_supersetting_app_version_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="orderchatmessage",
            name="customer_rider",
            field=models.BooleanField(
                default=False,
                help_text="If true, only the ordering customer, the assigned delivery partner, and store staff see this message.",
                verbose_name="customer–rider thread",
            ),
        ),
    ]
