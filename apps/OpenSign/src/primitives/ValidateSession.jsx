import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebaseConfig"; // Adjust path if necessary
import Loader from "./Loader"; // Assuming a Loader component exists
// ModalUi and useTranslation are removed as the modal is removed for now.

const ValidateSession = ({ children }) => {
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check Firebase auth state
    // Relying on onAuthStateChanged in App.jsx to have updated localStorage if needed,
    // or auth.currentUser for a quick check.
    const currentUser = auth.currentUser;
    const firebaseUid = localStorage.getItem("firebaseUid");

    if (currentUser || firebaseUid) {
      setIsAuthorized(true);
      // console.log("ValidateSession: User is authorized.");
    } else {
      setIsAuthorized(false);
      console.log("ValidateSession: User not authenticated, redirecting to login '/'.");
      navigate("/", { replace: true }); // Redirect to login page
    }
    setIsLoading(false);
    // Dependency: navigate. Add others if relying on external state that might change.
  }, [navigate]);

  if (isLoading) {
    return <Loader />; // Show loader while checking auth
  }

  // Render children if authorized.
  // If not authorized, navigate() should have already occurred or will occur.
  // Returning null might cause a brief blank screen if navigation is slightly delayed,
  // but usually, the redirect is fast.
  return isAuthorized ? children : null;
};

export default ValidateSession;
