import os
import asyncio

def load_template(template_name: str) -> str:
    """Load HTML template from templates folder or return a mock HTML."""
    return f"<html><body><h1>Mock Email: {template_name}</h1></body></html>"

async def send_email(to_email: str, subject: str, template_name: str, context: dict) -> bool:
    """
    Mock function to simulate sending an email.
    In a real app, this would use SMTP or an API like SendGrid.
    """
    html_content = load_template(template_name)
    # Simple replacement of variables
    for key, value in context.items():
        html_content = html_content.replace(f"{{{{{key}}}}}", str(value))
        
    print(f"--- MOCK EMAIL DELIVERED ---")
    print(f"TO: {to_email}")
    print(f"SUBJECT: {subject}")
    print(f"BODY:\n{html_content}")
    print(f"----------------------------")
    
    # Simulate network delay
    await asyncio.sleep(0.5)
    return True
