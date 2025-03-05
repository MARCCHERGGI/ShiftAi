"use client";

import { FaTwitter, FaLinkedin, FaInstagram, FaGithub } from "react-icons/fa";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 dark:bg-white dark:text-gray-700 text-center py-6 mt-12 border-t border-gray-800 dark:border-gray-300">
      
      {/* 🔹 Copyright */}
      <p className="text-sm">
        © {new Date().getFullYear()} <span className="font-semibold">ShiftAI</span>. All rights reserved.
      </p>

      {/* 🔹 Social Media Icons */}
      <div className="flex justify-center mt-4 space-x-10">
        <a
          href="https://twitter.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Twitter"
          className="hover:text-blue-400 transition"
        >
          <FaTwitter size={28} />
        </a>
        <a
          href="https://linkedin.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="LinkedIn"
          className="hover:text-blue-400 transition"
        >
          <FaLinkedin size={28} />
        </a>
        <a
          href="https://instagram.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram"
          className="hover:text-blue-400 transition"
        >
          <FaInstagram size={28} />
        </a>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          className="hover:text-blue-400 transition"
        >
          <FaGithub size={28} />
        </a>
      </div>
    </footer>
  );
}
