from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Department, Role


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ('Organization', {'fields': ('department', 'roles', 'phone')}),
    )
    list_display = ('username', 'email', 'department', 'is_staff')


admin.site.register(Department)
admin.site.register(Role)