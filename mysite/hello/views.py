from django.http import HttpResponse

def hello_world(request):
    return HttpResponse("Hello, world! This is your first Django view.")