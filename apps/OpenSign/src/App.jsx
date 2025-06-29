import { useState, useEffect, lazy } from "react";
import { Routes, Route, BrowserRouter } from "react-router";
import { pdfjs } from "react-pdf";
import { auth } from './firebaseConfig'; // Firebase
import { onAuthStateChanged } from 'firebase/auth'; // Firebase
import apiClient from './api/apiClient'; // Use our configured apiClient
import { useDispatch } from "react-redux"; // If using Redux for user state
// import { setUserAction, clearUserAction } from './redux/actions/userActions'; // Example Redux actions
import Form from "./pages/Form";
import Report from "./pages/Report";
import Dashboard from "./pages/Dashboard";
import HomeLayout from "./layout/HomeLayout";
import PageNotFound from "./pages/PageNotFound";
import ValidateRoute from "./primitives/ValidateRoute";
import Validate from "./primitives/Validate";
import TemplatePlaceholder from "./pages/TemplatePlaceholder";
import SignYourSelf from "./pages/SignyourselfPdf";
import DraftDocument from "./components/pdf/DraftDocument";
import PlaceHolderSign from "./pages/PlaceHolderSign";
import PdfRequestFiles from "./pages/PdfRequestFiles";
import LazyPage from "./primitives/LazyPage";
import Loader from "./primitives/Loader";
import UserList from "./pages/UserList";
import { serverUrl_fn } from "./constant/appinfo";
import DocSuccessPage from "./pages/DocSuccessPage";
import ValidateSession from "./primitives/ValidateSession";
const DebugPdf = lazy(() => import("./pages/DebugPdf"));
const ForgetPassword = lazy(() => import("./pages/ForgetPassword"));
const GuestLogin = lazy(() => import("./pages/GuestLogin"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const Opensigndrive = lazy(() => import("./pages/Opensigndrive"));
const ManageSign = lazy(() => import("./pages/Managesign"));
const AddAdmin = lazy(() => import("./pages/AddAdmin"));
const UpdateExistUserAdmin = lazy(() => import("./pages/UpdateExistUserAdmin"));
const Preferences = lazy(() => import("./pages/Preferences"));
const Login = lazy(() => import("./pages/Login"));
const VerifyDocument = lazy(() => import("./pages/VerifyDocument"));
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;
const AppLoader = () => {
  return (
    <div className="flex justify-center items-center h-[100vh]">
      <Loader />
    </div>
  );
};
function App() {
  // const [isloading, setIsLoading] = useState(true); // Original loading
  const [authLoading, setAuthLoading] = useState(true); // For Firebase auth check
  const [currentUser, setCurrentUser] = useState(null); // Store Firebase user object
  const dispatch = useDispatch(); // If using Redux

  useEffect(() => {
    // Firebase onAuthStateChanged listener
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in
        setCurrentUser(user);
        try {
          // const idToken = await user.getIdToken(); // Not needed here, apiClient handles it
          // const apiBaseUrl = appInfo.apiBaseUrl; // Not needed here, apiClient handles it

          const response = await apiClient.get(`/api/me`); // apiClient adds token and base URL

          const backendUserData = response.data; // Contains { firebaseAuthInfo, profile, role } from /api/me

          // Store comprehensive user data (from backend) in localStorage or Redux
          localStorage.setItem("firebaseUid", user.uid);
          localStorage.setItem("UserInformation", JSON.stringify(backendUserData)); // Main user data from backend
          localStorage.setItem("userEmail", backendUserData.profile?.email || user.email);
          if (backendUserData.profile?.ProfilePic) {
            localStorage.setItem("profileImg", backendUserData.profile.ProfilePic);
          } else {
            localStorage.setItem("profileImg", "");
          }
          if (backendUserData.role?.role) {
            localStorage.setItem("_user_role", backendUserData.role.role);
          }
          if (backendUserData.role?.tenantId) {
            localStorage.setItem("TenantId", backendUserData.role.tenantId);
            // dispatch(showTenant(backendUserData.role.tenantName)); // Example if tenantName is available
          }
          localStorage.setItem("username", backendUserData.profile?.name || user.displayName);

          // Dispatch to Redux if needed
          // dispatch(setUserAction({ firebaseUser: user, backendUser: backendUserData }));

          console.log("User is signed in. Backend data:", backendUserData);

        } catch (error) {
          console.error("Error fetching user data from backend /api/me:", error);
          // Handle error - maybe sign out user if backend data is crucial and missing
          // await auth.signOut(); // Or handle as partial login
        }
      } else {
        // User is signed out
        setCurrentUser(null);
        // Clear user data from localStorage and Redux
        localStorage.removeItem("firebaseUid");
        localStorage.removeItem("UserInformation");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("profileImg");
        localStorage.removeItem("_user_role");
        localStorage.removeItem("TenantId");
        localStorage.removeItem("username");
        // dispatch(clearUserAction()); // Example Redux action
        console.log("User is signed out.");
      }
      setAuthLoading(false); // Firebase auth check complete
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [dispatch]);


  useEffect(() => {
    handleParseCredentials(); // Keep original Parse credential handling for now if parts of app still use it
  }, []);

  const handleParseCredentials = () => { // Renamed original handleCredentials
    const appId = process.env.REACT_APP_APPID
      ? process.env.REACT_APP_APPID
      : "opensign";
    const baseurl = serverUrl_fn();
    try {
      localStorage.setItem("baseUrl", `${baseurl}/`); // For Parse SDK or direct calls
      localStorage.setItem("parseAppId", appId); // For Parse SDK
      // setIsLoading(false); // Original loading, now handled by authLoading
    } catch (error) {
      console.log("err setting Parse credentials ", error);
    }
  };

  return (
    <div className="bg-base-200">
      {authLoading ? ( // Use authLoading for initial loader
        <AppLoader />
      ) : (
        <BrowserRouter>
          <Routes>
            {/* Pass currentUser or an isAuthenticated flag to routes if they need it directly,
                or rely on ValidateSession/ValidateRoute to check localStorage/Redux state updated by onAuthStateChanged */}
            <Route element={<ValidateRoute />}> {/* This will need to check Firebase auth status */}
              <Route exact path="/" element={<LazyPage Page={Login} />} />
                  <Route
                    path="/addadmin"
                    element={<LazyPage Page={AddAdmin} />}
                  />
                  <Route
                    path="/upgrade-2.1"
                    element={<LazyPage Page={UpdateExistUserAdmin} />}
                  />
            </Route>
            <Route element={<Validate />}> {/* This might also need to check Firebase auth status */}
              <Route
                path="/load/template/:templateId"
                element={<TemplatePlaceholder />}
              />
              <Route
                exact
                path="/load/placeholdersign/:docId"
                element={<PlaceHolderSign />}
              />
              <Route
                exact
                path="/load/recipientSignPdf/:docId/:contactBookId"
                element={<PdfRequestFiles />}
              />
            </Route>
            <Route
              path="/loadmf/signmicroapp/login/:id/:userMail/:contactBookId/:serverUrl"
              element={<LazyPage Page={GuestLogin} />}
            />
            <Route
              path="/login/:id/:userMail/:contactBookId/:serverUrl"
              element={<LazyPage Page={GuestLogin} />}
            />
            <Route
              path="/login/:base64url"
              element={<LazyPage Page={GuestLogin} />}
            />
            <Route path="/debugpdf" element={<LazyPage Page={DebugPdf} />} />
              <Route
                path="/forgetpassword"
                element={<LazyPage Page={ForgetPassword} />}
              />
            <Route
              element={
                <ValidateSession>
                  <HomeLayout />
                </ValidateSession>
              }
            >
                <Route
                  path="/changepassword"
                  element={<LazyPage Page={ChangePassword} />}
                />
              <Route path="/form/:id" element={<Form />} />
              <Route path="/report/:id" element={<Report />} />
              <Route path="/dashboard/:id" element={<Dashboard />} />
              <Route
                path="/profile"
                element={<LazyPage Page={UserProfile} />}
              />
              <Route
                path="/drive"
                element={<LazyPage Page={Opensigndrive} />}
              />
              <Route
                path="/managesign"
                element={<LazyPage Page={ManageSign} />}
              />
              <Route
                path="/template/:templateId"
                element={<TemplatePlaceholder />}
              />
              {/* signyouself route with no rowlevel data using docId from url */}
              <Route path="/signaturePdf/:docId" element={<SignYourSelf />} />
              {/* draft document route to handle and navigate route page according to document status */}
              <Route path="/draftDocument" element={<DraftDocument />} />
              {/* recipient placeholder set route with no rowlevel data using docId from url*/}
              <Route
                path="/placeHolderSign/:docId"
                element={<PlaceHolderSign />}
              />
              {/* for user signature (need your sign route) with row level data */}
              <Route path="/pdfRequestFiles" element={<PdfRequestFiles />} />
              {/* for user signature (need your sign route) with no row level data */}
              <Route
                path="/pdfRequestFiles/:docId"
                element={<PdfRequestFiles />}
              />
              {/* recipient signature route with no rowlevel data using docId from url */}
              <Route
                path="/recipientSignPdf/:docId/:contactBookId"
                element={<PdfRequestFiles />}
              />
              <Route
                path="/recipientSignPdf/:docId"
                element={<PdfRequestFiles />}
              />
                <Route path="/users" element={<UserList />} />
              <Route
                path="/verify-document"
                element={<LazyPage Page={VerifyDocument} />}
              />
              <Route
                path="/preferences"
                element={<LazyPage Page={Preferences} />}
              />
            </Route>
            <Route path="/success" element={<DocSuccessPage />} />
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </BrowserRouter>
      )}
    </div>
  );
}

export default App;
