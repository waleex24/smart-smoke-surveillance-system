from inference_sdk import InferenceHTTPClient
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

client = InferenceHTTPClient(
    api_url="https://serverless.roboflow.com",
    api_key="xRYoVoRSnx6MzxyOmkC5"   # ✅ tumhari new API key
)

def infer(frame):
    return client.infer(frame, model_id="vape-detector/2")  # ✅ tumhara tested model