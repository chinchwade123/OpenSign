import React, { useEffect, useState } from "react";
// import Parse from "parse"; // Firebase: Parse will be phased out
import { appInfo } from "../constant/appinfo"; // May still be used for settings
import { NavLink, useNavigate } from "react-router";
import { auth } from "../firebaseConfig"; // Firebase: Import auth
import { createUserWithEmailAndPassword } from "firebase/auth"; // Firebase: Import specific auth functions
// import axios from "axios"; // Firebase: Use apiClient
import apiClient from "../api/apiClient"; // Firebase: Use our configured apiClient
import {
  getAppLogo,
  openInNewTab,
  saveLanguageInLocal,
  usertimezone
} from "../constant/Utils";
import { useDispatch } from "react-redux";
import { showTenant } from "../redux/reducers/ShowTenant";
import Loader from "../primitives/Loader";
import Title from "../components/Title";
import { useTranslation } from "react-i18next";
import { emailRegex } from "../constant/const";

const AddAdmin = () => {
  const appName =
    "OpenSign™";
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [lengthValid, setLengthValid] = useState(false);
  const [caseDigitValid, setCaseDigitValid] = useState(false);
  const [specialCharValid, setSpecialCharValid] = useState(false);
  const [isAuthorize, setIsAuthorize] = useState(false);
  const [isSubscribeNews, setIsSubscribeNews] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [state, setState] = useState({
    loading: false,
    alertType: "success",
    alertMsg: ""
  });
  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  useEffect(() => {
    checkUserExist();
    // eslint-disable-next-line
  }, []);
  const checkUserExist = async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const app = await getAppLogo();
      if (app?.error === "invalid_json") {
        setErrMsg(t("server-down", { appName: appName }));
      } else if (app?.user === "exist") {
        setErrMsg(t("admin-exists"));
      }
    } catch (err) {
      setErrMsg(t("something-went-wrong-mssg"));
      console.log("err in check user exist", err);
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  };
  const clearStorage = async () => { // Firebase: Will need to update if any Firebase specific session items are stored outside of SDK's own management
    // try {
    //   await Parse.User.logOut(); // Firebase: This will be replaced by Firebase signOut elsewhere
    // } catch (err) {
    //   console.log("Err while logging out", err);
    // }
    // For initial admin setup, clearing most things might be okay.
    // However, Firebase auth state is managed by the SDK.
    // This function's purpose might change or become less critical.
    const baseUrl = localStorage.getItem("baseUrl");
    const appid = localStorage.getItem("parseAppId");
    const applogo = localStorage.getItem("appLogo");
    const defaultmenuid = localStorage.getItem("defaultmenuid");
    const PageLanding = localStorage.getItem("PageLanding");
    const userSettings = localStorage.getItem("userSettings");

    localStorage.clear();
    saveLanguageInLocal(i18n);
    localStorage.setItem("baseUrl", baseUrl);
    localStorage.setItem("parseAppId", appid);
    localStorage.setItem("appLogo", applogo);
    localStorage.setItem("defaultmenuid", defaultmenuid);
    localStorage.setItem("PageLanding", PageLanding);
    localStorage.setItem("userSettings", userSettings);
    localStorage.setItem("baseUrl", baseUrl);
    localStorage.setItem("parseAppId", appid);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!emailRegex.test(email)) {
      alert("Please enter a valid email address."); // Consider using a more integrated notification system than alert()
      return;
    }
    if (!(lengthValid && caseDigitValid && specialCharValid)) {
      alert("Password does not meet all requirements."); // Or specific messages
      return;
    }

    // clearStorage(); // Firebase: Re-evaluate if this is needed or how it should work with Firebase auth state
    setState({ ...state, loading: true });

    const userDetailsForBackend = {
      name: name,
      email: email?.toLowerCase()?.replace(/\s/g, ""),
      phone: phone,
      company: company,
      jobTitle: jobTitle,
      role: "contracts_Admin", // Specific for this admin setup form
      timezone: usertimezone,
      // Password is not sent to our backend if client creates Firebase Auth user
    };
    localStorage.setItem("userDetails", JSON.stringify(userDetailsForBackend)); // May not be needed if app relies on auth state / Redux

    try {
      // 1. Create user in Firebase Authentication (client-side)
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      if (firebaseUser) {
        // 2. Call our backend to create associated RTDB data
        const backendPayload = {
          ...userDetailsForBackend,
          uid: firebaseUser.uid, // Send the Firebase UID
        };

        // const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api"; // Get from env
        const apiBaseUrl = appInfo.apiBaseUrl; // This line is actually not needed if using apiClient directly with relative path


        const backendResponse = await apiClient.post(`/api/signup`, backendPayload); // Use apiClient, path is relative to baseURL

        if (backendResponse.data && backendResponse.data.uid) {
          if (isSubscribeNews) {
            // TODO: Replace Parse.Cloud.run("newsletter", params) with a call to a new Firebase backend endpoint
            // For now, just log it
            console.log("Newsletter subscription requested for:", email);
            // subscribeNewsletterFirebase(name, email); // Example future function
          }

          // At this point, user is created in Firebase Auth and our backend.
          // The onAuthStateChanged listener (to be implemented in App.jsx or similar)
          // should pick up the new Firebase user and handle session setup & navigation.

          setState({
            ...state,
            loading: false,
            alertType: "success",
            alertMsg: t("registered-user-successfully")
          });
          // Navigation should ideally be handled by onAuthStateChanged,
          // but for immediate feedback, we can navigate here.
          // The target page needs to be determined based on role, similar to original handleNavigation.
          // For an admin, it might be a specific dashboard.
          // For now, navigate to a generic dashboard or home. This needs refinement.

          // Simplified navigation for now. Robust navigation should use data from onAuthStateChanged / Redux.
          // Storing some initial info for the session to be picked up by onAuthStateChanged handler
          localStorage.setItem("firebaseUid", firebaseUser.uid);
          localStorage.setItem("userEmail", firebaseUser.email);
          localStorage.setItem("username", name);
          localStorage.setItem("_user_role", "contracts_Admin"); // From this form
          localStorage.setItem("TenantId", backendResponse.data.tenantId); // Assuming signup returns tenantId

          // Example navigation - this needs to align with how app determines landing page
          const userSettings = appInfo.settings;
          const menu = userSettings.find((m) => m.role === "contracts_Admin");
          if (menu) {
            navigate(`/${menu.pageType}/${menu.pageId}`);
          } else {
            navigate("/"); // Fallback
          }

        } else {
          throw new Error(backendResponse.data?.error || "Backend signup failed to return expected data.");
        }
      } else {
        throw new Error("Firebase user creation failed on client.");
      }
    } catch (error) {
      console.error("Error during admin signup:", error);
      let errorMessage = error.message;
      if (error.code === "auth/email-already-exists") {
        errorMessage = t("already-exists-this-username");
      } else if (error.response && error.response.data && error.response.data.error) {
        errorMessage = error.response.data.error; // Error from our backend
      }
      setState({ ...state, loading: false, alertType: "danger", alertMsg: errorMessage });
      // Consider if Parse's requestPasswordReset logic for existing accounts is still relevant here.
      // For Firebase, if email exists, signup fails directly. User would use "Forgot Password" on login page.
    } finally {
      setTimeout(() => setState({ ...state, alertMsg: "" }), 3000);
    }
  };

  // Firebase: handleNavigation is largely replaced by logic within handleSubmit's success path
  // and by the upcoming onAuthStateChanged listener.
  // This function can be removed or heavily simplified if parts are still needed temporarily.
  const handleNavigation = async (/* firebaseUser, backendUserData */) => { // Parameters would change
    console.warn("handleNavigation called - its logic should be integrated into handleSubmit or onAuthStateChanged");
    // Original logic:
    // Parse.User.become(sessionToken) -> Firebase session is already active via createUserWithEmailAndPassword
    // Parse.Cloud.run("getUserDetails") -> This data should come from our backend /api/signup response or a subsequent /api/me call
    // localStorage setup -> Done in handleSubmit or by onAuthStateChanged handler
    // navigate -> Done in handleSubmit or by onAuthStateChanged handler

    // Example of what might remain if called after successful signup and backend data creation:
    // const userSettings = appInfo.settings;
    // const userRole = localStorage.getItem("_user_role"); // Assuming it's set
    // const menu = userRole && userSettings.find((menu) => menu.role === userRole);
    // if (menu) {
    //   navigate(`/${menu.pageType}/${menu.pageId}`);
    // } else {
    //   navigate("/"); // Fallback
    // }
    setState({ ...state, loading: false }); // Ensure loading is stopped
  };

  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    // Check conditions separately
    setLengthValid(newPassword.length >= 8);
    setCaseDigitValid(
      /[a-z]/.test(newPassword) &&
        /[A-Z]/.test(newPassword) &&
        /\d/.test(newPassword)
    );
    setSpecialCharValid(/[!@#$%^&*()\-_=+{};:,<.>]/.test(newPassword));
  };
  const subscribeNewsletter = async () => {
    try {
      const params = { name: name, email: email, domain: window.location.host };
      await Parse.Cloud.run("newsletter", params);
      // console.log("newsletter ", newsletter);
    } catch (err) {
      console.log("err in subscribeNewsletter", err);
    }
  };
  return (
    <div className="h-screen flex justify-center">
      <Title title="Add admin" />
      {state.loading ? (
        <div className="text-[grey] flex justify-center items-center text-lg md:text-2xl">
          <Loader />
        </div>
      ) : (
        <>
          {errMsg ? (
            <div className="text-[grey] flex justify-center items-center text-lg md:text-2xl">
              {errMsg}
            </div>
          ) : (
            <div className="w-[95%] md:w-[500px]">
              <form onSubmit={handleSubmit}>
                <div className="w-full my-4 op-card bg-base-100 shadow-md outline outline-1 outline-slate-300/50">
                  <h2 className="text-[30px] text-center mt-3 font-medium">
                    {t("opensign-setup", { appName })}
                  </h2>
                  <NavLink
                    to="https://discord.com/invite/xe9TDuyAyj"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-center text-sm mt-1 text-[blue] cursor-pointer"
                  >
                    {t("join-discord")}
                    <i
                      aria-hidden="true"
                      className="fa-brands fa-discord ml-1"
                    ></i>
                    {/* <span className="fa-sr-only">OpenSign&apos;s Discord</span> */}
                  </NavLink>
                  <div className="px-6 py-3 text-xs">
                    <label className="block ">
                      {t("name")}{" "}
                      <span className="text-[red] text-[13px]">*</span>
                    </label>
                    <input
                      type="text"
                      className="op-input op-input-bordered op-input-sm focus:outline-none hover:border-base-content w-full text-xs"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onInvalid={(e) =>
                        e.target.setCustomValidity(t("input-required"))
                      }
                      onInput={(e) => e.target.setCustomValidity("")}
                      required
                    />
                    <hr className="my-2 border-none" />
                    <label>
                      {"email"}{" "}
                      <span className="text-[red] text-[13px]">*</span>
                    </label>
                    <input
                      id="email"
                      type="email"
                      className="op-input op-input-bordered op-input-sm focus:outline-none hover:border-base-content w-full text-xs"
                      value={email}
                      onChange={(e) =>
                        setEmail(
                          e.target.value?.toLowerCase()?.replace(/\s/g, "")
                        )
                      }
                      onInvalid={(e) =>
                        e.target.setCustomValidity(t("input-required"))
                      }
                      onInput={(e) => e.target.setCustomValidity("")}
                      required
                    />
                    <hr className="my-2 border-none" />
                    <label>
                      {t("phone")}{" "}
                      <span className="text-[red] text-[13px]">*</span>
                    </label>
                    <input
                      type="tel"
                      className="op-input op-input-bordered op-input-sm focus:outline-none hover:border-base-content w-full text-xs"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onInvalid={(e) =>
                        e.target.setCustomValidity(t("input-required"))
                      }
                      onInput={(e) => e.target.setCustomValidity("")}
                      required
                    />
                    <hr className="my-2 border-none" />
                    <label>
                      {t("company")}{" "}
                      <span className="text-[red] text-[13px]">*</span>
                    </label>
                    <input
                      type="text"
                      className="op-input op-input-bordered op-input-sm focus:outline-none hover:border-base-content w-full text-xs"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      onInvalid={(e) =>
                        e.target.setCustomValidity(t("input-required"))
                      }
                      onInput={(e) => e.target.setCustomValidity("")}
                      required
                    />
                    <hr className="my-2 border-none" />
                    <label>
                      {t("job-title")}{" "}
                      <span className="text-[red] text-[13px]">*</span>
                    </label>
                    <input
                      type="text"
                      className="op-input op-input-bordered op-input-sm focus:outline-none hover:border-base-content w-full text-xs"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      onInvalid={(e) =>
                        e.target.setCustomValidity(t("input-required"))
                      }
                      onInput={(e) => e.target.setCustomValidity("")}
                      required
                    />
                    <hr className="my-2 border-none" />
                    <label>
                      {t("password")}
                      <span className="text-[red] text-[13px]">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        className="op-input op-input-bordered op-input-sm focus:outline-none hover:border-base-content w-full text-xs"
                        name="password"
                        value={password}
                        onChange={(e) => handlePasswordChange(e)}
                        onInvalid={(e) =>
                          e.target.setCustomValidity(t("input-required"))
                        }
                        onInput={(e) => e.target.setCustomValidity("")}
                        required
                      />
                      <span
                        className={`absolute top-[50%] right-[10px] -translate-y-[50%] cursor-pointer text-base-content`}
                        onClick={togglePasswordVisibility}
                      >
                        {showPassword ? (
                          <i className="fa fa-eye-slash" /> // Close eye icon
                        ) : (
                          <i className="fa fa-eye" /> // Open eye icon
                        )}
                      </span>
                    </div>
                    {password.length > 0 && (
                      <div className="mt-1 text-[11px]">
                        <p
                          className={`${
                            lengthValid ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {lengthValid ? "✓" : "✗"} {t("password-length")}
                        </p>
                        <p
                          className={`${
                            caseDigitValid ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {caseDigitValid ? "✓" : "✗"} {t("password-case")}
                        </p>
                        <p
                          className={`${
                            specialCharValid ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {specialCharValid ? "✓" : "✗"}{" "}
                          {t("password-special-char")}
                        </p>
                      </div>
                    )}
                    <div className="mt-2.5 ml-1 flex flex-row items-center">
                      <input
                        type="checkbox"
                        className="op-checkbox op-checkbox-sm"
                        id="termsandcondition"
                        checked={isAuthorize}
                        onChange={(e) => setIsAuthorize(e.target.checked)}
                        onInvalid={(e) =>
                          e.target.setCustomValidity(t("input-required"))
                        }
                        onInput={(e) => e.target.setCustomValidity("")}
                        required
                      />
                      <label
                        className="text-xs cursor-pointer ml-1 mb-0"
                        htmlFor="termsandcondition"
                      >
                        {t("agreee")}
                      </label>
                      <span
                        className="underline cursor-pointer ml-1"
                        onClick={() =>
                          openInNewTab(
                            "https://www.opensignlabs.com/terms-and-conditions"
                          )
                        }
                      >
                        {t("term")}
                      </span>
                      <span>.</span>
                    </div>
                    <div className="mt-2.5 ml-1 flex flex-row items-center">
                      <input
                        type="checkbox"
                        className="op-checkbox op-checkbox-sm"
                        id="subscribetoopensign"
                        checked={isSubscribeNews}
                        onChange={(e) => setIsSubscribeNews(e.target.checked)}
                      />
                      <label
                        className="text-xs cursor-pointer ml-1 mb-0"
                        htmlFor="subscribetoopensign"
                      >
                        {t("subscribe-to-opensign")}
                      </label>
                    </div>
                  </div>
                  <div className="mx-4 text-center text-xs font-bold mb-3">
                    <button
                      type="submit"
                      className="op-btn op-btn-primary w-full"
                      disabled={state.loading}
                    >
                      {state.loading ? t("loading") : t("next")}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AddAdmin;
