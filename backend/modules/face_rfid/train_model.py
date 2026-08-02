import os
import cv2
import face_recognition
import pickle

dataset_path = "dataset"
encoding_file = "encodings.pickle"

known_encodings = []
known_names = []

print("[INFO] Processing faces...")

for person_folder in os.listdir(dataset_path):
    person_path = os.path.join(dataset_path, person_folder)

    if not os.path.isdir(person_path):
        continue

    # Folder name format: Name@RegNo
    if "@" in person_folder:
        name, reg_no = person_folder.split("@", 1)
        full_label = f"{name.strip()}@{reg_no.strip()}"
    else:
        full_label = person_folder.strip()

    for image_name in os.listdir(person_path):
        image_path = os.path.join(person_path, image_name)
        image = cv2.imread(image_path)
        if image is None:
            continue

        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        boxes = face_recognition.face_locations(rgb, model="hog")
        encodings = face_recognition.face_encodings(rgb, boxes)

        for encoding in encodings:
            known_encodings.append(encoding)
            known_names.append(full_label)

print("[INFO] Saving encodings...")
data = {"encodings": known_encodings, "names": known_names}

with open(encoding_file, "wb") as f:
    pickle.dump(data, f)

print(f"[INFO] Done. Encodings saved to {encoding_file}")
