import React, { useState } from "react";
// import Parse from "parse"; // Firebase: Remove Parse
import { Navigate } from "react-router-dom"; // Use react-router-dom consistently
import Title from "../components/Title";
import { useTranslation } from "react-i18next";
import { auth } from "../firebaseConfig"; // Firebase: Import auth
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth"; // Firebase: Import functions
import Alert from "../primitives/Alert"; // For better user feedback than alert()

function ChangePassword() {
  const { t } = useTranslation();
  const [currentpassword, setCurrentPassword] = useState("");
  const [newpassword, setnewpassword] = useState("");
  const [confirmpassword, setconfirmpassword] = useState("");
  const [toast, setToast] = useState({ type: "", message: "" });
  const [isLoading, setIsLoading] = useState(false);

  const showAppToast = (type, message) => {
    setToast({ type, message });
    setIsLoading(false);
    setTimeout(() => setToast({ type: "", message: "" }), 3000);
  };

  const handleSubmit = async (evt) => {
    evt.preventDefault();
    setIsLoading(true);

    if (newpassword !== confirmpassword) {
      showAppToast("danger", t("password-update-alert-4")); // "New passwords do not match."
      return;
    }

    if (newpassword.length < 6) { // Basic Firebase password length check
        showAppToast("danger", t("auth-weak-password")); // "Password should be at least 6 characters."
        return;
    }

    const user = auth.currentUser;
    if (!user) {
      showAppToast("danger", t("auth-user-not-found")); // "User not authenticated."
      // Optionally navigate to login
      return;
    }

    try {
      // 1. Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, currentpassword);
      await reauthenticateWithCredential(user, credential);

      // 2. Update password
      await updatePassword(user, newpassword);
      showAppToast("success", t("password-update-alert-1")); // "Password updated successfully!"
      // Clear fields after success
      setCurrentPassword("");
      setnewpassword("");
      setconfirmpassword("");

    } catch (error) {
      console.error("Error changing password:", error);
      let errorMessage = t("something-went-wrong-mssg");
      if (error.code === "auth/wrong-password") {
        errorMessage = t("password-update-alert-3"); // "Incorrect current password."
      } else if (error.code === "auth/weak-password") {
        errorMessage = t("auth-weak-password"); // "Password should be at least 6 characters."
      } else if (error.code === "auth/requires-recent-login") {
        errorMessage = t("auth-requires-recent-login"); // "This operation is sensitive and requires recent authentication. Log in again before retrying this request."
        // Consider navigating to login page or prompting re-login more explicitly
      }
      showAppToast("danger", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Check Firebase auth state instead of Parse token
  const currentUser = auth.currentUser;
  const firebaseUid = localStorage.getItem("firebaseUid"); // Get our flag

  if (!currentUser && !firebaseUid) { // If Firebase doesn't know user AND our flag isn't set
     // This check might be too simplistic if onAuthStateChanged hasn't run yet.
     // A loading state driven by onAuthStateChanged in App.jsx is more robust.
     // For now, this provides a basic guard.
    console.log("ChangePassword: No authenticated user found, redirecting to login.");
    return <Navigate to="/" replace />;
  }

  return (
    <div className="w-full bg-base-100 text-base-content shadow rounded-box p-2">
      <Title title="Change Password" />
      <div className="text-xl font-bold border-b-[1px] border-gray-300">
        {t("change-password")}
      </div>
      <div className="m-2">
        <form onSubmit={handleSubmit} className=" flex flex-col gap-y-2">
          <div>
            <label htmlFor="currentpassword" className="block text-xs ml-1">
              {t("current-password")}
            </label>
            <input
              type="password"
              name="currentpassword"
              value={currentpassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="op-input op-input-bordered op-input-sm text-xs w-full"
              placeholder={t("current-password")}
              onInvalid={(e) => e.target.setCustomValidity(t("input-required"))}
              onInput={(e) => e.target.setCustomValidity("")}
              required
            />
          </div>
          <div>
            <label htmlFor="newpassword" className="text-xs block ml-1">
              {t("new-password")}
            </label>
            <input
              type="password"
              name="newpassword"
              value={newpassword}
              onChange={(e) => setnewpassword(e.target.value)}
              className="op-input op-input-bordered op-input-sm text-xs w-full"
              placeholder={t("new-password")}
              onInvalid={(e) => e.target.setCustomValidity(t("input-required"))}
              onInput={(e) => e.target.setCustomValidity("")}
              required
            />
          </div>
          <div>
            <label htmlFor="newpassword" className="text-xs block ml-1">
              {t("confirm-password")}
            </label>
            <input
              type="password"
              name="confirmpassword"
              className="op-input op-input-bordered op-input-sm text-xs w-full"
              value={confirmpassword}
              onChange={(e) => setconfirmpassword(e.target.value)}
              placeholder={t("confirm-password")}
              onInvalid={(e) => e.target.setCustomValidity(t("input-required"))}
              onInput={(e) => e.target.setCustomValidity("")}
              required
            />
          </div>
          <button
            type="submit"
            className="op-btn op-btn-primary shadow-md mt-2"
          >
            {t("change-password")}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChangePassword;
