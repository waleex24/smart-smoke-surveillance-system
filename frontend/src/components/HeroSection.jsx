import React from "react";
import "./HeroSection.css";
import homeImage from "../home.jpg";

const HeroSection = () => {
  return (
    <section className="hero">
      <div className="hero-content">
        <h1>Smart Smoke Surveillance System</h1>
        <p>Secure your environment, track smoke, and prevent hazards with real-time alerts.</p>
        <div className="hero-buttons">
          <a href="/signup" className="btn btn-primary">Get Started</a>
          <a href="/login" className="btn btn-secondary">Login</a>
        </div>
      </div>
      <div className="hero-image">
        <img src={homeImage} alt="Smoke Detection" />
      </div>
    </section>
  );
};

export default HeroSection;
