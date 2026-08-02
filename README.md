# Smart Smoke Surveillance System 🚨💨

An AI-powered automated surveillance and access control system designed to detect smoke and vape activity in real-time using computer vision and environmental gas sensor analytics.

---

## 🛠️ Tech Stack

- **Backend:** Python, OpenCV, Flask / FastAPI, C/Linux integration
- **Frontend:** React, Next.js, Tailwind CSS
- **AI/ML:** Real-time object detection & sensor telemetry analysis

---

## 🚀 Key Features

* **Real-time Video Analytics:** Automated smoke and vaping behavior detection via CCTV streams.
* **Multi-Sensor Data Fusion:** Combines vision models with physical gas sensor inputs to minimize false positives.
* **Access Control Integration:** Automated alert triggering and access management on event flags.
* **Interactive Dashboard:** Modern web frontend for live monitoring, alerts, and system logs.

---

## ⚙️ Local Setup Instructions

### 1. Repository Setup
```bash
git clone [https://github.com/waleex24/smart-smoke-surveillance-system.git](https://github.com/waleex24/smart-smoke-surveillance-system.git)
cd smart-smoke-surveillance-system

```

### 2. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py

```

### 3. Frontend Setup

```bash
cd ../frontend
npm install
npm run dev

```

---

## 🛡️ Environment Variables

Create a `.env` file inside the `/backend` directory:

```env
DATABASE_URL=your_database_url
API_KEY=your_api_key

```
