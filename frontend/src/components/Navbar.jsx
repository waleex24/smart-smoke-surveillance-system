import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./Navbar.css";

const Navbar = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false); // 👈 for mobile toggle

  return (
    <nav className="navbar">
      {/* Logo */}
      <div className="navbar-logo">
        <Link to="/">SmartSmoke</Link>
      </div>

      {/* Hamburger Icon (only visible on mobile) */}
      <div
        className={`menu-toggle ${menuOpen ? "active" : ""}`}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <span className="bar"></span>
        <span className="bar"></span>
        <span className="bar"></span>
      </div>

      {/* Navigation Links */}
      <ul className={`navbar-links ${menuOpen ? "active" : ""}`}>
        <li><Link to="/" onClick={() => setMenuOpen(false)}>Home</Link></li>

        {/* Dropdown */}
        <li
          className="dropdown"
          onMouseEnter={() => window.innerWidth > 768 && setIsDropdownOpen(true)}
          onMouseLeave={() => window.innerWidth > 768 && setIsDropdownOpen(false)}
        >
          <span
            className="dropdown-toggle"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            Login ▾
          </span>

          <ul className={`dropdown-menu ${isDropdownOpen ? "show" : ""}`}>
            <li><Link to="/login" onClick={() => setMenuOpen(false)}>Login as Student</Link></li>
            <li><Link to="/admin-login" onClick={() => setMenuOpen(false)}>Login as Admin</Link></li>
          </ul>
        </li>

        <li><Link to="/signup" onClick={() => setMenuOpen(false)}>Signup</Link></li>
      </ul>
    </nav>
  );
};

export default Navbar;
