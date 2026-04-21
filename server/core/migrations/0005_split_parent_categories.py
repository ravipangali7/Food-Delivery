# Generated manually: split self-referential Category into ParentCategory + subcategory Category.

import django.db.models.deletion
from django.db import migrations, models


def split_categories_forward(apps, schema_editor):
    OldCategory = apps.get_model("core", "Category")
    ParentCategory = apps.get_model("core", "ParentCategory")
    Product = apps.get_model("core", "Product")

    roots = list(OldCategory.objects.filter(parent_id__isnull=True).order_by("id"))
    root_pk_to_parent_pk: dict[int, int] = {}

    for root in roots:
        pc = ParentCategory(
            name=root.name,
            slug=root.slug,
            description=root.description or "",
            sort_order=root.sort_order,
            is_active=root.is_active,
        )
        if getattr(root, "image", None):
            pc.image = root.image
        pc.save()
        root_pk_to_parent_pk[root.pk] = pc.pk

    for ch in OldCategory.objects.filter(parent_id__isnull=False).order_by("id"):
        mapped = root_pk_to_parent_pk.get(ch.parent_id)
        if mapped is None:
            continue
        ch.parent_category_id = mapped
        ch.save(update_fields=["parent_category_id"])

    for root in roots:
        pc_pk = root_pk_to_parent_pk[root.pk]
        prods = Product.objects.filter(category_id=root.pk)
        children = OldCategory.objects.filter(parent_id=root.pk).order_by("sort_order", "name")
        if children.exists():
            target = children.first()
            prods.update(category_id=target.pk)
        elif prods.exists():
            slug = f"{root.slug}-general"
            n = 0
            while OldCategory.objects.filter(slug=slug).exists():
                n += 1
                slug = f"{root.slug}-general-{n}"
            gen = OldCategory(
                name="General",
                slug=slug,
                description="",
                parent_category_id=pc_pk,
                sort_order=0,
                is_active=True,
            )
            gen.save()
            prods.update(category_id=gen.pk)

    OldCategory.objects.filter(pk__in=[r.pk for r in roots]).delete()


def split_categories_backward(apps, schema_editor):
    """Not reversible without data loss."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0004_remove_coupon_payment"),
    ]

    operations = [
        migrations.CreateModel(
            name="ParentCategory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100, verbose_name="name")),
                ("slug", models.SlugField(max_length=120, unique=True, verbose_name="slug")),
                ("description", models.TextField(blank=True, null=True, verbose_name="description")),
                ("image", models.ImageField(blank=True, null=True, upload_to="parent_categories/", verbose_name="image")),
                ("sort_order", models.PositiveSmallIntegerField(default=0, verbose_name="sort order")),
                ("is_active", models.BooleanField(default=True, verbose_name="active")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="created at")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="updated at")),
            ],
            options={
                "verbose_name": "parent category",
                "verbose_name_plural": "parent categories",
                "db_table": "parent_categories",
                "ordering": ["sort_order", "name"],
            },
        ),
        migrations.AddField(
            model_name="category",
            name="parent_category",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="subcategories_migrate",
                to="core.parentcategory",
                verbose_name="parent category",
            ),
        ),
        migrations.RunPython(split_categories_forward, split_categories_backward),
        migrations.RemoveField(
            model_name="category",
            name="parent",
        ),
        migrations.RemoveField(
            model_name="category",
            name="image_url",
        ),
        migrations.RenameField(
            model_name="category",
            old_name="parent_category",
            new_name="parent",
        ),
        migrations.AlterField(
            model_name="category",
            name="parent",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="subcategories",
                to="core.parentcategory",
                verbose_name="parent category",
            ),
        ),
        migrations.AlterField(
            model_name="category",
            name="image",
            field=models.ImageField(blank=True, null=True, upload_to="categories/subs/", verbose_name="image"),
        ),
        migrations.AlterModelOptions(
            name="category",
            options={
                "ordering": ["sort_order", "name"],
                "verbose_name": "subcategory",
                "verbose_name_plural": "subcategories",
            },
        ),
    ]
