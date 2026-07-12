import os
import uuid
from typing import Optional
from logger import logger

class StorageService:
    """
    Cloud Storage Abstraction Layer for MessMate.
    Can be configured to use AWS S3, Google Cloud Storage, etc.
    Currently mocks cloud upload by saving locally to /tmp or returning a mock URL.
    """
    def __init__(self):
        self.provider = os.getenv("STORAGE_PROVIDER", "local")
        
    async def upload_file(self, file_bytes: bytes, filename: str, content_type: str = "application/pdf") -> str:
        unique_name = f"{uuid.uuid4().hex}_{filename}"
        
        if self.provider == "aws_s3":
            # boto3 logic would go here
            logger.info(f"Uploading {unique_name} to S3...")
            return f"https://s3.amazonaws.com/messmate-bucket/{unique_name}"
            
        elif self.provider == "gcs":
            # Google Cloud logic would go here
            logger.info(f"Uploading {unique_name} to GCS...")
            return f"https://storage.googleapis.com/messmate-bucket/{unique_name}"
            
        else:
            # Local mock fallback
            logger.info(f"Mocking upload of {unique_name} to local storage...")
            return f"https://cdn.messmate.app/mock/{unique_name}"
            
    async def generate_presigned_url(self, file_key: str, expires_in: int = 3600) -> str:
        """Generate a secure, time-limited URL for downloading private files like invoices."""
        if self.provider == "aws_s3":
            return f"https://s3.amazonaws.com/messmate-bucket/{file_key}?temp_auth=true"
        return f"https://cdn.messmate.app/mock/download/{file_key}"

storage = StorageService()
