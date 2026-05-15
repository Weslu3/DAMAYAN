"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthLayout from "../../components/AuthLayout";
import { ApiError, signup, uploadGovernmentIdForSignup } from "../../lib/api";
import { AppRole } from "../../lib/types";

export default function DispatcherSignupPage() {
  const router = useRouter();
  const [selectedIdName, setSelectedIdName] = useState("No file selected");
  const [selectedIdFile, setSelectedIdFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const fullName = formData.get("dispatcher-name") as string;
    const email = formData.get("dispatcher-email") as string;
    const phone = formData.get("dispatcher-phone") as string;
    const password = formData.get("dispatcher-password") as string;

    // Split name into first and last (naive approach for now)
    const nameParts = fullName.trim().split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "User";

    try {
      if (!selectedIdFile) {
        throw new ApiError("Please upload a Government ID before submitting.", 400);
      }

      if (selectedIdFile.size > 5 * 1024 * 1024) {
        throw new ApiError("Government ID file must be 5MB or smaller.", 400);
      }

      const upload = await uploadGovernmentIdForSignup({
        file: selectedIdFile,
        applicantRole: AppRole.DISPATCHER,
        applicantEmail: email,
      });

      await signup({
        firstName,
        lastName,
        email,
        phone,
        password,
        role: AppRole.DISPATCHER,
        governmentIdKey: `${upload.bucket}/${upload.objectPath}`,
        governmentIdFileName: selectedIdFile.name,
      });

      router.push("/dispatcher/login?signup=success");
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout
      persona="dispatcher"
      portalName="Dispatcher Portal"
      eyebrow="Join the Command"
      headline={
        <>
          Coordinate the<br />
          <span className="auth-headline-accent">Crisis Network.</span>
        </>
      }
      subline="Register to join the regional dispatch team. Gain access to real-time incident logs, responder tracking, and resource mapping."
      badgeText="Staff Registration"
      formTitle="Dispatcher Account"
      formSub="Submit your credentials for access authorization."
      switchText="Already have an account?"
      switchLink="/dispatcher/login"
    >
      <form className="auth-form" onSubmit={handleRegister}>
        {error && (
          <div style={{ color: "#d32f2f", backgroundColor: "#ffebee", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.875rem", border: "1px solid #ffcdd2" }}>
            {error}
          </div>
        )}
        <div className="auth-field">
          <label htmlFor="dispatcher-name">Full Name</label>
          <input id="dispatcher-name" name="dispatcher-name" type="text" placeholder="Dispatcher Full Name" required />
        </div>

        <div className="auth-field">
          <label htmlFor="dispatcher-email">Email Address</label>
          <input id="dispatcher-email" name="dispatcher-email" type="email" placeholder="dispatcher@damayan.ph" required />
        </div>

        <div className="auth-field">
          <label htmlFor="dispatcher-phone">Phone Number</label>
          <input id="dispatcher-phone" name="dispatcher-phone" type="tel" placeholder="09123456789" required />
        </div>

        <div className="auth-field">
          <label htmlFor="dispatcher-password">Password</label>
          <input id="dispatcher-password" name="dispatcher-password" type="password" placeholder="Create a secure password" required />
        </div>

        <div className="auth-field">
          <label>Civil Defense / LGU Credential (ID Photo)</label>
          <div className="auth-input-wrap" style={{ cursor: "pointer" }}>
            <input
              id="dispatcher-id"
              name="dispatcher-id"
              type="file"
              accept=".jpg,.jpeg,.png"
              required
              style={{ 
                position: "absolute",
                inset: 0,
                opacity: 0,
                cursor: "pointer",
                zIndex: 2
              }}
              onChange={(e) => {
                const nextFile = e.target.files?.[0] ?? null;
                setSelectedIdFile(nextFile);
                setSelectedIdName(nextFile?.name ?? "No file selected");
              }}
            />
            <div 
              className="auth-upload-backdrop" 
              style={{ 
                width: "100%",
                padding: "24px",
                borderRadius: "16px",
                border: "2px dashed var(--auth-line)",
                textAlign: "center",
                backgroundColor: "rgba(0,0,0,0.01)",
                transition: "all 0.2s ease"
              }}
            >
              <span style={{ fontSize: "2rem", display: "block", marginBottom: "8px" }}>📄</span>
              <strong style={{ display: "block", fontSize: "0.95rem", color: "var(--auth-accent)" }}>
                {selectedIdName === "No file selected" ? "Upload Official ID" : "ID Uploaded"}
              </strong>
              <span style={{ fontSize: "0.8rem", color: "var(--auth-muted)" }}>
                {selectedIdName === "No file selected" ? "JPG or PNG • Max 5MB" : selectedIdName}
              </span>
            </div>
          </div>
        </div>

        <button 
          className="auth-submit" 
          type="submit"
          disabled={isLoading}
          style={{ opacity: isLoading ? 0.7 : 1, cursor: isLoading ? "not-allowed" : "pointer" }}
        >
          {isLoading ? "Processing..." : "Apply for Dispatcher Access"}
        </button>
      </form>
    </AuthLayout>
  );
}
