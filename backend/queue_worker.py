import asyncio
from typing import Callable, Any, Coroutine
from logger import logger

class QueueWorker:
    """
    Mock Celery/Redis queue for MessMate.
    Currently executes tasks via asyncio.create_task in the background.
    In production, this would publish to a Redis broker.
    """
    def __init__(self):
        self.tasks_queued = 0
        
    def enqueue(self, task: Callable[..., Coroutine[Any, Any, Any]], *args, **kwargs) -> str:
        self.tasks_queued += 1
        task_id = f"task_{self.tasks_queued}"
        logger.info(f"Enqueued background task {task.__name__} (ID: {task_id})")
        
        async def wrapper():
            try:
                await task(*args, **kwargs)
                logger.info(f"Task {task_id} completed successfully")
            except Exception as e:
                logger.error(f"Task {task_id} failed: {e}", exc_info=True)
                
        asyncio.create_task(wrapper())
        return task_id
        
# Global worker instance
worker = QueueWorker()
