# modules/vape/detection.py

import cv2
from inference import infer
from .config import CONF_THRESHOLD, API_FRAME_SKIP

# ---------------- CONFIG ----------------
API_COUNTER = 0

# Last known API results (to avoid flicker)
LAST_API = {
    "smoke": False,
    "vape": False,
    "cigarette": False
}

# Resize for faster API inference
API_FRAME_SIZE = (416, 416)

# ---------------- MAIN FUNCTION ----------------
def detect_vape_smoke(frame, use_api=True):
    """
    Detects vape, cigarette and smoke using Roboflow API.

    Returns:
        dict {
            "smoke": bool,
            "vape": bool,
            "cigarette": bool
        }
    """

    global API_COUNTER, LAST_API

    API_COUNTER += 1

    if use_api and API_COUNTER % API_FRAME_SKIP == 0:
        try:
            resized = cv2.resize(frame, API_FRAME_SIZE)

            response = infer(resized)

            # reset
            LAST_API = {
                "smoke": False,
                "vape": False,
                "cigarette": False
            }

            for pred in response.get("predictions", []):
                if pred.get("confidence", 0) >= CONF_THRESHOLD:
                    cls = pred.get("class", "").lower()
                    if cls in LAST_API:
                        LAST_API[cls] = True

        except Exception as e:
            print("[VAPE API ERROR]", e)

    return LAST_API.copy()
