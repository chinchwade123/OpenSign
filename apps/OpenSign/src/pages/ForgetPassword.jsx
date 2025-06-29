import React, { useEffect, useState } from "react";
import Title from "../components/Title";
import { useNavigate } from "react-router";
import login_img from "../assets/images/login_img.svg";
// import Parse from "parse"; // Firebase: Remove Parse
import Alert from "../primitives/Alert";
import { appInfo } from "../constant/appinfo";
import { useDispatch } from "react-redux";
import { fetchAppInfo } from "../redux/reducers/infoReducer";
import { auth } from "../firebaseConfig"; // Firebase: Import auth
import { sendPasswordResetEmail } from "firebase/auth"; // Firebase: Import sendPasswordResetEmail
import {
  emailRegex,
} from "../constant/const";
import { useTranslation } from "react-i18next";
import Loader from "../primitives/Loader";

function ForgotPassword() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [state, setState] = useState({ email: "", password: "", hideNav: "" });
  const [toast, setToast] = useState({ type: "", message: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [image, setImage] = useState();

  const handleChange = (event) => {
    let { name, value } = event.target;
    if (name === "email") {
      value = value?.toLowerCase()?.replace(/\s/g, "");
    }
    setState({ ...state, [name]: value });
  };

  const resize = () => {
    let currentHideNav = window.innerWidth <= 760;
    if (currentHideNav !== state.hideNav) {
      setState({ ...state, hideNav: currentHideNav });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!emailRegex.test(state.email)) {
      alert("Please enter a valid email address.");
    } else {
      setIsLoading(true);
      localStorage.setItem("appLogo", appInfo.applogo);
      localStorage.setItem("userSettings", JSON.stringify(appInfo.settings)); // This might be re-evaluated with Firebase auth
      if (state.email) {
        try {
          await sendPasswordResetEmail(auth, state.email);
          setToast({ type: "success", message: t("reset-password-alert-1") }); // "Password reset email sent successfully!"
        } catch (error) {
          console.error("Firebase password reset error: ", error);
          let errorMessage = t("reset-password-alert-2"); // "Failed to send password reset email."
          if (error.code === "auth/user-not-found") {
            errorMessage = t("auth-user-not-found"); // Create this translation: "No user found with this email."
          } else if (error.code === "auth/invalid-email") {
            errorMessage = t("auth-invalid-email"); // Create this translation: "The email address is not valid."
          }
          setToast({
            type: "danger",
            message: errorMessage
          });
        } finally {
          setIsLoading(false);
          setTimeout(() => setToast({ type: "", message: "" }), 3000); // Increased timeout for visibility
        }
      } else {
        setIsLoading(false); // Ensure loading is stopped if email is somehow empty
      }
    }
  };

  useEffect(() => {
    dispatch(fetchAppInfo());
    // saveLogo(); // Parse.User.logOut() was here, not needed for Firebase in this context
    setImage(appInfo?.applogo || undefined); // Directly set image
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line
  }, [dispatch]); // Added dispatch to dependency array

  // const saveLogo = async () => { // Replaced by direct setImage in useEffect
  //   try {
  //     // await Parse.User.logOut(); // Not needed
  //   } catch (err) {
  //     console.log("err while logging out ", err);
  //   }
  //     setImage(appInfo?.applogo || undefined);
  // };

  return (
    <div>
      {isLoading && (
        <div className="fixed w-full h-full flex justify-center items-center bg-black bg-opacity-30 z-50">
          <Loader />
        </div>
      )}
      <Title title="Forgot password" />
      {toast?.message && <Alert type={toast.type}>{toast.message}</Alert>}
      <div className="md:p-10 lg:p-16">
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
              <form onSubmit={handleSubmit}>
                <h2 className="text-[30px] mt-6">{t("welcome")}</h2>
                <span className="text-[12px] text-[#878787]">
                  {t("reset-password-alert-3")}
                </span>
                <div className="w-full my-4 op-card bg-base-100 shadow-md outline outline-1 outline-slate-300/50">
                  <div className="px-6 py-4">
                    <label className="block text-xs">{t("email")}</label>
                    <input
                      type="email"
                      name="email"
                      className="op-input op-input-bordered op-input-sm w-full"
                      value={state.email}
                      onChange={handleChange}
                      onInvalid={(e) =>
                        e.target.setCustomValidity(t("input-required"))
                      }
                      onInput={(e) => e.target.setCustomValidity("")}
                      required
                    />
                    <hr className="my-2 border-none" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-center text-xs font-bold">
                  <button type="submit" className="op-btn op-btn-primary">
                    {t("submit")}
                  </button>
                  <button
                    onClick={() => navigate("/", { replace: true })}
                    className="op-btn op-btn-secondary"
                  >
                    {t("login")}
                  </button>
                </div>
              </form>
            </div>
            {!state.hideNav && (
              <div className="self-center">
                <div className="mx-auto md:w-[300px] lg:w-[500px]">
                  <img src={login_img} alt="bisec" width="100%" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
