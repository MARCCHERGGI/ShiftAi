"use client";

import React from "react";

type ButtonProps = {
  text: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  disabled?: boolean;
};

export default function Button({
  text,
  onClick,
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled = false,
}: ButtonProps) {
  const baseStyles = `flex items-center justify-center font-semibold rounded-lg transition duration-200 focus:outline-none`;
  const sizeStyles = {
    sm: "px-3 py-1 text-sm",
    md: "px-5 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };
  const variantStyles = {
    primary: "bg-primary text-white hover:bg-opacity-90",
    secondary: "bg-gray-700 text-white hover:bg-gray-600",
    outline: "border border-gray-400 text-gray-300 hover:bg-gray-700",
    danger: "bg-red-500 text-white hover:bg-red-600",
  };
  const disabledStyles = "opacity-50 cursor-not-allowed";

  return (
    <button
      onClick={onClick}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${
        fullWidth ? "w-full" : ""
      } ${disabled ? disabledStyles : ""}`}
      disabled={disabled}
    >
      {text}
    </button>
  );
}

