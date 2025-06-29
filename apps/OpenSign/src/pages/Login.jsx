import React, { useEffect, useState } from "react";
// import Parse from "parse"; // Firebase: Parse will be phased out
import { useDispatch } from "react-redux";
// import axios from "axios"; // Firebase: Use apiClient
import apiClient from "../api/apiClient"; // Firebase: Use our configured apiClient
import { auth } from "../firebaseConfig"; // Firebase: Import auth
import { signInWithCustomToken, signOut } from "firebase/auth"; // Firebase: Import specific auth functions
import Title from "../components/Title";
import { NavLink, useNavigate, useLocation } from "react-router";
import login_img from "../assets/images/login_img.svg";
import { useWindowSize } from "../hook/useWindowSize";
import ModalUi from "../primitives/ModalUi";
import {
  emailRegex,
} from "../constant/const";
import Alert from "../primitives/Alert";
import { appInfo } from "../constant/appinfo";
import { fetchAppInfo } from "../redux/reducers/infoReducer";
import { showTenant } from "../redux/reducers/ShowTenant";
import {
  getAppLogo,
  saveLanguageInLocal,
  usertimezone
} from "../constant/Utils";
import Loader from "../primitives/Loader";
import { useTranslation } from "react-i18next";
import SelectLanguage from "../components/pdf/SelectLanguage";

