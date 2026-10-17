from django.urls import path

from . import views

urlpatterns = [
    path('my-submissions/', views.my_submissions, name='cashier-my-submissions'),

    path('submissions/cash-ins/<int:pk>/resubmit/',
         views.resubmit_cash_in, name='cashier-resubmit-cash-in'),
    path('submissions/expenses/<int:pk>/resubmit/',
         views.resubmit_expense, name='cashier-resubmit-expense'),
    path('submissions/damages/<int:pk>/resubmit/',
         views.resubmit_damage, name='cashier-resubmit-damage'),

    path('submissions/cash-ins/<int:pk>/receipt/',
         views.receipt, name='cashier-receipt'),

    path('daily-summary/', views.daily_summary, name='cashier-daily-summary'),
    path('weekly-summary/', views.weekly_summary, name='cashier-weekly-summary'),
]