from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hello', '0006_order'),
    ]

    operations = [
        migrations.CreateModel(
            name='SalesSummary',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('period_type', models.CharField(choices=[('day', 'Day'), ('week', 'Week'), ('month', 'Month'), ('year', 'Year')], max_length=10)),
                ('period_start', models.DateField()),
                ('total_amount', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ('-period_start',),
            },
        ),
        migrations.AlterUniqueTogether(
            name='salessummary',
            unique_together={('period_type', 'period_start')},
        ),
    ]


