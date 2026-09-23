from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from core.models import Role

User = get_user_model()


class Command(BaseCommand):
    help = 'Assign a role to a user: assign_role <username> <role_name>'

    def add_arguments(self, parser):
        parser.add_argument('username')
        parser.add_argument('role_name')
        parser.add_argument('--remove', action='store_true')

    def handle(self, *args, **options):
        try:
            user = User.objects.get(username=options['username'])
        except User.DoesNotExist:
            raise CommandError(f"User '{options['username']}' not found")

        try:
            role = Role.objects.get(name=options['role_name'])
        except Role.DoesNotExist:
            raise CommandError(f"Role '{options['role_name']}' not found")

        if options['remove']:
            user.roles.remove(role)
            self.stdout.write(self.style.WARNING(
                f"Removed {role.name} from {user.username}"
            ))
        else:
            user.roles.add(role)
            self.stdout.write(self.style.SUCCESS(
                f"Assigned {role.name} to {user.username}"
            ))