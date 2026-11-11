import math
import subprocess
import sys
from pathlib import Path
from typing import Dict, Any

import config

WORKSPACE_ROOT = config.BASE_DIR.parent.resolve()

def tool_read_file(filepath: str) -> str:
    """Read contents of a file within the workspace or docs."""
    target = (WORKSPACE_ROOT / filepath).resolve()
    if not str(target).startswith(str(WORKSPACE_ROOT)):
        return "Error: Path access denied outside workspace."
    if not target.exists():
        return f"Error: File '{filepath}' does not exist."
    if not target.is_file():
        return f"Error: '{filepath}' is a directory."

    try:
        with open(target, "r", encoding="utf-8", errors="replace") as f:
            content = f.read(50000) # Read up to 50KB
        return content
    except Exception as e:
        return f"Error reading file: {e}"

def tool_write_file(filepath: str, content: str) -> str:
    """Create or overwrite a file within the workspace or docs."""
    target = (WORKSPACE_ROOT / filepath).resolve()
    if not str(target).startswith(str(WORKSPACE_ROOT)):
        return "Error: Path access denied outside workspace."

    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        with open(target, "w", encoding="utf-8") as f:
            f.write(content)
        return f"Successfully wrote {len(content)} characters to '{filepath}'."
    except Exception as e:
        return f"Error writing file: {e}"

def tool_list_directory(dirpath: str = ".") -> str:
    """List contents of a directory in the workspace."""
    target = (WORKSPACE_ROOT / dirpath).resolve()
    if not str(target).startswith(str(WORKSPACE_ROOT)):
        return "Error: Path access denied outside workspace."
    if not target.exists() or not target.is_dir():
        return f"Error: Directory '{dirpath}' does not exist."

    try:
        entries = []
        for item in sorted(target.iterdir()):
            kind = "[DIR]" if item.is_dir() else "[FILE]"
            size = f"({item.stat().st_size} bytes)" if item.is_file() else ""
            entries.append(f"{kind} {item.name} {size}")
        return "\n".join(entries) if entries else "Directory is empty."
    except Exception as e:
        return f"Error listing directory: {e}"

def tool_calculate(expression: str) -> str:
    """Safely calculate a deterministic mathematical expression."""
    safe_dict = {
        "abs": abs, "round": round, "min": min, "max": max, "sum": sum,
        "pow": pow, "math": math, "sqrt": math.sqrt, "sin": math.sin,
        "cos": math.cos, "tan": math.tan, "log": math.log, "log10": math.log10,
        "pi": math.pi, "e": math.e
    }
    try:
        # Evaluate in restricted namespace
        result = eval(expression, {"__builtins__": {}}, safe_dict)
        return f"{result}"
    except Exception as e:
        return f"Calculation error: {e}"

def tool_execute_python(code: str) -> str:
    """Execute a Python snippet in an isolated subprocess with timeout."""
    try:
        proc = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            timeout=8,
            cwd=str(config.BASE_DIR)
        )
        stdout = proc.stdout.strip()
        stderr = proc.stderr.strip()
        if proc.returncode != 0:
            return f"Execution Error (code {proc.returncode}):\n{stderr or stdout}"
        return stdout if stdout else "(Execution completed with no stdout output)"
    except subprocess.TimeoutExpired:
        return "Error: Python execution timed out after 8 seconds."
    except Exception as e:
        return f"Execution failed: {e}"

# Tool registry
TOOLS = {
    "read_file": tool_read_file,
    "write_file": tool_write_file,
    "list_directory": tool_list_directory,
    "calculate": tool_calculate,
    "execute_python": tool_execute_python,
}

TOOL_DEFINITIONS = [
    {
        "name": "read_file",
        "description": "Read contents of a file within the workspace or docs.",
        "parameters": {"filepath": "relative path to the file"}
    },
    {
        "name": "write_file",
        "description": "Create or overwrite a file in the workspace or docs.",
        "parameters": {"filepath": "relative path to the file", "content": "text content"}
    },
    {
        "name": "list_directory",
        "description": "List files and subdirectories in a workspace directory.",
        "parameters": {"dirpath": "relative directory path, default '.'"}
    },
    {
        "name": "calculate",
        "description": "Perform deterministic math calculation using standard math functions.",
        "parameters": {"expression": "mathematical expression e.g. 'sqrt(144) + 12'"}
    },
    {
        "name": "execute_python",
        "description": "Execute a Python script snippet locally and capture output.",
        "parameters": {"code": "Python code string"}
    }
]

def dispatch_tool(tool_name: str, **kwargs) -> str:
    """Execute tool by name and return string result."""
    func = TOOLS.get(tool_name)
    if not func:
        return f"Unknown tool: '{tool_name}'."
    try:
        return func(**kwargs)
    except Exception as e:
        return f"Tool '{tool_name}' error: {e}"
