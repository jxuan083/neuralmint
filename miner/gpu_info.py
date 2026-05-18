"""Detect GPU information via nvidia-smi."""

import subprocess
import json


def get_gpu_info() -> dict:
    """Detect GPU name and memory. Returns empty dict if no GPU found."""
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode != 0:
            return {}

        line = result.stdout.strip().split("\n")[0]
        parts = [p.strip() for p in line.split(",")]
        return {
            "gpu_name": parts[0],
            "gpu_memory_mb": int(parts[1]),
        }
    except (FileNotFoundError, subprocess.TimeoutExpired, (IndexError, ValueError)):
        return {}
