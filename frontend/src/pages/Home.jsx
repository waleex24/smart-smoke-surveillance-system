import React from "react";
import "./Home.css";
import heroImage from "../home.jpg"; // Ensure image is in /src/assets/
import { Link } from "react-router-dom";

const Home = () => {
  return (
    <div>
      {/* Hero Section */}
      <header className="hero-section">
        <div className="hero-content">
          <h1>Smart Smoke Surveillance System</h1>
          <p>Detect unauthorized smoking & vaping instantly with AI-powered alerts</p>

<div className="hero-buttons">
  <Link to="/signup">
    <button className="btn-primary">Get Started</button>
  </Link>
  <Link to="/login">
    <button className="btn-secondary">Learn More</button>
  </Link>
</div>

        </div>
        <div className="hero-image">
          <img src={heroImage} alt="Smoke Surveillance"  j/>
        </div>
      </header>

      {/* Features Section */}
      <section className="features-section">
        <h2>Why Choose Smart Smoke?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <i className="fas fa-video"></i>
            <h3>Real-Time Smoke Detection</h3>
            <p>Instant detection of unauthorized smoking and vaping in restricted areas.</p>
          </div>
          <div className="feature-card">
            <i className="fas fa-smoking-ban"></i>
            <h3>Vape Recognition</h3>
            <p>Detect subtle vaping activities using advanced AI models and sensors.</p>
          </div>
          <div className="feature-card">
            <i className="fas fa-user-check"></i>
            <h3>AI Facial Identification</h3>
            <p>Identify individuals automatically for accurate violation logging.</p>
          </div>
          <div className="feature-card">
            <i className="fas fa-bell"></i>
            <h3>Instant Alerts & Reports</h3>
            <p>Receive real-time notifications and automated reports for administrators.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
