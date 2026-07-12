import logging
import json
import os
from datetime import datetime
from typing import Any, Dict

class JSONFormatter(logging.Formatter):
    """Structured JSON formatter for centralized logging (ELK, Datadog ready)."""
    def format(self, record: logging.LogRecord) -> str:
        log_record: Dict[str, Any] = {
            "timestamp": datetime.utcfromtimestamp(record.created).isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        
        if record.exc_info:
            log_record["exception"] = self.formatException(record.exc_info)
            
        if hasattr(record, "request_id"):
            log_record["request_id"] = record.request_id

        # Attach any extra kwargs passed to the logger
        for key, value in record.__dict__.items():
            if key not in ["args", "asctime", "created", "exc_info", "exc_text", "filename",
                           "funcName", "levelname", "levelno", "lineno", "module",
                           "msecs", "message", "msg", "name", "pathname", "process",
                           "processName", "relativeCreated", "stack_info", "thread", "threadName"]:
                log_record[key] = value

        return json.dumps(log_record)

def setup_logger(name: str = "messmate") -> logging.Logger:
    logger = logging.getLogger(name)
    
    # Avoid attaching multiple handlers if already set up
    if not logger.handlers:
        logger.setLevel(logging.INFO if os.getenv("ENVIRONMENT") != "development" else logging.DEBUG)
        
        handler = logging.StreamHandler()
        # In production, use JSON. In dev, use standard text.
        if os.getenv("ENVIRONMENT") == "production":
            handler.setFormatter(JSONFormatter())
        else:
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            
        logger.addHandler(handler)
        
    return logger

logger = setup_logger()
