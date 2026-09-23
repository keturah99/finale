from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from .models import Department, Role
from .serializers import UserSerializer, DepartmentSerializer, RoleSerializer
from .permissions import IsSuperUser
from rest_framework.decorators import action


User = get_user_model()



class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('username')
    serializer_class = UserSerializer
    permission_classes = [IsSuperUser]

    @action(detail=False, methods=['get'],
                permission_classes=[IsAuthenticated])
    def me(self, request):
        """Return the currently authenticated user's profile."""
        return Response(UserSerializer(request.user).data)


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all().order_by('name')
    serializer_class = DepartmentSerializer
    permission_classes = [IsSuperUser]


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all().order_by('name')
    serializer_class = RoleSerializer
    permission_classes = [IsSuperUser]