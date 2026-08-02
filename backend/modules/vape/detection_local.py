from ultralytics import YOLO
import cv2

model = YOLO("models/yolov8m.pt")

TARGET = ["cigarette", "smoke", "vape", "e-cigarette"]

def detect_objects(frame):

    result = {
        "vape": False,
        "cigarette": False,
        "smoke": False
    }

    results = model(frame, conf=0.35, imgsz=640, verbose=False)

    for r in results:
        for box in r.boxes:
            cls = model.names[int(box.cls[0])].lower()

            if "smoke" in cls:
                result["smoke"] = True
            if "cigarette" in cls:
                result["cigarette"] = True
            if "vape" in cls or "e-cigarette" in cls:
                result["vape"] = True

    return result
