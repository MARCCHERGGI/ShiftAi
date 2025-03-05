"use client";
import { useState } from "react";
import ResumeOutput from "./ResumeOutput";

export default function ResumeForm() {
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    email: "",
    address: "",
    summary: "",
    position: "",
    skills: "",
    jobTitle: "",
    company: "",
    location: "",
    startDate: "",
    endDate: "",
    responsibilities: "",
    achievements: "",
    jobListing: "",
  });

  const [resume, setResume] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Handles input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResume(null);

    try {
      const response = await fetch("/api/generate-resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.resume) {
        setResume(data.resume);
      } else {
        throw new Error("Failed to generate resume.");
      }
    } catch (error) {
      console.error(error);
      setResume("Error generating resume. Please try again.");
    }

    setLoading(false);
  };

  return (
    <div className="resume-form-container">
      <h2>Build Your AI-Powered Resume</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Full Name:</label>
          <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} required />
        </div>

        <div className="form-group">
          <label>Phone Number:</label>
          <input type="text" name="phone" value={formData.phone} onChange={handleChange} required />
        </div>

        <div className="form-group">
          <label>Email:</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} required />
        </div>

        <div className="form-group">
          <label>Address (Optional):</label>
          <input type="text" name="address" value={formData.address} onChange={handleChange} />
        </div>

        <div className="form-group">
          <label>Professional Summary:</label>
          <textarea name="summary" value={formData.summary} onChange={handleChange} required />
        </div>

        <div className="form-group">
          <label>Desired Position:</label>
          <input type="text" name="position" value={formData.position} onChange={handleChange} required />
        </div>

        <div className="form-group">
          <label>Skills (Comma separated):</label>
          <input type="text" name="skills" value={formData.skills} onChange={handleChange} required />
        </div>

        <h3>Work Experience</h3>

        <div className="form-group">
          <label>Job Title:</label>
          <input type="text" name="jobTitle" value={formData.jobTitle} onChange={handleChange} required />
        </div>

        <div className="form-group">
          <label>Company:</label>
          <input type="text" name="company" value={formData.company} onChange={handleChange} required />
        </div>

        <div className="form-group">
          <label>Location:</label>
          <input type="text" name="location" value={formData.location} onChange={handleChange} required />
        </div>

        <div className="form-group">
          <label>Start Date:</label>
          <input type="text" name="startDate" value={formData.startDate} onChange={handleChange} required />
        </div>

        <div className="form-group">
          <label>End Date (or "Present"):</label>
          <input type="text" name="endDate" value={formData.endDate} onChange={handleChange} required />
        </div>

        <div className="form-group">
          <label>Key Responsibilities:</label>
          <textarea name="responsibilities" value={formData.responsibilities} onChange={handleChange} required />
        </div>

        <div className="form-group">
          <label>Notable Achievements:</label>
          <textarea name="achievements" value={formData.achievements} onChange={handleChange} />
        </div>

        <div className="form-group">
          <label>Paste Job Listing:</label>
          <textarea name="jobListing" value={formData.jobListing} onChange={handleChange} required />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Generating Resume..." : "Generate Resume"}
        </button>
      </form>

      {resume && <ResumeOutput resume={resume} />}
    </div>
  );
}
