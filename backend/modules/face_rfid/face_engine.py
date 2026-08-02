import os
import cv2
import face_recognition
import pickle
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENCODING_FILE = os.path.join(BASE_DIR, "encodings.pickle")

TOLERANCE = 0.5
FRAME_RESIZE = 0.5
MODEL = "hog"
MAX_FRAMES = 5

if not os.path.exists(ENCODING_FILE):
    raise FileNotFoundError("encodings.pickle not found")

with open(ENCODING_FILE, "rb") as f:
    data = pickle.load(f)

# ----------------- SINGLE FACE ATTENDANCE -----------------
def recognize_face_once():
    """
    Original function for attendance module.
    Detects & recognizes one person only.
    """
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[FACE ERROR] Camera not accessible")
        return None, None

    attempts = 0
    name, reg_no = None, None

    while attempts < MAX_FRAMES and reg_no is None:
        ret, frame = cap.read()
        if not ret:
            attempts += 1
            continue

        small = cv2.resize(frame, (0, 0), fx=FRAME_RESIZE, fy=FRAME_RESIZE)
        rgb = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)

        boxes = face_recognition.face_locations(rgb, model=MODEL)
        encodings = face_recognition.face_encodings(rgb, boxes)

        for encoding in encodings:
            distances = face_recognition.face_distance(data["encodings"], encoding)
            best = np.argmin(distances)

            if distances[best] < TOLERANCE:
                label = data["names"][best]
                if "@" in label:
                    name, reg_no = label.split("@")
                else:
                    name = label
                break

        attempts += 1

    cap.release()
    return name, reg_no


# ----------------- MULTI-FACE DETECTION & RECOGNITION -----------------
# -------- MULTI FACE (FAST + SAFE) --------
def recognize_faces_multi(frame, frame_skip=6):
    """
    Fast multi-face detection + recognition
    Does NOT affect attendance logic
    """

    if not hasattr(recognize_faces_multi, "counter"):
        recognize_faces_multi.counter = 0

    recognize_faces_multi.counter += 1

    # ⛔ Skip heavy work
    if recognize_faces_multi.counter % frame_skip != 0:
        return []

    small = cv2.resize(frame, (0, 0), fx=FRAME_RESIZE, fy=FRAME_RESIZE)
    rgb = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)

    boxes = face_recognition.face_locations(rgb, model=MODEL)
    encodings = face_recognition.face_encodings(rgb, boxes)

    results = []

    for box, encoding in zip(boxes, encodings):
        distances = face_recognition.face_distance(data["encodings"], encoding)
        best = np.argmin(distances)

        name, reg_no = "Unknown", None

        if distances[best] < TOLERANCE:
            label = data["names"][best]
            if "@" in label:
                name, reg_no = label.split("@")
            else:
                name = label

        top, right, bottom, left = box
        top = int(top / FRAME_RESIZE)
        right = int(right / FRAME_RESIZE)
        bottom = int(bottom / FRAME_RESIZE)
        left = int(left / FRAME_RESIZE)

        results.append({
            "name": name,
            "reg_no": reg_no,
            "box": (left, top, right, bottom)
        })

    return results
