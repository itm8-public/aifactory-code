"""__TITLE__: an itm8 AI Factory agent."""

import asyncio
import sys

# psycopg's async driver needs the selector event loop; Windows defaults to the proactor loop.
if sys.platform == "win32":  # pragma: no cover
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
