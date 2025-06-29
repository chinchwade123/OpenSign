import React, { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { auth } from "../firebaseConfig"; // Adjust path if necessary
import { appInfo } from "../constant/appinfo"; // For default redirect path
import Loader from "./Loader"; // Assuming a Loader component exists

const ValidateRoute = () => {
  const navigate = useNavigate();
  //isLoading helps prevent rendering Outlet before navigation decision
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Use onAuthStateChanged for a more reliable check, but auth.currentUser is quicker for initial synchronous check.
    // The main onAuthStateChanged in App.jsx will handle global state. This is a route-specific check.
    const currentUser = auth.currentUser;
    const firebaseUid = localStorage.getItem("firebaseUid"); // Check our flag from login/signup/onAuthStateChanged

    if (currentUser || firebaseUid) { // If Firebase knows the user OR our flag is set
      // User is authenticated, should not access Login, AddAdmin, etc.
      // Determine default redirect path
      const userRole = localStorage.getItem("_user_role");
      const settings = appInfo.settings;
      const menu = userRole && settings.find((m) => m.role === userRole);
      // Fallback to a generic dashboard or the first role's page if specific role not found or no menu
      const defaultRedirectPath = menu
        ? `/${menu.pageType}/${menu.pageId}`
        : (settings[0] ? `/${settings[0].pageType}/${settings[0].pageId}` : "/dashboard/35KBoSgoAK");

      console.log(`ValidateRoute: User authenticated, redirecting to ${defaultRedirectPath}`);
      navigate(defaultRedirectPath, { replace: true });
      // setIsLoading(false) will be set after navigation, or component unmounts.
      // No need to explicitly set isLoading to false if navigating away.
    } else {
      // User is not authenticated, allow access to public routes
      setIsLoading(false);
    }
    // Dependency array: navigate. If auth.currentUser changes, onAuthStateChanged in App.jsx should handle global state.
  }, [navigate]);

  if (isLoading) {
    return <Loader />; // Show loader while checking auth status
  }

  // If not authenticated (and thus not redirected), render the child routes (Login, AddAdmin, etc.)
  return <Outlet />;
};

export default ValidateRoute;