function Login() {
  const appName =
    "OpenSign™";
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { width } = useWindowSize();
  const [state, setState] = useState({
    email: "",
    password: "",
    alertType: "success",
    alertMsg: "",
    passwordVisible: false,
    loading: false,
    thirdpartyLoader: false,
  });
  const [userDetails, setUserDetails] = useState({
    Company: "",
    Destination: ""
  });
  const [isModal, setIsModal] = useState(false);
  const [image, setImage] = useState();
  const [errMsg, setErrMsg] = useState();
  useEffect(() => {
    checkUserExt();
    // eslint-disable-next-line
  }, []);


  const setLocalVar = (user) => {
    localStorage.setItem("accesstoken", user.sessionToken);
    localStorage.setItem("UserInformation", JSON.stringify(user));
    localStorage.setItem("userEmail", user.email);
    if (user.ProfilePic) {
      localStorage.setItem("profileImg", user.ProfilePic);
    } else {
      localStorage.setItem("profileImg", "");
    }
  };

  const showToast = (type, msg) => {
    setState({ ...state, loading: false, alertType: type, alertMsg: msg });
    setTimeout(() => setState({ ...state, alertMsg: "" }), 2000);
  };

  const checkUserExt = async () => {
    const app = await getAppLogo();
    if (app?.error === "invalid_json") {
      setErrMsg(t("server-down", { appName: appName }));
    } else if (
      app?.user === "not_exist"
    ) {
      navigate("/addadmin");
    }
    if (app?.logo) {
      setImage(app?.logo);
    } else {
      setImage(appInfo?.applogo || undefined);
    }
    dispatch(fetchAppInfo());
    if (localStorage.getItem("accesstoken")) {
      setState({ ...state, loading: true });
      GetLoginData();
    }
  };
  const handleChange = (event) => {
    let { name, value } = event.target;
    if (name === "email") {
      value = value?.toLowerCase()?.replace(/\s/g, "");
    }
    setState({ ...state, [name]: value });
  };

  const handleLogin = async (
  ) => {
    const email = state?.email
    const password = state?.password

    if (!email || !password) {
      return;
    }
    localStorage.removeItem("accesstoken");
    try {
      setState({ ...state, loading: true });
      localStorage.setItem("appLogo", appInfo.applogo);
      const _user = await Parse.Cloud.run("loginuser", { email, password });
      if (!_user) {
        setState({ ...state, loading: false });
        return;
      }
      // Get extended user data (including 2FA status) using cloud function
      try {
        await Parse.User.become(_user.sessionToken);
        setLocalVar(_user);
        await continueLoginFlow();
      } catch (error) {
        console.error("Error checking 2FA status:", error);
        showToast("danger", t("something-went-wrong-mssg"));
      }
    } catch (error) {
      console.error("Error while logging in user", error);
      showToast("danger", "Invalid username/password or region");
    }
  };
  const handleLoginBtn = async (event) => {
    event.preventDefault();
    if (!emailRegex.test(state.email)) {
      alert("Please enter a valid email address.");
      return;
    }
    await handleLogin();
  };

  // Firebase: Updated setLocalVar for Firebase user data
  const setFirebaseLocalVar = (firebaseUser, backendUserData) => {
    // firebaseUser is from signInWithCustomToken().user or auth.currentUser
    // backendUserData is from our /api/login or /api/me endpoint
    if (!firebaseUser || !backendUserData) {
      console.error("setFirebaseLocalVar: Missing user data");
      return;
    }
    localStorage.setItem("firebaseUid", firebaseUser.uid);
    localStorage.setItem("UserInformation", JSON.stringify(backendUserData)); // Store data from our backend
    localStorage.setItem("userEmail", backendUserData.email || firebaseUser.email); // Prefer backend email

    if (backendUserData.profile?.ProfilePic) { // Assuming ProfilePic might be in profile
      localStorage.setItem("profileImg", backendUserData.profile.ProfilePic);
    } else {
      localStorage.setItem("profileImg", "");
    }
    // Store other necessary info from backendUserData (role, tenant, etc.)
    if (backendUserData.roleInfo) {
      localStorage.setItem("_user_role", backendUserData.roleInfo.role); // e.g. contracts_User
    }
    if (backendUserData.roleInfo?.tenantId) { // Assuming tenantId is part of roleInfo or user profile
      localStorage.setItem("TenantId", backendUserData.roleInfo.tenantId);
      // Potentially dispatch to show tenant name if available directly in backendUserData.user.tenantName
      // dispatch(showTenant(backendUserData.user.tenantName));
      // localStorage.setItem("TenantName", backendUserData.user.tenantName);
    }
     // Remove Parse specific token
    localStorage.removeItem("accesstoken");
  };


  // Firebase: Updated handleLogin function
  const handleLogin = async () => {
    const email = state?.email;
    const password = state?.password;

    if (!email || !password) {
      showToast("warning", "Email and password are required.");
      return;
    }

    localStorage.removeItem("accesstoken"); // Clear old Parse token
    localStorage.removeItem("firebaseUid"); // Clear any old Firebase UID

    setState({ ...state, loading: true });
    try {
      // localStorage.setItem("appLogo", appInfo.applogo); // This can remain if appInfo is still used

      // 1. Call backend /api/login
      const apiBaseUrl = appInfo.apiBaseUrl; // Use the new centralized config

      const response = await apiClient.post(`/api/login`, { email, password }); // Use apiClient, ensure /api prefix

      const { customToken, user: backendUserData } = response.data;

      if (!customToken || !backendUserData) {
        throw new Error("Login response missing token or user data.");
      }

      // 2. Sign in with custom token on Firebase client
      const userCredential = await signInWithCustomToken(auth, customToken);
      const firebaseUser = userCredential.user;

      if (firebaseUser) {
        setFirebaseLocalVar(firebaseUser, backendUserData); // Store combined user info

        // 3. Proceed with application logic (similar to continueLoginFlow but using backendUserData)
        const userSettings = appInfo.settings; // This might need to be revisited if settings depend on Parse
        const userRole = backendUserData.roleInfo?.role; // e.g. "contracts_User"

        if (!userRole) {
          // This case means user is authenticated with Firebase, but doesn't have a role in our system.
          // This could be where the modal for additional info (Company, JobTitle) comes in,
          // but it would then call a different backend endpoint to update the user's profile/role in RTDB,
          // not the full Parse "usersignup".
          setState({ ...state, loading: false });
          showToast("warning", "User role not found. Please complete your profile.");
          // setIsModal(true); // Potentially open modal to collect more info
          // For now, log out if role is critical for app function
          logOutUser(); // Or navigate to a profile completion page
          return;
        }

        const menu = userRole && userSettings?.find((menu) => menu.role === userRole);

        if (menu) {
          const redirectUrl = location?.state?.from || `/${menu.pageType}/${menu.pageId}`;
          // Store other necessary localStorage items based on backendUserData
          localStorage.setItem("username", backendUserData.name || firebaseUser.displayName);
          // language preference if available in backendUserData.profile.language
          if (backendUserData.profile?.Language) {
            i18n.changeLanguage(backendUserData.profile.Language);
          }

          localStorage.setItem("PageLanding", menu.pageId);
          localStorage.setItem("defaultmenuid", menu.menuId);
          localStorage.setItem("pageType", menu.pageType);
          setState({ ...state, loading: false });
          navigate(redirectUrl);
        } else {
          // Role exists in backendUserData, but no matching menu found in appInfo.settings
          setState({ ...state, loading: false });
          showToast("danger", t("role-not-configured"));
          logOutUser(); // Or navigate to a generic dashboard / error page
        }
      } else {
        throw new Error("Firebase sign-in with custom token failed.");
      }
    } catch (error) {
      console.error("Error during Firebase login:", error);
      const errorMsg = error.response?.data?.error || error.message || "Login failed. Please try again.";
      showToast("danger", errorMsg);
      setState({ ...state, loading: false });
    }
  };

  const setThirdpartyLoader = (value) => {
    setState({ ...state, thirdpartyLoader: value });
  };

  // Firebase: thirdpartyLoginfn needs complete rewrite if third-party auth (Google, etc.) is done via Firebase.
  // For now, this function is largely tied to Parse and will be skipped in this refactoring pass.
  const thirdpartyLoginfn = async (sessionToken) => {
    showToast("info", "Third-party login needs to be updated for Firebase.");
    setThirdpartyLoader(false);
    // ... existing Parse-specific code ...
  };

  // Firebase: GetLoginData (auto-login if token exists) needs to use onAuthStateChanged listener
  // This function might be removed or its logic moved to an effect hook with onAuthStateChanged
  const GetLoginData = async () => {
    // This function was for Parse's session token.
    // With Firebase, onAuthStateChanged handles persistent login state.
    // If we need to fetch fresh user data from backend on app load for an existing Firebase session:
    // 1. onAuthStateChanged will give current Firebase user.
    // 2. If user exists, get ID token: `user.getIdToken()`.
    // 3. Call a backend endpoint like `/api/me` with this ID token.
    // 4. Backend returns full user data from RTDB.
    // 5. Update localStorage and app state.
    // For now, we'll rely on onAuthStateChanged to be set up elsewhere (e.g., in App.js or a context).
    // This specific GetLoginData might not be needed if state.loading is handled by onAuthStateChanged.
    console.log("GetLoginData (Parse) called. This should be replaced by Firebase onAuthStateChanged logic.");
    // setState({ ...state, loading: false }); // Example: stop loading if this was for initial load
  };


  const togglePasswordVisibility = () => {
    setState({ ...state, passwordVisible: !state.passwordVisible });
  };

  // Firebase: handleSubmitbtn (modal form) needs to be re-evaluated.
  // If this modal is for users who logged in but lack role/company info:
  // It should call a new backend endpoint like `POST /api/users/complete-profile`
  // This endpoint would update the user's data in Firebase RTDB (e.g., in /users/{uid}/profile and /user_roles/{uid})
  const handleSubmitbtn = async (e) => {
    e.preventDefault();
    showToast("info", "Profile completion flow needs to be updated for Firebase.");
    // ... existing Parse-specific code ...
    // Example of what it might do:
    // if (userDetails.Destination && userDetails.Company) {
    //   const firebaseUid = localStorage.getItem("firebaseUid");
    //   if(firebaseUid) {
    //      // Call new backend endpoint: POST /api/users/complete-profile
    //      // Body: { uid: firebaseUid, company: userDetails.Company, jobTitle: userDetails.Destination, timezone: usertimezone }
    //      // On success, fetch updated user data and proceed to navigate.
    //   }
    // }
    setIsModal(false); // Close modal for now
  };

  // Firebase: Updated logOutUser
  const logOutUser = async () => {
    setIsModal(false);
    try {
      await signOut(auth); // Firebase sign out
    } catch (err) {
      console.error("Error during Firebase sign out:", err);
    }
    // Clear Firebase related and general user items from localStorage
    localStorage.removeItem("firebaseUid");
    localStorage.removeItem("UserInformation");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("profileImg");
    localStorage.removeItem("_user_role");
    localStorage.removeItem("TenantId");
    localStorage.removeItem("TenantName");
    localStorage.removeItem("Extand_Class"); // Parse specific
    localStorage.removeItem("username");
    localStorage.removeItem("PageLanding");
    // Keep app specific settings if needed
    // let appdata = localStorage.getItem("userSettings");
    // let applogo = localStorage.getItem("appLogo");
    // localStorage.clear(); // Or selectively remove items
    // saveLanguageInLocal(i18n); // if i18n instance is still valid
    // localStorage.setItem("appLogo", applogo);
    // localStorage.setItem("userSettings", appdata);

    // Navigate to login or home page
    navigate("/login");
    // Optionally, dispatch actions to clear Redux state
  };


  // Firebase: This function needs a major overhaul or replacement.
  // The logic for determining redirect URL based on role should use data from `/api/login`.
  const continueLoginFlow = async () => {
    // This function was tightly coupled with Parse's extUser and session.
    // Most of its logic (fetching user details, determining role, navigating)
    // is now incorporated into the new `handleLogin` after `signInWithCustomToken` and
    // using the `backendUserData` from `/api/login`.
    // The modal popup logic for missing role needs to be re-thought for Firebase.
    // If backendUserData from /api/login indicates a missing role, handleLogin should decide
    // whether to show the modal or redirect to a dedicated profile completion page.
    console.warn("continueLoginFlow (Parse) was called. Its logic should be integrated into handleLogin's success path with Firebase.");
    // If setIsModal(true) was the outcome, that part would be in handleLogin.
    // If navigation was the outcome, that part is also in handleLogin.
    setState({ ...state, loading: false }); // Ensure loading is stopped.
  };

  return errMsg ? (
    <div className="h-screen flex justify-center text-center items-center p-4 text-gray-500 text-base">
      {errMsg}
    </div>
  ) : (
    <div>
      <Title title="Login" />
      {state.loading && (
        <div
          aria-live="assertive"
          className="fixed w-full h-full flex justify-center items-center bg-black bg-opacity-30 z-50"
        >
          <Loader />
        </div>
      )}
      {appInfo && appInfo.appId ? (
        <>
          <div
            aria-labelledby="loginHeading"
            role="region"
            className="pb-1 md:pb-4 pt-10 md:px-10 lg:px-16 h-full"
          >
            <div className="md:p-4 lg:p-10 p-4 bg-base-100 text-base-content op-card">
              <div className="w-[250px] h-[66px] inline-block overflow-hidden">
                {image && (
                  <img
                    src={image}
                    className="object-contain h-full"
                    alt="applogo"
                  />
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-2">
                <div>
                  <form onSubmit={handleLoginBtn} aria-label="Login Form">
                    <h1 className="text-[30px] mt-6">{t("welcome")}</h1>
                    <fieldset>
                      <legend className="text-[12px] text-[#878787]">
                        {t("Login-to-your-account")}
                      </legend>
                      <div className="w-full px-6 py-3 my-1 op-card bg-base-100 shadow-md outline outline-1 outline-slate-300/50">
                        <label className="block text-xs" htmlFor="email">
                          {t("email")}
                        </label>
                        <input
                          id="email"
                          type="email"
                          className="op-input op-input-bordered op-input-sm focus:outline-none hover:border-base-content w-full text-xs"
                          name="email"
                          autoComplete="username"
                          value={state.email}
                          onChange={handleChange}
                          required
                          onInvalid={(e) =>
                            e.target.setCustomValidity(t("input-required"))
                          }
                          onInput={(e) => e.target.setCustomValidity("")}
                        />
                        <hr className="my-1 border-none" />
                            <label className="block text-xs" htmlFor="password">
                              {t("password")}
                            </label>
                            <div className="relative">
                              <input
                                id="password"
                                type={
                                  state.passwordVisible ? "text" : "password"
                                }
                                className="op-input op-input-bordered op-input-sm focus:outline-none hover:border-base-content w-full text-xs"
                                name="password"
                                value={state.password}
                                autoComplete="current-password"
                                onChange={handleChange}
                                onInvalid={(e) =>
                                  e.target.setCustomValidity(
                                    t("input-required")
                                  )
                                }
                                onInput={(e) => e.target.setCustomValidity("")}
                                required
                              />
                              <span
                                className="absolute cursor-pointer top-[50%] right-[10px] -translate-y-[50%] text-base-content"
                                onClick={togglePasswordVisibility}
                              >
                                {state.passwordVisible ? (
                                  <i className="fa-light fa-eye-slash text-xs pb-1" /> // Close eye icon
                                ) : (
                                  <i className="fa-light fa-eye text-xs pb-1 " /> // Open eye icon
                                )}
                              </span>
                            </div>
                          <div className="relative mt-1">
                            <NavLink
                              to="/forgetpassword"
                              className="text-[13px] op-link op-link-primary underline-offset-1 focus:outline-none ml-1"
                            >
                              {t("forgot-password")}
                            </NavLink>
                          </div>
                      </div>
                    </fieldset>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-center text-xs font-bold mt-2">
                      <button
                        type="submit"
                        className="op-btn op-btn-primary"
                        disabled={state.loading}
                      >
                        {state.loading ? t("loading") : t("login")}
                      </button>
                    </div>
                  </form>
                </div>
                {width >= 768 && (
                  <div className="place-self-center">
                    <div className="mx-auto md:w-[300px] lg:w-[400px] xl:w-[500px]">
                      <img
                        src={login_img}
                        alt="The image illustrates a person from behind, seated at a desk with a four-monitor computer setup, in an environment with a light blue and white color scheme, featuring a potted plant to the right."
                        width="100%"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <SelectLanguage />
            {state.alertMsg && (
              <Alert type={state.alertType}>{state.alertMsg}</Alert>
            )}
          </div>
          <ModalUi
            isOpen={isModal}
            title={t("additional-info")}
            showClose={false}
          >
            <form className="px-4 py-3 text-base-content">
              <div className="mb-3">
                <label
                  htmlFor="Company"
                  style={{ display: "flex" }}
                  className="block text-xs text-gray-700 font-semibold"
                >
                  {t("company")}{" "}
                  <span className="text-[red] text-[13px]">*</span>
                </label>
                <input
                  type="text"
                  className="op-input op-input-bordered op-input-sm focus:outline-none hover:border-base-content w-full text-xs"
                  id="Company"
                  value={userDetails.Company}
                  onChange={(e) =>
                    setUserDetails({
                      ...userDetails,
                      Company: e.target.value
                    })
                  }
                  onInvalid={(e) =>
                    e.target.setCustomValidity(t("input-required"))
                  }
                  onInput={(e) => e.target.setCustomValidity("")}
                  required
                />
              </div>
              <div className="mb-3">
                <label
                  htmlFor="JobTitle"
                  style={{ display: "flex" }}
                  className="block text-xs text-gray-700 font-semibold"
                >
                  {t("job-title")}
                  <span className="text-[red] text-[13px]">*</span>
                </label>
                <input
                  type="text"
                  className="op-input op-input-bordered op-input-sm focus:outline-none hover:border-base-content w-full text-xs"
                  id="JobTitle"
                  value={userDetails.Destination}
                  onChange={(e) =>
                    setUserDetails({
                      ...userDetails,
                      Destination: e.target.value
                    })
                  }
                  onInvalid={(e) =>
                    e.target.setCustomValidity(t("input-required"))
                  }
                  onInput={(e) => e.target.setCustomValidity("")}
                  required
                />
              </div>
              <div className="mt-4 gap-2 flex flex-row">
                <button
                  type="button"
                  className="op-btn op-btn-primary"
                  onClick={(e) => handleSubmitbtn(e)}
                >
                  {t("login")}
                </button>
                <button
                  type="button"
                  className="op-btn op-btn-ghost"
                  onClick={logOutUser}
                >
                  {t("cancel")}
                </button>
              </div>
            </form>
          </ModalUi>
        </>
      ) : (
        <div
          aria-live="assertive"
          className="fixed w-full h-full flex justify-center items-center z-50"
        >
          <Loader />
        </div>
      )}
    </div>
  );
}
export default Login;
