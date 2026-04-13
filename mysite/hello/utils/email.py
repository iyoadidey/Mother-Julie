import importlib
from django.core.mail import send_mail
from django.conf import settings


def send_otp_email(to_email, otp):
    subject = "Your Verification Code"
    html_content = f"""
    <h2>Verify your account</h2>
    <p>Your OTP code is:</p>
    <h1>{otp}</h1>
    """
    plain_content = (
        "Verify your account\n\n"
        f"Your OTP code is: {otp}"
    )

    try:
        if settings.BREVO_API_KEY:
            sib_api_v3_sdk = importlib.import_module("sib_api_v3_sdk")
            configuration = sib_api_v3_sdk.Configuration()
            configuration.api_key["api-key"] = settings.BREVO_API_KEY
            api_instance = sib_api_v3_sdk.TransactionalEmailsApi(
                sib_api_v3_sdk.ApiClient(configuration)
            )
            send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
                to=[{"email": to_email}],
                sender={
                    "name": "Mother Julie",
                    "email": settings.DEFAULT_FROM_EMAIL
                },
                subject=subject,
                html_content=html_content
            )
            api_instance.send_transac_email(send_smtp_email)
            return True
    except Exception as e:
        print("Brevo error:", e)

    try:
        send_mail(
            subject,
            plain_content,
            settings.DEFAULT_FROM_EMAIL,
            [to_email],
            fail_silently=False,
        )
        return True
    except Exception as e:
        print("OTP fallback email error:", e)
        return False