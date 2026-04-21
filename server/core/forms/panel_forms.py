"""Forms for the custom staff admin panel (template views)."""

from __future__ import annotations

import json

from django import forms
from django.contrib.auth import get_user_model
from django.utils.text import slugify

from ..models import Category, Notification, Order, ParentCategory, Product, SuperSetting

User = get_user_model()


class PanelLoginForm(forms.Form):
    phone = forms.CharField(
        max_length=15,
        label="Phone",
        widget=forms.TextInput(attrs={"autocomplete": "tel", "placeholder": "Registered staff phone"}),
    )
    password = forms.CharField(
        label="Password",
        strip=False,
        widget=forms.PasswordInput(attrs={"autocomplete": "current-password"}),
    )


class ParentCategoryPanelForm(forms.ModelForm):
    class Meta:
        model = ParentCategory
        fields = (
            "name",
            "slug",
            "description",
            "image",
            "sort_order",
            "is_active",
        )
        widgets = {
            "description": forms.Textarea(attrs={"rows": 3}),
            "slug": forms.TextInput(attrs={"placeholder": "Auto-filled from name if left empty"}),
        }

    def clean_slug(self):
        slug = self.cleaned_data.get("slug") or ""
        slug = slug.strip()
        if not slug and self.cleaned_data.get("name"):
            slug = slugify(self.cleaned_data["name"])[:120]
        if not slug:
            raise forms.ValidationError("Slug is required (or provide a name to auto-generate).")
        qs = ParentCategory.objects.filter(slug=slug)
        if self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise forms.ValidationError("A parent category with this slug already exists.")
        return slug


class CategoryPanelForm(forms.ModelForm):
    class Meta:
        model = Category
        fields = (
            "parent",
            "name",
            "slug",
            "description",
            "image",
            "sort_order",
            "is_active",
        )
        widgets = {
            "description": forms.Textarea(attrs={"rows": 3}),
            "slug": forms.TextInput(attrs={"placeholder": "Auto-filled from name if left empty"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["parent"].queryset = ParentCategory.objects.order_by("sort_order", "name")

    def clean_slug(self):
        slug = self.cleaned_data.get("slug") or ""
        slug = slug.strip()
        if not slug and self.cleaned_data.get("name"):
            slug = slugify(self.cleaned_data["name"])[:120]
        if not slug:
            raise forms.ValidationError("Slug is required (or provide a name to auto-generate).")
        qs = Category.objects.filter(slug=slug)
        if self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise forms.ValidationError("A category with this slug already exists.")
        return slug


class ProductPanelForm(forms.ModelForm):
    class Meta:
        model = Product
        fields = (
            "category",
            "name",
            "slug",
            "description",
            "short_description",
            "price",
            "discount_type",
            "discount_value",
            "unit",
            "stock_quantity",
            "is_available",
            "is_featured",
            "is_veg",
            "thumbnail_url",
            "sort_order",
        )
        widgets = {
            "description": forms.Textarea(attrs={"rows": 4}),
            "short_description": forms.Textarea(attrs={"rows": 2}),
        }

    def clean_slug(self):
        slug = self.cleaned_data.get("slug") or ""
        slug = slug.strip()
        if not slug and self.cleaned_data.get("name"):
            slug = slugify(self.cleaned_data["name"])[:220]
        if not slug:
            raise forms.ValidationError("Slug is required (or provide a name to auto-generate).")
        qs = Product.objects.filter(slug=slug)
        if self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise forms.ValidationError("A product with this slug already exists.")
        return slug

    def clean_price(self):
        price = self.cleaned_data["price"]
        if price is not None and price < 0:
            raise forms.ValidationError("Price cannot be negative.")
        return price


class OrderStatusPanelForm(forms.ModelForm):
    class Meta:
        model = Order
        fields = ("status",)


class DeliveryBoyPanelForm(forms.ModelForm):
    password = forms.CharField(
        required=False,
        strip=False,
        widget=forms.PasswordInput(attrs={"autocomplete": "new-password"}),
        help_text="Leave blank to keep the current password when editing.",
    )

    class Meta:
        model = User
        fields = (
            "name",
            "phone",
            "email",
            "is_active",
            "is_staff",
            "is_delivery_boy",
            "address",
            "profile_photo",
            "latitude",
            "longitude",
        )
        widgets = {
            "address": forms.Textarea(attrs={"rows": 2}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["is_delivery_boy"].initial = True
        if not self.instance.pk:
            self.fields["password"].required = True

    def clean_phone(self):
        phone = self.cleaned_data["phone"].strip()
        qs = User.objects.filter(phone=phone)
        if self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise forms.ValidationError("This phone is already registered.")
        return phone

    def save(self, commit=True):
        user = super().save(commit=False)
        user.is_delivery_boy = True
        pwd = self.cleaned_data.get("password")
        if pwd:
            user.set_password(pwd)
        elif not user.pk:
            user.set_unusable_password()
        if commit:
            user.save()
        return user


class NotificationPanelForm(forms.ModelForm):
    extra_json = forms.CharField(
        required=False,
        label="Extra data (JSON)",
        widget=forms.Textarea(attrs={"rows": 3, "placeholder": '{"key": "value"} optional JSON'}),
        help_text="Optional JSON object stored with the notification.",
    )

    class Meta:
        model = Notification
        fields = ("type", "title", "body", "medium")
        widgets = {
            "body": forms.Textarea(attrs={"rows": 4}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk and self.instance.data is not None:
            self.initial["extra_json"] = json.dumps(self.instance.data, indent=2)

    def save(self, commit=True):
        obj = super().save(commit=False)
        obj.data = self.cleaned_data.get("extra_json")
        if commit:
            obj.save()
        return obj

    def clean_extra_json(self):
        raw = self.cleaned_data.get("extra_json") or ""
        raw = raw.strip()
        if not raw:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            raise forms.ValidationError(f"Invalid JSON: {e}") from e


class StoreSettingsPanelForm(forms.ModelForm):
    class Meta:
        model = SuperSetting
        fields = (
            "name",
            "logo",
            "phone",
            "address",
            "latitude",
            "longitude",
            "meta_title",
            "meta_description",
            "meta_keywords",
            "delivery_charge_per_km",
            "is_open",
            "android_file",
            "google_playstore_link",
            "ios_file",
            "applestore_link",
            "android_version",
            "ios_version",
        )
        widgets = {
            "address": forms.Textarea(attrs={"rows": 3}),
            "meta_description": forms.Textarea(attrs={"rows": 2}),
        }
