from django.db import migrations


def seed_piece(apps, schema_editor):
    Unit = apps.get_model("core", "Unit")
    if not Unit.objects.exists():
        Unit.objects.create(name="Piece", sort_order=0)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0006_units_discount_product_fk"),
    ]

    operations = [
        migrations.RunPython(seed_piece, noop_reverse),
    ]
