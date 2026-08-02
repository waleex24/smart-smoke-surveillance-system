import React from "react";
import "./Features.css";

const Features = () => {
  return (
    <section className="features">
      <h2>Key Features</h2>
      <div className="features-grid">
        <div className="feature-card">
          <h3>Real-Time Alerts</h3>
          <p>Get instant notifications when smoke is detected.</p>
        </div>
        <div className="feature-card">
          <h3>AI Detection</h3>
          <p>Advanced AI algorithms to reduce false alarms.</p>
        </div>
        <div className="feature-card">
          <h3>Mobile Access</h3>
          <p>Monitor your system from anywhere using your phone.</p>
        </div>
        <div className="feature-card">
          <h3>Secure & Reliable</h3>
          <p>Encrypted data and 24/7 uptime for safety assurance.</p>
        </div>
      </div>
    </section>
  );
};

export default Features;
