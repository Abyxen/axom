# Local Tool Calling Interface Reference

Axom V2 provides local tool calling capabilities implemented in `tools.py`. The model or user can invoke these tools locally without network requests.

## Registered Tools
1. **read_file(path, max_chars=8000)**
   - Safely reads local UTF-8 files with size boundary enforcement.
   - Prevents reading paths outside the allowed workspace boundaries.
2. **write_file(path, content, overwrite=False)**
   - Creates or updates files in the workspace.
   - Requires explicit overwrite parameter to avoid accidental data loss.
3. **list_directory(path='.', max_items=60)**
   - Inspects files and directories with file size and modified timestamps.
4. **calculate(expression)**
   - Evaluates pure mathematical expressions using Python's `ast` parser.
   - Supports functions: abs, round, min, max, sum, pow, math functions (sin, cos, tan, sqrt, log, log10, exp, ceil, floor, pi, e).
5. **execute_python(code, timeout=10)**
   - Runs isolated Python code blocks in a dedicated subprocess with timeout limits.
   - Captures stdout and stderr for immediate analysis.
