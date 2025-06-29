import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./styles/dark-theme-improvements.css";
import App from "./App";
import { Provider } from "react-redux";
import { store } from "./redux/store";
import { HTML5Backend } from "react-dnd-html5-backend";
import { TouchBackend } from "react-dnd-touch-backend";
import {
  DndProvider,
  TouchTransition,
  MouseTransition,
  Preview
} from "react-dnd-multi-backend";
import DragElement from "./components/pdf/DragElement.jsx";
import Parse from "parse"; // Will be removed/refactored later
import "./polyfills";
import { serverUrl_fn } from "./constant/appinfo"; // May still be needed for non-Parse API calls if any
import "./i18n";
import { app as firebaseApp, auth as firebaseAuth } from "./firebaseConfig"; // Import Firebase

// Ensure Firebase is initialized (by importing firebaseConfig.js)
console.log("Firebase Initialized: ", firebaseApp.name ? "Success" : "Failed", firebaseAuth ? "& Auth Ready" : "& Auth Not Ready");


const appId =
  import.meta.env.VITE_APPID || process.env.REACT_APP_APPID || "opensign";
const serverUrl = serverUrl_fn();
Parse.initialize(appId);
Parse.serverURL = serverUrl;

const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
  document.documentElement.setAttribute("data-theme", "opensigndark");
}

const HTML5toTouch = {
  backends: [
    {
      id: "html5",
      backend: HTML5Backend,
      transition: MouseTransition
    },
    {
      id: "touch",
      backend: TouchBackend,
      options: { enableMouseEvents: true },
      preview: true,
      transition: TouchTransition
    }
  ]
};
const generatePreview = (props) => {
  const { item, style } = props;
  const newStyle = {
    ...style
  };

  return (
    <div style={newStyle}>
      <DragElement {...item} />
    </div>
  );
};


const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <Provider store={store}>
    <DndProvider options={HTML5toTouch}>
      <Preview>{generatePreview}</Preview>
      <App />
    </DndProvider>
  </Provider>
);
